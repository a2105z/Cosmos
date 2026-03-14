/**
 * Cosmos — TI-84 Graphing Calculator
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

const GRAPH_COLORS = ['#58a6ff', '#f85149', '#3fb950', '#a371f7'];
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
    if (tab.dataset.mode === 'graph') setTimeout(redraw, 50);
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
  return expr.replace(/\^/g, '**').replace(/ln\(/g, 'LOG_').replace(/log\(/g, 'log10(').replace(/LOG_/g, 'log(');
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

function isFunction(expr) {
  return typeof expr === 'string' && expr.includes('x') && /[a-zA-Z]*x[a-zA-Z]*/.test(expr);
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
    if (isFunction(state.expression)) return;
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
  if (!expr || !isFunction(expr)) return;
  const [xMin, xMax] = state.xRange;
  const n = Math.min(600, Math.max(200, canvasWidth));
  const dx = (xMax - xMin) / n;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  let first = true;
  for (let i = 0; i <= n; i++) {
    const x = xMin + i * dx;
    const y = evaluateExpr(expr, x);
    if (y === null || !Number.isFinite(y) || y < state.yRange[0] - 20 || y > state.yRange[1] + 20) {
      first = true;
      continue;
    }
    const px = mapX(x), py = mapY(y);
    if (first) { ctx.moveTo(px, py); first = false; }
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function redraw() {
  drawGrid();
  document.querySelectorAll('.func-input').forEach((input, i) => {
    const expr = input.value.trim();
    if (expr && isFunction(expr)) plotFunction(expr, GRAPH_COLORS[i % GRAPH_COLORS.length]);
  });
}

function setupGraphCanvas() {
  canvas = graphCanvas;
  ctx = canvas.getContext('2d');
  function resize() {
    const rect = graphCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvasWidth = Math.floor(rect.width);
    canvasHeight = Math.floor(rect.height);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    redraw();
  }
  window.addEventListener('resize', resize);
  resize();
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
        if (expr && isFunction(expr)) {
          const y = evaluateExpr(expr, wx);
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
  });
  canvas.addEventListener('mouseup', e => { if (e.button === 0) state.isPanning = false; });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const f = e.deltaY > 0 ? 1.1 : 0.9;
    const [xMin, xMax] = state.xRange, [yMin, yMax] = state.yRange;
    const cx = (xMin + xMax) / 2, cy = (yMin + yMax) / 2;
    const hw = (xMax - xMin) * f / 2, hh = (yMax - yMin) * f / 2;
    state.xRange = [cx - hw, cx + hw];
    state.yRange = [cy - hh, cy + hh];
    redraw();
  }, { passive: false });
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
  const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const stdS = n > 1 ? Math.sqrt(data.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : 0;
  return {
    n, mean, stdDev: std, stdDevS: stdS,
    min: Math.min(...data), max: Math.max(...data),
    median: (() => {
      const s = [...data].sort((a, b) => a - b);
      const m = Math.floor(n / 2);
      return n % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    })(),
    sum: data.reduce((a, b) => a + b, 0),
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

document.getElementById('btn1Var').addEventListener('click', async () => {
  const data = parseList(document.getElementById('listL1').value);
  let result = API_BASE ? await callAPI('/api/stats/1-var', { data }) : oneVarClient(data);
  if (result && result.error) result = { error: result.error };
  document.getElementById('statsResults').textContent = formatStats(result || oneVarClient(data));
  drawStatsPlot();
});

document.getElementById('btn2Var').addEventListener('click', async () => {
  const x = parseList(document.getElementById('listL1').value);
  const y = parseList(document.getElementById('listL2').value);
  let result = API_BASE ? await callAPI('/api/stats/2-var', { x, y }) : twoVarClient(x, y);
  document.getElementById('statsResults').textContent = formatStats(result || twoVarClient(x, y));
  drawStatsPlot();
});

document.getElementById('btnLinReg').addEventListener('click', async () => {
  const x = parseList(document.getElementById('listL1').value);
  const y = parseList(document.getElementById('listL2').value);
  let result = API_BASE ? await callAPI('/api/stats/linreg', { x, y }) : linRegClient(x, y);
  document.getElementById('statsResults').textContent = formatStats(result || linRegClient(x, y));
  drawStatsPlot();
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
  const x = parseList(document.getElementById('listL1').value);
  const y = parseList(document.getElementById('listL2').value);
  if (x.length === 0 && y.length === 0) return;

  if (state.plotType === 'histogram' && x.length > 0) {
    const min = Math.min(...x), max = Math.max(...x);
    const bins = Math.min(10, Math.max(3, Math.ceil(Math.sqrt(x.length))));
    const step = (max - min) / bins || 1;
    const counts = Array(bins).fill(0);
    x.forEach(v => {
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

// --- Keyboard ---
document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea')) return;
  if (e.key === 'Enter') { e.preventDefault(); handleCalcAction('enter'); }
  else if (e.key === 'Backspace') { e.preventDefault(); handleCalcAction('del'); }
  else if (e.key === 'Escape') handleCalcAction('clear');
});

// --- Init ---
buildKeypad();
setupGraphCanvas();
updateDisplay();
