/**
 * Cosmos — Graphing Calculator
 * Calculator, Graph, and Statistics modes
 */
const API_BASE = typeof COSMOS_API !== 'undefined' ? COSMOS_API : '';

const state = {
  expression: '',
  lastAnswer: 0,
  angleMode: 'RAD',
  xRange: [-10, 10],
  yRange: [-10, 10],
  isPanning: false,
  panStart: { x: 0, y: 0 },
  rangeStart: { x: [-10, 10], y: [-10, 10] },
  plotType: 'scatter',
};

const GRAPH_COLORS = ['#58a6ff', '#f85149', '#3fb950', '#a371f7', '#f0b429', '#79c0ff', '#ff7b72', '#56d364', '#d2a8ff', '#ffa657'];
const KEYPAD = [
  [{ txt: 'Clear', action: 'clear', cls: 'btn-fn' }, { txt: 'Del', action: 'del', cls: 'btn-fn' }, { txt: '(', action: '(', cls: 'btn-op' }, { txt: ')', action: ')', cls: 'btn-op' }, { txt: 'sin', action: 'sin(', cls: 'btn-sci' }],
  [{ txt: '7', action: '7', cls: 'btn-num' }, { txt: '8', action: '8', cls: 'btn-num' }, { txt: '9', action: '9', cls: 'btn-num' }, { txt: '÷', action: '/', cls: 'btn-op' }, { txt: 'cos', action: 'cos(', cls: 'btn-sci' }],
  [{ txt: '4', action: '4', cls: 'btn-num' }, { txt: '5', action: '5', cls: 'btn-num' }, { txt: '6', action: '6', cls: 'btn-num' }, { txt: '×', action: '*', cls: 'btn-op' }, { txt: 'tan', action: 'tan(', cls: 'btn-sci' }],
  [{ txt: '1', action: '1', cls: 'btn-num' }, { txt: '2', action: '2', cls: 'btn-num' }, { txt: '3', action: '3', cls: 'btn-num' }, { txt: '−', action: '-', cls: 'btn-op' }, { txt: 'log', action: 'log(', cls: 'btn-sci' }],
  [{ txt: '0', action: '0', cls: 'btn-num' }, { txt: '.', action: '.', cls: 'btn-num' }, { txt: '^', action: '^', cls: 'btn-op' }, { txt: '+', action: '+', cls: 'btn-op' }, { txt: 'ln', action: 'ln(', cls: 'btn-sci' }],
  [{ txt: '√', action: 'sqrt(', cls: 'btn-sci' }, { txt: 'abs', action: 'abs(', cls: 'btn-sci' }, { txt: 'x', action: 'x', cls: 'btn-sci' }, { txt: 'π', action: 'pi', cls: 'btn-const' }, { txt: 'e', action: 'e', cls: 'btn-const' }],
  [{ txt: 'Ans', action: 'ans', cls: 'btn-special', span: 2 }, { txt: 'Enter', action: 'enter', cls: 'btn primary', span: 3 }],
];

let canvas, ctx, canvasWidth, canvasHeight;
let statsCanvas, statsCtx;

// --- DOM ---
const exprDisplay = document.getElementById('exprDisplay');
const resultDisplay = document.getElementById('resultDisplay');
const graphCanvas = document.getElementById('graphCanvas');
const traceTooltip = document.getElementById('traceTooltip');
const coordDisplay = document.getElementById('coordDisplay');
const angleModeBtn = document.getElementById('angleMode');

// --- Mode switching ---
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.mode-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.mode + 'Mode').classList.add('active');
    if (tab.dataset.mode === 'graph') {
      setTimeout(() => {
        if (window.cosmosGraphResize) window.cosmosGraphResize();
        redraw();
      }, 100);
    }
    if (tab.dataset.mode === 'stats') drawStatsPlot();
  });
});

// --- Calculator ---
function buildKeypad() {
  const el = document.getElementById('calcKeypad');
  el.innerHTML = '';
  KEYPAD.forEach(row => {
    row.forEach(b => {
      const btn = document.createElement('button');
      btn.className = 'btn ' + (b.cls || '');
      btn.textContent = b.txt;
      btn.dataset.action = b.action;
      if (b.span) btn.style.gridColumn = `span ${b.span}`;
      el.appendChild(btn);
    });
  });
  el.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', () => handleCalcAction(btn.dataset.action));
  });
}

function toMathJS(expr) {
  if (!expr || typeof expr !== 'string') return '';
  return expr
    .replace(/²/g, '^2')
    .replace(/\*\*/g, '^')
    .replace(/ln\(/g, 'LOG_')
    .replace(/log\(/g, 'log10(')
    .replace(/LOG_/g, 'log(');
}

function evaluateExpr(expr, xVal = null) {
  const t = toMathJS(expr);
  if (!t.trim()) return null;
  try {
    const scope = {
      pi: Math.PI, e: Math.E,
      sin: v => Math.sin(state.angleMode === 'DEG' ? (v * Math.PI) / 180 : v),
      cos: v => Math.cos(state.angleMode === 'DEG' ? (v * Math.PI) / 180 : v),
      tan: v => Math.tan(state.angleMode === 'DEG' ? (v * Math.PI) / 180 : v),
      sqrt: math.sqrt, abs: math.abs, exp: math.exp,
    };
    if (xVal !== null) scope.x = xVal;
    return math.parse(t).compile().evaluate(scope);
  } catch { return null; }
}

function hasVariableX(expr) {
  return typeof expr === 'string' && expr.includes('x') && /[a-zA-Z]*x[a-zA-Z]*/.test(expr);
}

function isGraphable(expr) {
  return typeof expr === 'string' && expr.trim().length > 0;
}

function updateDisplay() {
  exprDisplay.textContent = state.expression || '';
  resultDisplay.textContent = state.expression ? '' : String(state.lastAnswer);
}

function appendToExpr(v) {
  state.expression += v === 'pi' ? 'pi' : v === 'e' ? 'e' : v;
  updateDisplay();
}

function handleCalcAction(action) {
  if (action === 'clear') { state.expression = ''; updateDisplay(); return; }
  if (action === 'del') { state.expression = state.expression.slice(0, -1); updateDisplay(); return; }
  if (action === 'ans') { appendToExpr(String(state.lastAnswer)); return; }
  if (action === 'enter') {
    if (!state.expression.trim()) return;
    if (hasVariableX(state.expression)) return;
    const r = evaluateExpr(state.expression);
    if (r !== null && Number.isFinite(r)) {
      state.lastAnswer = r;
      state.expression = String(r);
    } else state.expression = 'Error';
    updateDisplay();
    return;
  }
  appendToExpr(action);
}

// --- Graph ---
function mapX(x) {
  const [a, b] = state.xRange;
  return ((x - a) / (b - a)) * canvasWidth;
}
function mapY(y) {
  const [a, b] = state.yRange;
  return canvasHeight - ((y - a) / (b - a)) * canvasHeight;
}
function toWorldX(px) {
  const [a, b] = state.xRange;
  return a + (px / canvasWidth) * (b - a);
}
function toWorldY(py) {
  const [a, b] = state.yRange;
  return b - (py / canvasHeight) * (b - a);
}

function drawGrid() {
  if (!ctx || !canvasWidth || !canvasHeight) return;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  const [xMin, xMax] = state.xRange;
  const [yMin, yMax] = state.yRange;
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 20; i++) {
    const x = xMin + (xMax - xMin) * i / 20;
    const px = mapX(x);
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, canvasHeight);
    ctx.stroke();
  }
  for (let i = 0; i <= 20; i++) {
    const y = yMin + (yMax - yMin) * i / 20;
    const py = mapY(y);
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(canvasWidth, py);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  if (xMin < 0 && xMax > 0) {
    const x0 = mapX(0);
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.lineTo(x0, canvasHeight);
    ctx.stroke();
  }
  if (yMin < 0 && yMax > 0) {
    const y0 = mapY(0);
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(canvasWidth, y0);
    ctx.stroke();
  }
}

function plotFunction(expr, color) {
  if (!expr || !isGraphable(expr) || !canvasWidth || !canvasHeight) return;
  const [xMin, xMax] = state.xRange;
  const [yMin, yMax] = state.yRange;
  const n = Math.min(800, Math.max(200, Math.max(canvasWidth, 200)));
  const dx = (xMax - xMin) / n;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  let first = true;
  for (let i = 0; i <= n; i++) {
    const x = xMin + i * dx;
    const y = hasVariableX(expr) ? evaluateExpr(expr, x) : evaluateExpr(expr, null);
    if (y === null || !Number.isFinite(y)) {
      first = true;
      continue;
    }
    const px = mapX(x), py = mapY(y);
    if (py < -50 || py > canvasHeight + 50) {
      first = true;
      continue;
    }
    if (first) { ctx.moveTo(px, py); first = false; }
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function findRoot(f, xLo, xHi, tol = 1e-8) {
  const fLo = f(xLo), fHi = f(xHi);
  if (Math.abs(fLo) < tol) return xLo;
  if (Math.abs(fHi) < tol) return xHi;
  if (fLo * fHi > 0) return null;
  for (let i = 0; i < 50; i++) {
    const xMid = (xLo + xHi) / 2;
    const fMid = f(xMid);
    if (Math.abs(fMid) < tol) return xMid;
    if (fMid * fLo < 0) { xHi = xMid; } else { xLo = xMid; }
  }
  return (xLo + xHi) / 2;
}

function findRootsInRange(expr, xMin, xMax, nSamples = 200) {
  if (!hasVariableX(expr)) return [];
  const roots = [];
  const dx = (xMax - xMin) / nSamples;
  const f = x => (evaluateExpr(expr, x) || 0);
  for (let i = 0; i < nSamples; i++) {
    const x1 = xMin + i * dx, x2 = xMin + (i + 1) * dx;
    const y1 = f(x1), y2 = f(x2);
    if (y1 * y2 <= 0 && (y1 !== 0 || y2 !== 0)) {
      const root = findRoot(f, x1, x2);
      if (root !== null) roots.push(root);
    }
  }
  return roots.filter((r, i, a) => a.findIndex(x => Math.abs(x - r) < 1e-6) === i);
}

function findIntersections(expr1, expr2, xMin, xMax, nSamples = 300) {
  if (!hasVariableX(expr1) || !hasVariableX(expr2)) return [];
  const diff = x => {
    const y1 = evaluateExpr(expr1, x), y2 = evaluateExpr(expr2, x);
    if (y1 == null || y2 == null || !Number.isFinite(y1) || !Number.isFinite(y2)) return 0;
    return y1 - y2;
  };
  const pts = [];
  const dx = (xMax - xMin) / nSamples;
  for (let i = 0; i < nSamples; i++) {
    const x1 = xMin + i * dx, x2 = xMin + (i + 1) * dx;
    const d1 = diff(x1), d2 = diff(x2);
    if (d1 * d2 <= 0 && (d1 !== 0 || d2 !== 0)) {
      const x = findRoot(diff, x1, x2);
      if (x !== null) {
        const y = evaluateExpr(expr1, x);
        if (y != null && Number.isFinite(y)) pts.push({ x, y });
      }
    }
  }
  return pts.filter((p, i, a) => a.findIndex(q => Math.abs(q.x - p.x) < 1e-5) === i);
}

function drawPoints(points, color, label) {
  if (!points.length) return;
  ctx.font = '10px "IBM Plex Mono"';
  ctx.textAlign = 'left';
  points.forEach(({ x, y }) => {
    const px = mapX(x), py = mapY(y);
    if (px < -20 || px > canvasWidth + 20 || py < -20 || py > canvasHeight + 20) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

function redraw() {
  drawGrid();
  const exprs = [];
  document.querySelectorAll('.func-input').forEach((input, i) => {
    const expr = input.value.trim();
    if (expr && isGraphable(expr)) {
      exprs.push({ expr, color: GRAPH_COLORS[i % GRAPH_COLORS.length] });
      plotFunction(expr, GRAPH_COLORS[i % GRAPH_COLORS.length]);
    }
  });
  const [xMin, xMax] = state.xRange, [yMin, yMax] = state.yRange;
  const interceptColor = 'rgba(255, 255, 255, 0.9)';
  exprs.forEach(({ expr, color }) => {
    if (!hasVariableX(expr)) return;
    const y0 = evaluateExpr(expr, 0);
    if (y0 != null && Number.isFinite(y0) && y0 >= yMin && y0 <= yMax) {
      drawPoints([{ x: 0, y: y0 }], interceptColor, '(0, y)');
    }
    const roots = findRootsInRange(expr, xMin, xMax);
    roots.forEach(x => drawPoints([{ x, y: 0 }], interceptColor));
  });
  for (let i = 0; i < exprs.length; i++) {
    for (let j = i + 1; j < exprs.length; j++) {
      const pts = findIntersections(exprs[i].expr, exprs[j].expr, xMin, xMax);
      pts.forEach(p => {
        if (p.y >= yMin && p.y <= yMax) drawPoints([p], '#ffd700', 'int');
      });
    }
  }
}

function setupGraphCanvas() {
  canvas = graphCanvas;
  ctx = canvas.getContext('2d');
  function resize() {
    const rect = graphCanvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvasWidth = Math.floor(rect.width);
    canvasHeight = Math.floor(rect.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.scale(dpr, dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    redraw();
  }
  window.cosmosGraphResize = resize;
  window.addEventListener('resize', resize);
  if (document.getElementById('graphMode').classList.contains('active')) resize();
  canvas.addEventListener('mousedown', e => {
    if (e.button === 0) {
      state.isPanning = true;
      state.panStart = { x: e.offsetX, y: e.offsetY };
      state.rangeStart = { x: [...state.xRange], y: [...state.yRange] };
    }
  });
  canvas.addEventListener('mousemove', e => {
    const wx = toWorldX(e.offsetX), wy = toWorldY(e.offsetY);
    coordDisplay.textContent = `x: ${wx.toFixed(2)}  y: ${wy.toFixed(2)}`;
    if (state.isPanning) {
      const [xMin, xMax] = state.rangeStart.x;
      const [yMin, yMax] = state.rangeStart.y;
      const dx = (xMax - xMin) * (state.panStart.x - e.offsetX) / canvasWidth;
      const dy = (yMax - yMin) * (e.offsetY - state.panStart.y) / canvasHeight;
      state.xRange = [xMin + dx, xMax + dx];
      state.yRange = [yMin + dy, yMax + dy];
      state.panStart = { x: e.offsetX, y: e.offsetY };
      state.rangeStart = { x: [...state.xRange], y: [...state.yRange] };
      redraw();
    } else {
      let txt = '';
      document.querySelectorAll('.func-input').forEach((input, i) => {
        const expr = input.value.trim();
        if (expr && isGraphable(expr)) {
          const y = hasVariableX(expr) ? evaluateExpr(expr, wx) : evaluateExpr(expr);
          if (y !== null && Number.isFinite(y)) txt += `y${i + 1}: (${wx.toFixed(2)}, ${y.toFixed(2)})\n`;
        }
      });
      if (txt) {
        traceTooltip.textContent = txt.trim();
        traceTooltip.classList.remove('hidden');
        traceTooltip.style.left = (e.clientX + 12) + 'px';
        traceTooltip.style.top = (e.clientY + 12) + 'px';
      } else traceTooltip.classList.add('hidden');
    }
  });
  canvas.addEventListener('mouseleave', () => {
    state.isPanning = false;
    traceTooltip.classList.add('hidden');
    coordDisplay.textContent = 'Hover to trace';
  });
  canvas.addEventListener('mouseup', e => { if (e.button === 0) state.isPanning = false; });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const [xMin, xMax] = state.xRange, [yMin, yMax] = state.yRange;
    const rangeW = xMax - xMin, rangeH = yMax - yMin;
    const panAmount = 0.12;
    if (e.ctrlKey || e.metaKey) {
      const f = e.deltaY > 0 ? 1.1 : 0.9;
      const cx = (xMin + xMax) / 2, cy = (yMin + yMax) / 2;
      state.xRange = [cx - rangeW * f / 2, cx + rangeW * f / 2];
      state.yRange = [cy - rangeH * f / 2, cy + rangeH * f / 2];
    } else if (e.shiftKey) {
      const dx = (e.deltaY > 0 ? panAmount : -panAmount) * rangeW;
      state.xRange = [xMin + dx, xMax + dx];
    } else {
      const dy = (e.deltaY > 0 ? -panAmount : panAmount) * rangeH;
      state.yRange = [yMin + dy, yMax + dy];
    }
    redraw();
  }, { passive: false });
  canvas.setAttribute('tabindex', '0');
  canvas.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const [xMin, xMax] = state.xRange, [yMin, yMax] = state.yRange;
    const rangeW = xMax - xMin, rangeH = yMax - yMin;
    const step = 0.2;
    if (e.key === 'ArrowLeft') { state.xRange = [xMin - step * rangeW, xMax - step * rangeW]; }
    else if (e.key === 'ArrowRight') { state.xRange = [xMin + step * rangeW, xMax + step * rangeW]; }
    else if (e.key === 'ArrowUp') { state.yRange = [yMin + step * rangeH, yMax + step * rangeH]; }
    else if (e.key === 'ArrowDown') { state.yRange = [yMin - step * rangeH, yMax - step * rangeH]; }
    redraw();
  });
  canvas.addEventListener('focus', () => canvas.classList.add('graph-focused'));
  canvas.addEventListener('blur', () => canvas.classList.remove('graph-focused'));
}

document.querySelectorAll('.func-input').forEach(input => {
  input.addEventListener('input', () => redraw());
  input.addEventListener('keydown', e => { if (e.key === 'Enter') redraw(); });
});

// --- Statistics ---
function parseList(str) {
  return str.split(/[\s,;]+/).filter(Boolean).map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
}

async function callAPI(path, body) {
  if (!API_BASE) return null;
  try {
    const r = await fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await r.json();
  } catch (e) {
    return { error: e.message };
  }
}

function oneVarClient(data) {
  const n = data.length;
  if (n < 2) return { error: 'Need at least 2 points' };
  const mean = data.reduce((a, b) => a + b, 0) / n;
  const ss = data.reduce((s, x) => s + (x - mean) ** 2, 0); // sum of squared deviations
  const variancePop = ss / n;           // σ² population
  const varianceSamp = n > 1 ? ss / (n - 1) : 0; // s² sample
  const stdPop = Math.sqrt(variancePop);
  const stdSamp = Math.sqrt(varianceSamp);
  const sorted = [...data].sort((a, b) => a - b);
  const median = n % 2 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const q1 = sorted[Math.floor(n * 0.25)], q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  return {
    n, mean,
    'σ (pop std)': stdPop, 's (sample std)': stdSamp,
    'σ² (pop var)': variancePop, 's² (sample var)': varianceSamp,
    min: Math.min(...data), max: Math.max(...data),
    median, Q1: q1, Q3: q3, IQR: iqr,
    sum: data.reduce((a, b) => a + b, 0), 'Σ(x-x̄)²': ss,
  };
}

function twoVarClient(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 2) return { error: 'Need at least 2 points' };
  x = x.slice(0, n);
  y = y.slice(0, n);
  const sumX = x.reduce((a, b) => a + b, 0), sumY = y.reduce((a, b) => a + b, 0);
  const meanX = sumX / n, meanY = sumY / n;
  const sumXY = x.reduce((s, xi, i) => s + xi * y[i], 0);
  const sumX2 = x.reduce((s, xi) => s + xi * xi, 0);
  const sumY2 = y.reduce((s, yi) => s + yi * yi, 0);
  return { n, meanX, meanY, sumX, sumY, sumXY, sumX2, sumY2 };
}

function linRegClient(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 2) return { error: 'Need at least 2 points' };
  x = x.slice(0, n);
  y = y.slice(0, n);
  const sumX = x.reduce((a, b) => a + b, 0), sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((s, xi, i) => s + xi * y[i], 0);
  const sumX2 = x.reduce((s, xi) => s + xi * xi, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-10) return { error: 'Cannot compute' };
  const a = (n * sumXY - sumX * sumY) / denom;
  const b = (sumY - a * sumX) / n;
  const meanY = sumY / n;
  const ssTot = y.reduce((s, yi) => s + (yi - meanY) ** 2, 0);
  const ssRes = y.reduce((s, yi, i) => s + (yi - (a * x[i] + b)) ** 2, 0);
  const r = ssTot > 0 ? Math.sqrt(Math.max(0, 1 - ssRes / ssTot)) : 0;
  return { a, b, r, r2: r * r, equation: `y = ${a.toFixed(4)}x + ${b.toFixed(4)}` };
}

function formatStats(obj) {
  if (obj.error) return obj.error;
  return Object.entries(obj)
    .map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toFixed(4) : v}`)
    .join('\n');
}

// --- AP Statistics: Probability & Tables ---
function factorial(n) {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  if (n <= 1) return 1;
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

function nCr(n, r) {
  if (r < 0 || r > n) return 0;
  return factorial(n) / (factorial(r) * factorial(n - r));
}

function binomialP(n, p, x) {
  if (x < 0 || x > n || p < 0 || p > 1) return null;
  return nCr(n, x) * Math.pow(p, x) * Math.pow(1 - p, n - x);
}

function geometricP(p, x) {
  if (x < 1 || p <= 0 || p > 1) return null;
  return Math.pow(1 - p, x - 1) * p;
}

// Standard normal CDF (Abramowitz-Stegun approximation)
function normalCDF(z) {
  const b1 = 0.31938153, b2 = -0.356563782, b3 = 1.781477937, b4 = -1.821255978, b5 = 1.330274429;
  const p = 0.2316419;
  const phi = x => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
  const t = 1 / (1 + p * Math.abs(z));
  const y = 1 - phi(z) * ((((b5 * t + b4) * t + b3) * t + b2) * t + b1) * t;
  return z < 0 ? 1 - y : y;
}

// t critical values: df -> { '0.90': t*, '0.95': t*, '0.99': t* } (tail = (1-C)/2 for C confidence)
const T_TABLE = {
  1: { 0.90: 3.078, 0.95: 6.314, 0.99: 31.82 }, 2: { 0.90: 1.886, 0.95: 2.920, 0.99: 6.965 },
  3: { 0.90: 1.638, 0.95: 2.353, 0.99: 4.541 }, 4: { 0.90: 1.533, 0.95: 2.132, 0.99: 3.747 },
  5: { 0.90: 1.476, 0.95: 2.015, 0.99: 3.365 }, 6: { 0.90: 1.440, 0.95: 1.943, 0.99: 3.143 },
  7: { 0.90: 1.415, 0.95: 1.895, 0.99: 2.998 }, 8: { 0.90: 1.397, 0.95: 1.860, 0.99: 2.896 },
  9: { 0.90: 1.383, 0.95: 1.833, 0.99: 2.821 }, 10: { 0.90: 1.372, 0.95: 1.812, 0.99: 2.764 },
  11: { 0.90: 1.363, 0.95: 1.796, 0.99: 2.718 }, 12: { 0.90: 1.356, 0.95: 1.782, 0.99: 2.681 },
  15: { 0.90: 1.341, 0.95: 1.753, 0.99: 2.602 }, 20: { 0.90: 1.325, 0.95: 1.725, 0.99: 2.528 },
  30: { 0.90: 1.310, 0.95: 1.697, 0.99: 2.457 }, 40: { 0.90: 1.303, 0.95: 1.684, 0.99: 2.423 },
  50: { 0.90: 1.299, 0.95: 1.676, 0.99: 2.403 }, 60: { 0.90: 1.296, 0.95: 1.671, 0.99: 2.390 },
  80: { 0.90: 1.292, 0.95: 1.664, 0.99: 2.374 }, 100: { 0.90: 1.290, 0.95: 1.660, 0.99: 2.364 },
  inf: { 0.90: 1.282, 0.95: 1.645, 0.99: 2.326 },
};

// Chi-sq critical values: df -> { 0.10: val, 0.05: val, 0.01: val }
const CHI_TABLE = {
  1: { 0.10: 2.71, 0.05: 3.84, 0.01: 6.63 }, 2: { 0.10: 4.61, 0.05: 5.99, 0.01: 9.21 },
  3: { 0.10: 6.25, 0.05: 7.81, 0.01: 11.34 }, 4: { 0.10: 7.78, 0.05: 9.49, 0.01: 13.28 },
  5: { 0.10: 9.24, 0.05: 11.07, 0.01: 15.09 }, 6: { 0.10: 10.64, 0.05: 12.59, 0.01: 16.81 },
  7: { 0.10: 12.02, 0.05: 14.07, 0.01: 18.48 }, 8: { 0.10: 13.36, 0.05: 15.51, 0.01: 20.09 },
  9: { 0.10: 14.68, 0.05: 16.92, 0.01: 21.67 }, 10: { 0.10: 15.99, 0.05: 18.31, 0.01: 23.21 },
  15: { 0.10: 22.31, 0.05: 25.00, 0.01: 30.58 }, 20: { 0.10: 28.41, 0.05: 31.41, 0.01: 37.57 },
  30: { 0.10: 40.26, 0.05: 43.77, 0.01: 50.89 },
};

function chiSquareTest(observed, expected) {
  if (observed.length !== expected.length || observed.length === 0) return { error: 'Observed and expected must be same length' };
  let chi2 = 0;
  for (let i = 0; i < observed.length; i++) {
    if (expected[i] === 0) return { error: 'Expected values cannot be 0' };
    chi2 += Math.pow(observed[i] - expected[i], 2) / expected[i];
  }
  return { chi2, df: observed.length - 1 };
}

function tLookup(df, conf) {
  if (T_TABLE[df]) return T_TABLE[df][conf];
  if (df >= 100) return T_TABLE.inf?.[conf];
  const keys = Object.keys(T_TABLE).filter(k => k !== 'inf').map(Number);
  const nearest = keys.reduce((a, b) => Math.abs(b - df) < Math.abs(a - df) ? b : a);
  return T_TABLE[nearest]?.[conf];
}

function chiLookup(df, tail) {
  if (CHI_TABLE[df]) return CHI_TABLE[df][tail];
  const keys = Object.keys(CHI_TABLE).map(Number).filter(k => !isNaN(k));
  const nearest = keys.reduce((a, b) => Math.abs(b - df) < Math.abs(a - df) ? b : a);
  return CHI_TABLE[nearest]?.[tail];
}

function getList(num) {
  const el = document.getElementById('listL' + num);
  return el ? parseList(el.value) : [];
}

// Stats tab switching
document.querySelectorAll('.stats-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.stats-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.stats-tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.querySelector(`.stats-tab-panel[data-panel="${tab.dataset.statsTab}"]`).classList.add('active');
  });
});

document.getElementById('btn1Var').addEventListener('click', async () => {
  const listNum = document.getElementById('list1Var').value;
  const data = getList(listNum);
  let result = API_BASE ? await callAPI('/api/stats/1-var', { data }) : oneVarClient(data);
  if (result && result.error) result = { error: result.error };
  document.getElementById('statsResults').textContent = formatStats(result || oneVarClient(data));
  drawStatsPlot();
});

document.getElementById('btn2Var').addEventListener('click', async () => {
  const x = getList(document.getElementById('listX').value);
  const y = getList(document.getElementById('listY').value);
  let result = API_BASE ? await callAPI('/api/stats/2-var', { x, y }) : twoVarClient(x, y);
  document.getElementById('statsResults').textContent = formatStats(result || twoVarClient(x, y));
  drawStatsPlot();
});

document.getElementById('btnLinReg').addEventListener('click', async () => {
  const x = getList(document.getElementById('listX').value);
  const y = getList(document.getElementById('listY').value);
  let result = API_BASE ? await callAPI('/api/stats/linreg', { x, y }) : linRegClient(x, y);
  document.getElementById('statsResults').textContent = formatStats(result || linRegClient(x, y));
  drawStatsPlot();
});

document.getElementById('btnChiSq').addEventListener('click', () => {
  const observed = getList(document.getElementById('listObs').value);
  const expected = getList(document.getElementById('listExp').value);
  const result = chiSquareTest(observed, expected);
  document.getElementById('statsResults').textContent = result.error || `χ² = ${result.chi2.toFixed(4)}\ndf = ${result.df}`;
});

document.getElementById('btnBinom').addEventListener('click', () => {
  const n = parseInt(document.getElementById('binomN').value, 10);
  const p = parseFloat(document.getElementById('binomP').value);
  const x = parseInt(document.getElementById('binomX').value, 10);
  const r = binomialP(n, p, x);
  document.getElementById('statsResults').textContent = r == null ? 'Invalid: n≥1, 0≤p≤1, 0≤x≤n' : `Binomial P(X=${x}) = ${r.toFixed(6)}\nn=${n}, p=${p}`;
});

document.getElementById('btnGeom').addEventListener('click', () => {
  const p = parseFloat(document.getElementById('geomP').value);
  const x = parseInt(document.getElementById('geomX').value, 10);
  const r = geometricP(p, x);
  document.getElementById('statsResults').textContent = r == null ? 'Invalid: p in (0,1], x≥1' : `Geometric P(X=${x}) = ${r.toFixed(6)}\np=${p}`;
});

document.getElementById('btnZTable').addEventListener('click', () => {
  const z = parseFloat(document.getElementById('zVal').value);
  if (isNaN(z)) { document.getElementById('statsResults').textContent = 'Enter a z value'; return; }
  const p = normalCDF(z);
  document.getElementById('statsResults').textContent = `P(Z < ${z}) = ${p.toFixed(4)}\nP(Z > ${z}) = ${(1 - p).toFixed(4)}`;
});

document.getElementById('btnTTable').addEventListener('click', () => {
  const df = parseInt(document.getElementById('tDf').value, 10);
  const conf = document.getElementById('tConf').value;
  const t = tLookup(df, conf);
  document.getElementById('statsResults').textContent = t != null ? `t* (df=${df}, ${conf * 100}% confidence) = ${t.toFixed(3)}` : 'df not in table (1-100)';
});

document.getElementById('btnChiTable').addEventListener('click', () => {
  const df = parseInt(document.getElementById('chiDf').value, 10);
  const tail = parseFloat(document.getElementById('chiTail').value);
  const chi = chiLookup(df, tail);
  document.getElementById('statsResults').textContent = chi != null ? `χ²* (df=${df}, p=${tail}) = ${chi.toFixed(2)}` : 'df not in table (1-30)';
});

document.getElementById('btnCopyResults').addEventListener('click', () => {
  const text = document.getElementById('statsResults').textContent;
  navigator.clipboard?.writeText(text).then(() => {
    const btn = document.getElementById('btnCopyResults');
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  });
});

document.querySelectorAll('.plot-type .btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.plot-type .btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.plotType = btn.dataset.plot;
    drawStatsPlot();
  });
});

function drawStatsPlot() {
  statsCanvas = document.getElementById('statsCanvas');
  if (!statsCanvas) return;
  statsCtx = statsCanvas.getContext('2d');
  const w = statsCanvas.width = statsCanvas.offsetWidth;
  const h = statsCanvas.height = statsCanvas.offsetHeight;
  statsCtx.clearRect(0, 0, w, h);
  const x = getList(document.getElementById('listX')?.value || '1');
  const y = getList(document.getElementById('listY')?.value || '2');
  const histData = getList(document.getElementById('list1Var')?.value || '1');
  if (x.length === 0 && y.length === 0 && histData.length === 0) return;

  if (state.plotType === 'histogram' && histData.length > 0) {
    const min = Math.min(...histData), max = Math.max(...histData);
    const bins = Math.min(10, Math.max(3, Math.ceil(Math.sqrt(histData.length))));
    const step = (max - min) / bins || 1;
    const counts = Array(bins).fill(0);
    histData.forEach(v => {
      let i = Math.min(Math.floor((v - min) / step), bins - 1);
      if (i < 0) i = 0;
      counts[i]++;
    });
    const m = Math.max(...counts);
    const pad = 40;
    const bw = (w - 2 * pad) / bins;
    statsCtx.fillStyle = '#58a6ff';
    counts.forEach((c, i) => {
      const barH = ((h - 2 * pad) * c / m) || 0;
      statsCtx.fillRect(pad + i * bw + 2, h - pad - barH, bw - 4, barH);
    });
    statsCtx.strokeStyle = 'rgba(255,255,255,0.3)';
    statsCtx.strokeRect(pad, pad, w - 2 * pad, h - 2 * pad);
  } else {
    const n = Math.min(x.length, y.length);
    if (n < 1) return;
    const xs = x.slice(0, n), ys = y.slice(0, n);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const xR = xMax - xMin || 1, yR = yMax - yMin || 1;
    const pad = 40;
    const plotW = w - 2 * pad, plotH = h - 2 * pad;
    const mx = px => pad + ((px - xMin) / xR) * plotW;
    const my = py => h - pad - ((py - yMin) / yR) * plotH;
    statsCtx.strokeStyle = 'rgba(255,255,255,0.3)';
    statsCtx.strokeRect(pad, pad, plotW, plotH);
    statsCtx.fillStyle = '#58a6ff';
    xs.forEach((xi, i) => {
      statsCtx.beginPath();
      statsCtx.arc(mx(xi), my(ys[i]), 4, 0, Math.PI * 2);
      statsCtx.fill();
    });
    if (n >= 2) {
      const lr = linRegClient(xs, ys);
      if (!lr.error) {
        const x1 = xMin, x2 = xMax;
        const y1 = lr.a * x1 + lr.b, y2 = lr.a * x2 + lr.b;
        statsCtx.strokeStyle = '#f85149';
        statsCtx.lineWidth = 2;
        statsCtx.beginPath();
        statsCtx.moveTo(mx(x1), my(y1));
        statsCtx.lineTo(mx(x2), my(y2));
        statsCtx.stroke();
      }
    }
  }
}

// --- Window modal ---
document.getElementById('windowBtn').addEventListener('click', () => {
  document.getElementById('xMin').value = state.xRange[0];
  document.getElementById('xMax').value = state.xRange[1];
  document.getElementById('yMin').value = state.yRange[0];
  document.getElementById('yMax').value = state.yRange[1];
  document.getElementById('windowModal').classList.remove('hidden');
});

document.getElementById('windowApply').addEventListener('click', () => {
  const xMin = parseFloat(document.getElementById('xMin').value);
  const xMax = parseFloat(document.getElementById('xMax').value);
  const yMin = parseFloat(document.getElementById('yMin').value);
  const yMax = parseFloat(document.getElementById('yMax').value);
  if (xMin < xMax && yMin < yMax) {
    state.xRange = [xMin, xMax];
    state.yRange = [yMin, yMax];
    redraw();
  }
  document.getElementById('windowModal').classList.add('hidden');
});

document.getElementById('windowClose').addEventListener('click', () => document.getElementById('windowModal').classList.add('hidden'));
document.getElementById('windowModal').addEventListener('click', e => {
  if (e.target.id === 'windowModal') document.getElementById('windowModal').classList.add('hidden');
});

document.getElementById('zoomFit').addEventListener('click', () => {
  state.xRange = [-10, 10];
  state.yRange = [-10, 10];
  redraw();
});

angleModeBtn.addEventListener('click', () => {
  state.angleMode = state.angleMode === 'RAD' ? 'DEG' : 'RAD';
  angleModeBtn.textContent = state.angleMode;
});

// --- Calculator keyboard ---
const CALC_KEY_MAP = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  '+': '+', '-': '-', '*': '*', '/': '/', '.': '.', '(': '(', ')': ')', '^': '^',
  'x': 'x', 'X': 'x', 'e': 'e', 'E': 'e',
};

document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea')) return;
  const mode = document.querySelector('.tab.active')?.dataset?.mode;
  if (mode === 'calc') {
    if (e.key === 'Enter') { e.preventDefault(); handleCalcAction('enter'); return; }
    if (e.key === 'Backspace') { e.preventDefault(); handleCalcAction('del'); return; }
    if (e.key === 'Escape') { handleCalcAction('clear'); return; }
    const action = CALC_KEY_MAP[e.key];
    if (action) { e.preventDefault(); handleCalcAction(action); return; }
  }
  if (mode === 'graph' && document.activeElement?.id === 'graphCanvas') {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
  }
});

// --- Init ---
buildKeypad();
setupGraphCanvas();
updateDisplay();
