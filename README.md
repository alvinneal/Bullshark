# BullShark

**Built to Detect. Designed to Strike.**

Nifty 50 signal engine using a weighted scoring system across multiple technical indicators.

## Indicators

| Indicator | Status | What it does |
|-----------|--------|-------------|
| EMA Crossover | ✅ | Trend direction via fast/slow moving average crossovers |
| RSI | ✅ | Momentum — detects oversold/overbought conditions |
| VWAP | ✅ | Volume-weighted fair value — price vs institutional average |
| MACD | ⬜ | Planned |
| Bollinger Bands | ⬜ | Planned |

## How Signals Work

Each indicator produces a score from -1.0 (max bearish) to +1.0 (max bullish). These are combined using configurable weights:

```
Score = (EMA × 0.40) + (RSI × 0.35) + (VWAP × 0.25)
```

| Score | Signal |
|-------|--------|
| ≥ +0.45 | STRONG BUY |
| +0.15 to +0.45 | BUY |
| -0.15 to +0.15 | HOLD |
| -0.45 to -0.15 | SELL |
| ≤ -0.45 | STRONG SELL |

## Setup

```bash
pip install yfinance pandas numpy
```

## Backend Usage

```bash
python -m BullShark.main                    # latest signal
python -m BullShark.main --all              # everything
python -m BullShark.main --ema-fast 12 --ema-slow 26
python -m BullShark.main --rsi-oversold 25 --rsi-overbought 75
python -m BullShark.main --vwap-period 30
python -m BullShark.main --backtest --capital 500000
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

## Project Structure

```
BullShark/
├── __init__.py
├── data.py            # Nifty 50 OHLCV via yfinance
├── indicators.py      # EMA, RSI, VWAP math
├── signals.py         # Weighted scoring system
├── backtest.py        # Trade simulation
├── display.py         # CLI output
├── main.py            # Entry point
└── frontend/          # React + Vite dashboard
```

## Disclaimer

Educational project. Not financial advice. Derivative trading carries substantial risk.