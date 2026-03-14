/**
 * GraphForge — A TI-84 inspired, Desmos-like graphing calculator
 */

const state = {
  expression: '',
  lastAnswer: 0,
  angleMode: 'RAD',
  xRange: [-10, 10],
  yRange: [-10, 10],
  isPanning: false,
  panStart: { x: 0, y: 0 },
  rangeStart: { x: [-10, 10], y: [-10, 10] },
};

const GRAPH_COLORS = ['#2D6FF7', '#E52527', '#0FA958', '#9331F7'];
const GRID_COLOR = 'rgba(255,255,255,0.08)';
const AXES_COLOR = 'rgba(255,255,255,0.4)';

let canvas, ctx, canvasWidth, canvasHeight;

const exprDisplay = document.getElementById('exprDisplay');
const resultDisplay = document.getElementById('resultDisplay');
const graphCanvas = document.getElementById('graphCanvas');
const traceTooltip = document.getElementById('traceTooltip');
const coordDisplay = document.getElementById('coordDisplay');
const angleModeBtn = document.getElementById('angleMode');
const windowModal = document.getElementById('windowModal');
const windowBtn = document.getElementById('windowBtn');
const zoomFitBtn = document.getElementById('zoomFit');
const windowApplyBtn = document.getElementById('windowApply');
const windowCloseBtn = document.getElementById('windowClose');

function toMathJS(expr) {
  if (!expr || typeof expr !== 'string') return '';
  return expr
    .replace(/\*\*/g, '^')
    .replace(/ln\(/g, 'LOG_')
    .replace(/log\(/g, 'log10(')
    .replace(/LOG_/g, 'log(');
}

function evaluateExpr(expr, xVal = null) {
  const transformed = toMathJS(expr);
  if (!transformed.trim()) return null;
  try {
    const scope = {
      pi: Math.PI,
      e: Math.E,
      sin: (v) => Math.sin(state.angleMode === 'DEG' ? (v * Math.PI) / 180 : v),
      cos: (v) => Math.cos(state.angleMode === 'DEG' ? (v * Math.PI) / 180 : v),
      tan: (v) => Math.tan(state.angleMode === 'DEG' ? (v * Math.PI) / 180 : v),
      sqrt: math.sqrt,
      abs: math.abs,
      exp: math.exp,
    };
    if (xVal !== null) scope.x = xVal;
    const node = math.parse(transformed);
    return node.compile().evaluate(scope);
  } catch {
    return null;
  }
}

function isFunction(expr) {
  return /[a-zA-Z]*x[a-zA-Z]*/.test(expr) && expr.includes('x');
}

function mapX(x) {
  const [xMin, xMax] = state.xRange;
  return ((x - xMin) / (xMax - xMin)) * canvasWidth;
}

function mapY(y) {
  const [yMin, yMax] = state.yRange;
  return canvasHeight - ((y - yMin) / (yMax - yMin)) * canvasHeight;
}

function toWorldX(px) {
  const [xMin, xMax] = state.xRange;
  return xMin + (px / canvasWidth) * (xMax - xMin);
}

function toWorldY(py) {
  const [yMin, yMax] = state.yRange;
  return yMax - (py / canvasHeight) * (yMax - yMin);
}

function drawGrid() {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  const [xMin, xMax] = state.xRange;
  const [yMin, yMax] = state.yRange;

  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 0.5;
  const xStep = (xMax - xMin) / 20;
  const yStep = (yMax - yMin) / 20;
  for (let i = 0; i <= 20; i++) {
    const x = xMin + i * xStep;
    const px = mapX(x);
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, canvasHeight);
    ctx.stroke();
  }
  for (let i = 0; i <= 20; i++) {
    const y = yMin + i * yStep;
    const py = mapY(y);
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(canvasWidth, py);
    ctx.stroke();
  }

  ctx.strokeStyle = AXES_COLOR;
  ctx.lineWidth = 1.5;
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

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '10px "JetBrains Mono"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const x0 = mapX(0);
  const y0 = mapY(0);
  for (let v = Math.ceil(xMin); v <= Math.floor(xMax); v += Math.max(1, Math.ceil((xMax - xMin) / 10))) {
    const px = mapX(v);
    if (px >= 0 && px <= canvasWidth)
      ctx.fillText(v === 0 ? 'O' : String(v), px, y0 + 4);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let v = Math.ceil(yMin); v <= Math.floor(yMax); v += Math.max(1, Math.ceil((yMax - yMin) / 10))) {
    const py = mapY(v);
    if (py >= 0 && py <= canvasHeight)
      ctx.fillText(v === 0 ? 'O' : String(v), x0 - 6, py);
  }
}

function plotFunction(expr, color) {
  if (!expr || !isFunction(expr)) return;
  const [xMin, xMax] = state.xRange;
  const numPoints = Math.min(800, Math.max(300, canvasWidth));
  const dx = (xMax - xMin) / numPoints;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();

  let first = true;
  for (let i = 0; i <= numPoints; i++) {
    const x = xMin + i * dx;
    const y = evaluateExpr(expr, x);
    if (y === null || !Number.isFinite(y) || y < state.yRange[0] - 10 || y > state.yRange[1] + 10) {
      first = true;
      continue;
    }
    const px = mapX(x);
    const py = mapY(y);
    if (first) {
      ctx.moveTo(px, py);
      first = false;
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.stroke();
}

function redraw() {
  drawGrid();
  document.querySelectorAll('.func-input').forEach((input, i) => {
    const expr = input.value.trim();
    if (expr && isFunction(expr)) {
      plotFunction(expr, GRAPH_COLORS[i % GRAPH_COLORS.length]);
    }
  });
}

function updateDisplay() {
  exprDisplay.textContent = state.expression || '';
  resultDisplay.textContent = state.expression ? '' : String(state.lastAnswer);
}

function appendToExpr(value) {
  state.expression += value;
  updateDisplay();
}

function clearAll() {
  state.expression = '';
  updateDisplay();
  redraw();
}

function deleteLast() {
  state.expression = state.expression.slice(0, -1);
  updateDisplay();
  redraw();
}

function enter() {
  if (!state.expression.trim()) return;
  if (isFunction(state.expression)) {
    redraw();
    return;
  }
  const result = evaluateExpr(state.expression);
  if (result !== null && Number.isFinite(result)) {
    state.lastAnswer = result;
    state.expression = String(result);
    updateDisplay();
  } else {
    state.expression = 'Error';
    updateDisplay();
  }
  redraw();
}

function insertAns() {
  appendToExpr(String(state.lastAnswer));
}

function setupKeypad() {
  document.querySelectorAll('.keypad .btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'clear') clearAll();
      else if (action === 'del') deleteLast();
      else if (action === 'enter') enter();
      else if (action === 'ans') insertAns();
      else appendToExpr(action);
    });
  });
}

function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea')) return;
    if (e.key === 'Enter') { e.preventDefault(); enter(); }
    else if (e.key === 'Backspace') { e.preventDefault(); deleteLast(); }
    else if (e.key === 'Escape') clearAll();
    else if (/[0-9+\-*/.^()]/.test(e.key) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      appendToExpr(e.key === '*' ? '*' : e.key === '/' ? '/' : e.key);
    }
  });
}

function setupCanvas() {
  canvas = graphCanvas;
  ctx = canvas.getContext('2d');

  function resize() {
    const rect = graphCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvasWidth = Math.floor(rect.width);
    canvasHeight = Math.floor(rect.height);
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.scale(dpr, dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    redraw();
  }

  window.addEventListener('resize', resize);
  resize();

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      state.isPanning = true;
      state.panStart = { x: e.offsetX, y: e.offsetY };
      state.rangeStart = { x: [...state.xRange], y: [...state.yRange] };
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const worldX = toWorldX(e.offsetX);
    const worldY = toWorldY(e.offsetY);
    coordDisplay.textContent = `x: ${worldX.toFixed(2)}  y: ${worldY.toFixed(2)}`;

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
      let traceText = '';
      document.querySelectorAll('.func-input').forEach((input, i) => {
        const expr = input.value.trim();
        if (expr && isFunction(expr)) {
          const y = evaluateExpr(expr, worldX);
          if (y !== null && Number.isFinite(y)) {
            traceText += `y${i + 1}: (${worldX.toFixed(2)}, ${y.toFixed(2)})\n`;
          }
        }
      });
      if (traceText) {
        traceTooltip.textContent = traceText.trim();
        traceTooltip.classList.remove('hidden');
        traceTooltip.style.left = (e.clientX + 12) + 'px';
        traceTooltip.style.top = (e.clientY + 12) + 'px';
      } else {
        traceTooltip.classList.add('hidden');
      }
    }
  });

  canvas.addEventListener('mouseleave', () => {
    state.isPanning = false;
    traceTooltip.classList.add('hidden');
  });

  canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) state.isPanning = false;
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    const [xMin, xMax] = state.xRange;
    const [yMin, yMax] = state.yRange;
    const cx = (xMin + xMax) / 2;
    const cy = (yMin + yMax) / 2;
    const halfW = (xMax - xMin) * factor / 2;
    const halfH = (yMax - yMin) * factor / 2;
    state.xRange = [cx - halfW, cx + halfW];
    state.yRange = [cy - halfH, cy + halfH];
    redraw();
  }, { passive: false });
}

function setupFunctionInputs() {
  document.querySelectorAll('.func-input').forEach((input) => {
    input.addEventListener('input', () => redraw());
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') redraw(); });
  });
}

angleModeBtn.addEventListener('click', () => {
  state.angleMode = state.angleMode === 'RAD' ? 'DEG' : 'RAD';
  angleModeBtn.textContent = state.angleMode;
});

windowBtn.addEventListener('click', () => {
  document.getElementById('xMin').value = state.xRange[0];
  document.getElementById('xMax').value = state.xRange[1];
  document.getElementById('yMin').value = state.yRange[0];
  document.getElementById('yMax').value = state.yRange[1];
  windowModal.classList.remove('hidden');
});

windowApplyBtn.addEventListener('click', () => {
  const xMin = parseFloat(document.getElementById('xMin').value);
  const xMax = parseFloat(document.getElementById('xMax').value);
  const yMin = parseFloat(document.getElementById('yMin').value);
  const yMax = parseFloat(document.getElementById('yMax').value);
  if (xMin < xMax && yMin < yMax) {
    state.xRange = [xMin, xMax];
    state.yRange = [yMin, yMax];
    redraw();
  }
  windowModal.classList.add('hidden');
});

windowCloseBtn.addEventListener('click', () => windowModal.classList.add('hidden'));
windowModal.addEventListener('click', (e) => {
  if (e.target === windowModal) windowModal.classList.add('hidden');
});

zoomFitBtn.addEventListener('click', () => {
  state.xRange = [-10, 10];
  state.yRange = [-10, 10];
  redraw();
});

setupKeypad();
setupKeyboard();
setupCanvas();
setupFunctionInputs();
updateDisplay();
