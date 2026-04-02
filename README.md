# Radiv

**Your Radar for Derivatives**

A Nifty 50 options signal engine that generates BUY/SELL recommendations using technical indicators. Built from the ground up as a learning project.

## Current State

| Indicator | Status |
|-----------|--------|
| EMA Crossover (9/21) | ✅ Live |
| RSI | ⬜ Next |
| MACD | ⬜ Planned |
| Bollinger Bands | ⬜ Planned |
| Supertrend | ⬜ Planned |
| VWAP | ⬜ Planned |

## Setup

```bash
pip install yfinance pandas numpy
```

## Usage

```bash
python -m Radiv.main                # latest signal (default)
python -m Radiv.main --backtest     # + backtest results
```

## Project Structure

```
Radiv/
├── __init__.py        # package init
├── data.py            # fetches Nifty 50 OHLCV via yfinance
├── indicators.py      # pure indicator math (EMA, RSI, ...)
├── signals.py         # combines indicators into BUY/SELL/HOLD
├── backtest.py        # simulates trades on historical data
├── display.py         # terminal output
└── main.py            # entry point
```

## How It Works

1. **data.py** pulls Nifty 50 daily candles from Yahoo Finance
2. **indicators.py** computes technical indicators on the price data
3. **signals.py** applies trading logic to generate signals
4. **backtest.py** simulates how those signals would have performed
5. **display.py** formats everything for the terminal

Each file has one job. Indicators don't know about signals. Signals don't know about backtesting. Backtesting doesn't know how signals are generated.

## Disclaimer

This is an educational project. Not financial advice. Derivative trading carries substantial risk of loss. Always do your own research and consult a qualified financial advisor before trading.
