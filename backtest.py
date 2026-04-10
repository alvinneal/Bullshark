"""
BullShark/backtest.py
─────────────────────
Enhanced backtesting engine with realistic cost modelling and
comprehensive performance metrics.

Costs modelled
--------------
  Brokerage   : 0.03% per trade, per side
  STT         : 0.025% on sell-side only (Indian equity market)
  Slippage    : 0.05% per fill (bid-ask spread simulation)

Metrics reported
----------------
  Win rate      Profit factor     Max drawdown
  Sharpe ratio  CAGR              Avg win / avg loss
"""

import numpy as np
import pandas as pd
from BullShark.display import C


_BROKERAGE  = 0.0003    # 0.03% each way
_STT        = 0.00025   # 0.025% sell-side only (Indian equity)
_SLIPPAGE   = 0.0005    # 0.05% per fill
_RISK_FREE  = 0.065     # ~6.5% (Indian 10-yr Gsec yield)


def run(df, capital=100_000.0, sl=2.0, tp=3.0,
        brokerage=_BROKERAGE, stt=_STT, slippage=_SLIPPAGE,
        use_atr_sl=True, sl_atr_mult=1.5, tp_rr=2.0):
    """
    Simulate trades on a signal-annotated DataFrame.

    Parameters
    ----------
    df           : output of signals.generate()
    capital      : starting capital (₹)
    sl           : fixed stop-loss % – used only when use_atr_sl=False
    tp           : fixed take-profit % – used only when use_atr_sl=False
    brokerage    : fraction per side per trade
    stt          : fraction on sell side (Indian market convention)
    slippage     : fraction per fill
    use_atr_sl   : True → ATR-based dynamic SL/TP (recommended)
    sl_atr_mult  : ATR multiplier for stop-loss distance
    tp_rr        : risk/reward ratio (TP = SL_distance × tp_rr)

    Returns
    -------
    dict with keys: trades, summary, equity_curve
    """
    valid = df[df["signal"] != "WAIT"].copy()
    if len(valid) < 2:
        return {"trades": [], "summary": _empty(capital), "equity_curve": [capital]}

    trades       = []
    cash         = capital
    pos          = None
    equity_curve = [capital]

    def _cost(price, shares, side):
        n = price * shares
        c = n * (brokerage + slippage)
        if side == "sell":
            c += n * stt
        return c

    for i in range(1, len(valid)):
        r, prev, dt = valid.iloc[i], valid.iloc[i - 1], valid.index[i]

        # ── Exit logic ────────────────────────────────────────
        if pos:
            ep = er = None
            if r["low"] <= pos["stop"]:
                ep, er = pos["stop"], "sl"
            elif r["high"] >= pos["tgt"]:
                ep, er = pos["tgt"], "tp"
            elif prev["signal"] in ("SELL", "STRONG SELL"):
                ep, er = r["open"], "signal"

            if ep:
                ep_net  = ep * (1 - slippage)          # sell-side slippage
                cost    = _cost(ep_net, pos["sh"], "sell")
                pnl_net = (ep_net - pos["en"]) * pos["sh"] - pos["entry_cost"] - cost
                cash   += ep_net * pos["sh"] - cost

                trades.append({
                    "ed":   pos["dt"],
                    "xd":   dt,
                    "ep":   pos["en"],
                    "xp":   ep_net,
                    "sh":   pos["sh"],
                    "pnl":  round(pnl_net, 2),
                    "pct":  round((ep_net / pos["en"] - 1) * 100, 2),
                    "why":  er,
                    "conf": pos.get("conf", 0.0),
                })
                pos = None

        # ── Entry logic ───────────────────────────────────────
        if pos is None and prev["signal"] in ("BUY", "STRONG BUY"):
            en = r["open"] * (1 + slippage)   # buy at ask (slippage up)
            sh = int(cash * 0.95 / en)
            if sh > 0:
                entry_cost = _cost(en, sh, "buy")
                cash      -= en * sh + entry_cost

                # Dynamic or fixed SL/TP
                if use_atr_sl and not pd.isna(prev.get("atr", np.nan)):
                    sl_dist  = float(prev["atr"]) * sl_atr_mult
                    sl_price = round(en - sl_dist, 2)
                    tp_price = round(en + sl_dist * tp_rr, 2)
                else:
                    sl_price = en * (1 - sl / 100)
                    tp_price = en * (1 + tp / 100)

                pos = {
                    "en":         en,
                    "dt":         dt,
                    "sh":         sh,
                    "stop":       sl_price,
                    "tgt":        tp_price,
                    "entry_cost": entry_cost,
                    "conf":       float(prev.get("confidence", 0.0)),
                }

        # Mark-to-market equity (current close × held shares)
        mtm = r["close"] * pos["sh"] if pos else 0.0
        equity_curve.append(round(cash + mtm, 2))

    # ── Close open position at last bar ──────────────────────
    if pos:
        f       = valid.iloc[-1]["close"]
        ep_net  = f * (1 - slippage)
        cost    = _cost(ep_net, pos["sh"], "sell")
        pnl_net = (ep_net - pos["en"]) * pos["sh"] - pos["entry_cost"] - cost
        cash   += ep_net * pos["sh"] - cost
        trades.append({
            "ed":   pos["dt"],
            "xd":   valid.index[-1],
            "ep":   pos["en"],
            "xp":   ep_net,
            "sh":   pos["sh"],
            "pnl":  round(pnl_net, 2),
            "pct":  round((ep_net / pos["en"] - 1) * 100, 2),
            "why":  "open",
            "conf": pos.get("conf", 0.0),
        })

    equity_curve.append(round(cash, 2))

    return {
        "trades":       trades,
        "summary":      _metrics(trades, capital, cash, equity_curve, df),
        "equity_curve": equity_curve,
    }


# ── Metrics ────────────────────────────────────────────────────

def _metrics(trades, capital, final_cash, equity_curve, df):
    w = [t for t in trades if t["pnl"] > 0]
    l = [t for t in trades if t["pnl"] <= 0]
    n = len(trades)

    wr = round(len(w) / n * 100, 1) if n else 0.0

    # Profit factor
    gp = sum(t["pnl"] for t in w)
    gl = abs(sum(t["pnl"] for t in l))
    pf = round(gp / gl, 2) if gl > 0 else float("inf")

    # Max drawdown
    eq   = np.array(equity_curve, dtype=float)
    peak = np.maximum.accumulate(eq)
    dd   = (eq - peak) / np.where(peak == 0, 1, peak) * 100
    mdd  = round(float(dd.min()), 2)

    # Sharpe ratio (annualised)
    eq_s     = pd.Series(equity_curve, dtype=float)
    daily_r  = eq_s.pct_change().dropna()
    rf_daily = _RISK_FREE / 252
    sharpe   = round(
        (daily_r.mean() - rf_daily) / daily_r.std() * np.sqrt(252), 2
    ) if daily_r.std() > 0 else 0.0

    # CAGR
    n_years = max(len(df) / 252, 0.01)
    cagr    = round(((final_cash / capital) ** (1 / n_years) - 1) * 100, 2)

    ret = round((final_cash / capital - 1) * 100, 2)

    return {
        "start":  capital,
        "final":  round(final_cash, 2),
        "ret":    ret,
        "cagr":   cagr,
        "n":      n,
        "w":      len(w),
        "l":      len(l),
        "wr":     wr,
        "aw":     round(np.mean([t["pct"] for t in w]), 2) if w else 0.0,
        "al":     round(np.mean([t["pct"] for t in l]), 2) if l else 0.0,
        "pf":     pf,
        "mdd":    mdd,
        "sharpe": sharpe,
    }


def display(results):
    s  = results["summary"]
    rc = C.G if s["ret"] >= 0 else C.RD

    print(f"  {C.B}BACKTEST{C.R}  "
          f"Rs.{s['start']:,.0f} -> Rs.{s['final']:,.0f} "
          f"{rc}({s['ret']:+.2f}%){C.R}  "
          f"CAGR {rc}{s['cagr']:+.2f}%{C.R}")
    print(f"  Trades: {s['n']}  "
          f"Win: {C.G}{s['w']}{C.R}  "
          f"Loss: {C.RD}{s['l']}{C.R}  "
          f"Rate: {s['wr']}%  "
          f"Avg W/L: {C.G}{s['aw']:+.2f}%{C.R}/{C.RD}{s['al']:+.2f}%{C.R}")
    pf_c = C.G if s["pf"] > 1 else C.RD
    sh_c = C.G if s["sharpe"] > 1 else C.Y
    print(f"  Profit Factor: {pf_c}{s['pf']}{C.R}  "
          f"Max Drawdown: {C.RD}{s['mdd']:.2f}%{C.R}  "
          f"Sharpe: {sh_c}{s['sharpe']}{C.R}\n")

    for t in results["trades"]:
        e = t["ed"].strftime("%Y-%m-%d") if hasattr(t["ed"], "strftime") else str(t["ed"])
        x = t["xd"].strftime("%Y-%m-%d") if hasattr(t["xd"], "strftime") else str(t["xd"])
        tc = C.G if t["pnl"] >= 0 else C.RD
        print(f"  {e}->{x}  "
              f"{tc}Rs.{t['pnl']:>+9,.2f} ({t['pct']:>+.2f}%){C.R}  "
              f"{t['why']}")
    print()


def _empty(c):
    return {
        "start": c, "final": c, "ret": 0.0, "cagr": 0.0,
        "n": 0, "w": 0, "l": 0, "wr": 0.0,
        "aw": 0.0, "al": 0.0, "pf": 0.0, "mdd": 0.0, "sharpe": 0.0,
    }
