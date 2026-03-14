# Cosmos

A pure TI-84 graphing calculator — Calculator, Graph, and Statistics modes with a Python backend and professional web interface.

**[Launch Cosmos →](https://a2105z.github.io/GraphForge/)**

## Features

### Calculator
- Scientific: sin, cos, tan, log, ln, sqrt, exp, abs
- Constants: π, e
- RAD / DEG modes
- Ans key

### Graph
- 4 function slots (y₁–y₄)
- Pan (drag), zoom (scroll), trace (hover)
- Window settings
- TI-84 Y= editor style

### Statistics
- Data editor: L₁, L₂ (comma or space separated)
- 1-Var Stats: mean, std dev, min, max, median, sum
- 2-Var Stats: means, std devs, sums
- LinReg: linear regression with R²
- Scatter plot with regression line
- Histogram

## Run locally

### Frontend only (no backend)
```bash
python -m http.server 8080
# Open http://localhost:8080
```
Statistics work fully in the browser (client-side fallback).

### Full stack (with Python backend)
```bash
# Terminal 1: Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2: Frontend
python -m http.server 8080
```
Then open `http://localhost:8080` and set `COSMOS_API = 'http://localhost:8000'` in the console if you want to use the backend (optional; stats work client-side).

## Project structure

```
├── index.html
├── styles.css
├── app.js
├── backend/
│   ├── main.py      # FastAPI: /api/evaluate, /api/stats/*
│   └── requirements.txt
└── README.md
```

## API (Python backend)

| Endpoint | Body | Returns |
|----------|------|---------|
| `POST /api/evaluate` | `{expression, x?, angle_mode?}` | `{result}` |
| `POST /api/stats/1-var` | `{data: number[]}` | n, mean, stdDev, min, max, median, sum |
| `POST /api/stats/2-var` | `{x: number[], y: number[]}` | n, meanX, meanY, ... |
| `POST /api/stats/linreg` | `{x: number[], y: number[]}` | a, b, r, r², equation |

## Deploy

- **Frontend:** GitHub Pages (automatic via Actions)
- **Backend:** Deploy to Render, Railway, or similar; set `COSMOS_API` in frontend
