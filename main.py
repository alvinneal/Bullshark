#!/usr/bin/env python3
"""
BullShark — Built to Detect. Designed to Strike.

python -m BullShark.main                              # latest signal
python -m BullShark.main --all                        # all outputs
python -m BullShark.main --htf                        # weekly HTF filter
python -m BullShark.main --calibrate                  # walk-forward OOS
python -m BullShark.main --backtest --capital 500000
python -m BullShark.main --ema-fast 12 --ema-slow 26 --rsi-oversold 30
"""

import argparse
from BullShark import data, signals, backtest, display


def main():
    p = argparse.ArgumentParser(description="BullShark")
    p.add_argument("--recent",    action="store_true", help="Show recent bars")
    p.add_argument("--stats",     action="store_true", help="Signal distribution")
    p.add_argument("--backtest",  action="store_true", help="Run backtest")
    p.add_argument("--calibrate", action="store_true", help="Walk-forward OOS validation")
    p.add_argument("--htf",       action="store_true", help="Enable weekly HTF bias filter")
    p.add_argument("--all",       action="store_true", help="Enable all outputs + HTF + calibrate")

    # Data
    p.add_argument("--period",        default="1y")
    p.add_argument("--interval",      default="1d")
    p.add_argument("--htf-period",    default="2y")
    p.add_argument("--htf-interval",  default="1wk")

    # Indicators
    p.add_argument("--ema-fast",       type=int,   default=9)
    p.add_argument("--ema-slow",       type=int,   default=21)
    p.add_argument("--rsi-period",     type=int,   default=14)
    p.add_argument("--rsi-oversold",   type=int,   default=35)
    p.add_argument("--rsi-overbought", type=int,   default=65)
    p.add_argument("--vwap-period",    type=int,   default=20)
    p.add_argument("--adx-period",     type=int,   default=14)
    p.add_argument("--atr-period",     type=int,   default=14)

    # Trade sizing
    p.add_argument("--capital",     type=float, default=100_000)
    p.add_argument("--sl",          type=float, default=2.0,
                   help="Fixed SL %% (only if --no-atr-sl)")
    p.add_argument("--tp",          type=float, default=3.0,
                   help="Fixed TP %% (only if --no-atr-sl)")
    p.add_argument("--sl-atr-mult", type=float, default=1.5,
                   help="ATR multiplier for stop-loss")
    p.add_argument("--tp-rr",       type=float, default=2.0,
                   help="Risk/reward ratio for take-profit")
    p.add_argument("--no-atr-sl",   action="store_true",
                   help="Use fixed SL/TP instead of ATR-based")

    p.add_argument("--days", type=int, default=10, help="Bars for --recent")
    a = p.parse_args()

    cfg = {
        "ema_fast":       a.ema_fast,
        "ema_slow":       a.ema_slow,
        "rsi_period":     a.rsi_period,
        "rsi_oversold":   a.rsi_oversold,
        "rsi_overbought": a.rsi_overbought,
        "vwap_period":    a.vwap_period,
        "adx_period":     a.adx_period,
        "atr_period":     a.atr_period,
        "sl_atr_mult":    a.sl_atr_mult,
        "tp_rr":          a.tp_rr,
    }

    # ── Load data ────────────────────────────────────────────────
    htf_df = None
    if a.htf or a.all:
        df, htf_df = data.load_multi(
            a.period, a.interval, a.htf_period, a.htf_interval
        )
    else:
        df = data.load(a.period, a.interval)

    display.header(cfg, a.interval, a.period)

    # ── Walk-forward calibration ─────────────────────────────────
    calibrator = None
    if a.calibrate or a.all:
        from BullShark.calibration import walk_forward, build_calibrator
        print(f"  {display.C.B}Walk-Forward Validation{display.C.R}")
        wf = walk_forward(df, signals.generate, cfg)
        if "error" in wf:
            print(f"  {display.C.RD}{wf['error']}{display.C.R}\n")
        else:
            print(
                f"  Folds: {wf['n_folds']}  "
                f"OOS Accuracy: {display.C.CN}{wf['oos_accuracy']}%{display.C.R}  "
                f"OOS Trades: {wf['oos_trades']}"
            )
            for fold in wf["folds"]:
                print(
                    f"    Fold {fold['fold']}: "
                    f"{fold['accuracy']}% accuracy  "
                    f"({fold['n_signals']} signals, "
                    f"{fold['test_bars']} bars)"
                )
            print()
        calibrator = build_calibrator(df, signals.generate, cfg)
        if calibrator is None:
            print(f"  {display.C.Y}Calibrator: insufficient data, using heuristic.{display.C.R}\n")

    # ── Generate signals ─────────────────────────────────────────
    df = signals.generate(df, cfg, htf_df=htf_df, calibrator=calibrator)
    display.latest(df, cfg)

    if a.recent or a.all:
        display.recent(df, a.days)
    if a.stats or a.all:
        display.stats(df)
    if a.backtest or a.all:
        results = backtest.run(
            df, a.capital, a.sl, a.tp,
            use_atr_sl=not a.no_atr_sl,
            sl_atr_mult=a.sl_atr_mult,
            tp_rr=a.tp_rr,
        )
        backtest.display(results)

    display.disclaimer()


if __name__ == "__main__":
    main()
