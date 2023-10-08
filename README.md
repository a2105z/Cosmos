# Cosmos

**TI-84 inspired graphing calculator in the browser** — Calculator, Graph, and Statistics (including AP Stats) modes.

**[Launch Cosmos →](https://a2105z.github.io/Cosmos/)**

## Modes

### Calculator
- Scientific functions: sin, cos, tan, log, ln, sqrt, exp, abs
- Constants π and e · RAD / DEG · Ans

### Graph
- Four function slots (y₁–y₄)
- Pan, zoom, and trace
- TI-84 style Y= editor and window settings

### Statistics
- Lists L₁–L₆
- 1-Var / 2-Var stats, LinReg with R²
- χ² tests, binomial & geometric probability
- Z / t / χ² table lookups · scatter · histogram

## Run locally

**Frontend only** (stats work client-side):

```bash
python -m http.server 8080
# open http://localhost:8080
```

**Optional Python backend:**

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Then serve the frontend as above. Backend is optional — the UI falls back to in-browser stats.

## Stack

JavaScript frontend · optional FastAPI backend · GitHub Pages deploy
