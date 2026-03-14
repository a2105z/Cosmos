"""
Cosmos — TI-84 Graphing Calculator API
Python backend for expression evaluation, statistics, and regression.
"""
import math
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Cosmos Calculator API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Safe expression evaluation ---
def to_py_syntax(expr: str) -> str:
    """Convert calculator syntax to Python-safe."""
    if not expr or not isinstance(expr, str):
        return ""
    return (
        expr.replace("^", "**")
        .replace("ln(", "math.log(")
        .replace("log(", "math.log10(")
    )


def evaluate_expr(expr: str, x_val: Optional[float] = None, angle_mode: str = "RAD") -> float:
    """Safely evaluate expression. Only allows math functions."""
    transformed = to_py_syntax(expr)
    if not transformed.strip():
        raise ValueError("Empty expression")

    safe = {
        "sin": lambda v: math.sin(math.radians(v) if angle_mode == "DEG" else v),
        "cos": lambda v: math.cos(math.radians(v) if angle_mode == "DEG" else v),
        "tan": lambda v: math.tan(math.radians(v) if angle_mode == "DEG" else v),
        "sqrt": math.sqrt,
        "abs": abs,
        "exp": math.exp,
        "log": math.log10,
        "ln": math.log,
        "pi": math.pi,
        "e": math.e,
    }
    if x_val is not None:
        safe["x"] = x_val

    try:
        return eval(transformed, {"__builtins__": {}}, safe)
    except Exception as e:
        raise ValueError(str(e))


# --- Statistics (TI-84 style) ---
def one_var_stats(data: list[float]) -> dict:
    """1-Var Stats: mean, std dev, min, max, median, sum, count."""
    arr = np.array([float(x) for x in data])
    n = len(arr)
    if n < 2:
        return {"error": "Need at least 2 data points"}

    return {
        "n": n,
        "mean": float(np.mean(arr)),
        "stdDev": float(np.std(arr)),  # population std
        "stdDevS": float(np.std(arr, ddof=1)) if n > 1 else 0,  # sample std
        "min": float(np.min(arr)),
        "max": float(np.max(arr)),
        "median": float(np.median(arr)),
        "sum": float(np.sum(arr)),
        "sumSq": float(np.sum(arr**2)),
    }


def two_var_stats(x_data: list[float], y_data: list[float]) -> dict:
    """2-Var Stats for two lists."""
    x = np.array([float(v) for v in x_data])
    y = np.array([float(v) for v in y_data])
    n = min(len(x), len(y))
    if n < 2:
        return {"error": "Need at least 2 points per list"}
    x, y = x[:n], y[:n]
    return {
        "n": n,
        "meanX": float(np.mean(x)),
        "meanY": float(np.mean(y)),
        "stdDevX": float(np.std(x)),
        "stdDevY": float(np.std(y)),
        "sumX": float(np.sum(x)),
        "sumY": float(np.sum(y)),
        "sumXY": float(np.sum(x * y)),
        "sumX2": float(np.sum(x**2)),
        "sumY2": float(np.sum(y**2)),
    }


def linear_regression(x_data: list[float], y_data: list[float]) -> dict:
    """LinReg: y = ax + b"""
    from scipy import stats as scipy_stats
    x = np.array([float(v) for v in x_data])
    y = np.array([float(v) for v in y_data])
    n = min(len(x), len(y))
    if n < 2:
        return {"error": "Need at least 2 points"}
    x, y = x[:n], y[:n]
    slope, intercept, r_value, p_value, std_err = scipy_stats.linregress(x, y)
    return {
        "a": float(slope),
        "b": float(intercept),
        "r": float(r_value),
        "r2": float(r_value**2),
        "equation": f"y = {slope:.4f}x + {intercept:.4f}",
    }


# --- Pydantic models ---
class EvaluateRequest(BaseModel):
    expression: str
    x: Optional[float] = None
    angle_mode: str = "RAD"


class Stats1Request(BaseModel):
    data: list[float]


class Stats2Request(BaseModel):
    x: list[float]
    y: list[float]


# --- Routes ---
@app.get("/")
def root():
    return {"name": "Cosmos Calculator API", "status": "ok"}


@app.post("/api/evaluate")
def evaluate(req: EvaluateRequest):
    try:
        result = evaluate_expr(req.expression, req.x, req.angle_mode)
        return {"result": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/stats/1-var")
def stats_1var(req: Stats1Request):
    result = one_var_stats(req.data)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.post("/api/stats/2-var")
def stats_2var(req: Stats2Request):
    result = two_var_stats(req.x, req.y)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.post("/api/stats/linreg")
def linreg(req: Stats2Request):
    result = linear_regression(req.x, req.y)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result
