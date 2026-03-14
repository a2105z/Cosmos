# GraphForge

A modern, TI-84 inspired graphing calculator — clean like Desmos, with the feel of a classic calculator. Built as a lightweight web app.

**[Launch GraphForge →](https://a2105z.github.io/GraphForge/)**

![GraphForge](https://img.shields.io/badge/GraphForge-Graphing%20Calculator-00C853)

## Features

- **Dual mode** — Scientific calculator + graphing
- **Multiple functions** — Graph up to 4 functions (y₁–y₄) simultaneously
- **Desmos-like interactions** — Pan (drag), zoom (scroll wheel), trace (hover)
- **Window settings** — Customize X/Y ranges
- **Scientific functions** — sin, cos, tan, log, ln, sqrt, exp, abs
- **Angle modes** — RAD / DEG
- **TI-84 aesthetic** — Dark gray keypad, clean display

## Run locally

```bash
# Serve with Python
python -m http.server 8080

# Or with Node
npx serve .
```

## Syntax

| Input | Meaning |
|-------|---------|
| `^` or `**` | Power |
| `sin`, `cos`, `tan` | Trig (respects RAD/DEG) |
| `log` | Base-10 logarithm |
| `ln` | Natural logarithm |
| `sqrt`, `abs`, `exp` | Standard functions |
| `pi`, `e` | Constants |

## Deploy

This repo is set up for GitHub Pages. Push to `main` and enable Pages:

1. **Settings** → **Pages**
2. **Source:** Deploy from a branch
3. **Branch:** `main`, **Folder:** `/ (root)`

Live at: `https://a2105z.github.io/GraphForge/`
