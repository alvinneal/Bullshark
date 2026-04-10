"""
BullShark/signals.py
────────────────────
Statistically robust signal engine.

Each bar is evaluated through a layered filter stack:

  1. Warmup gate         – skip until all indicators are ready
  2. Regime filter       – block signals in RANGING / VOLATILE markets
  3. Weighted score      – EMA × 0.40 + RSI × 0.35 + VWAP × 0.25
  4. Signal quality gate – RSI in 40–60 neutral zone → score dampened
  5. Structure check     – HH/HL or LH/LL must align with signal direction
  6. HTF bias filter     – weekly EMA must not oppose trade direction
  7. ATR-based SL / TP  – dynamic levels (no hardcoded % constants)
  8. Confidence output   – calibrated probability or heuristic fallback

Per-bar output columns (in addition to all indicator values):
  signal      : STRONG BUY | BUY | HOLD | SELL | STRONG SELL | WAIT
  confidence  : float 0–100 (% probability of positive return)
  score       : raw composite score (−1.0 to +1.0)
  entry       : signal price (current close)
  stop_loss   : ATR-based stop (NaN for HOLD/WAIT)
  take_profit : ATR-based target at configured R:R (NaN for HOLD/WAIT)
  regime      : TRENDING | NEUTRAL | RANGING | VOLATILE | UNKNOWN
  htf_trend   : BULL | BEAR | UNKNOWN (weekly EMA direction)
  reason      : human-readable explanation string
"""

import numpy as np
import pandas as pd

from BullShark.indicators import (
    ema_crossover, rsi, vwap,
    support_resistance,
)
from BullShark import regime as _regime


DEFAULT_CONFIG = {
    # Core indicators
    "ema_fast":        9,
    "ema_slow":        21,
    "rsi_period":      14,
    "rsi_oversold":    35,
    "rsi_overbought":  65,
    "vwap_period":     20,

    # Indicator weights (must sum to 1.0 for a normalised score)
    "w_ema":  0.40,
    "w_rsi":  0.35,
    "w_vwap": 0.25,

    # Regime / volatility detection
    "adx_period": 14,
    "atr_period": 14,
    "vol_period": 20,

    # Signal thresholds (calibrate via walk-forward, not by feel)
    "strong_buy_th":  0.45,
    "buy_th":         0.15,
    "sell_th":       -0.15,
    "strong_sell_th": -0.45,

    # RSI quality filter: RSI in [min, max] → neutral, score contribution = 0
    # RSI in 40–60 has no meaningful momentum edge
    "rsi_min_active": 40,
    "rsi_max_active": 60,

    # ATR-based SL / TP multipliers
    "sl_atr_mult": 1.5,   # stop  = entry ± (ATR × 1.5)
    "tp_rr":       2.0,   # target = entry ± (SL_distance × 2.0)  → 2:1 R:R

    # Higher-timeframe EMA periods (applied to weekly data)
    "htf_ema_fast": 9,
    "htf_ema_slow": 21,
}


# ── PUBLIC API ─────────────────────────────────────────────────

def generate(df, config=None, htf_df=None, calibrator=None):
    """
    Generate signals for every bar in df.

    Parameters
    ----------
    df         : primary OHLCV DataFrame
    config     : dict – overrides for DEFAULT_CONFIG keys
    htf_df     : optional higher-timeframe DataFrame (weekly)
    calibrator : optional callable from calibration.build_calibrator()
                 maps score → float probability (0–100)

    Returns
    -------
    DataFrame with original columns plus all signal and indicator fields.
    """
    cfg = {**DEFAULT_CONFIG, **(config or {})}
    df  = df.copy()

    # ── Primary indicators ─────────────────────────────────────
    cross = ema_crossover(df["close"], cfg["ema_fast"], cfg["ema_slow"])
    rsi_s = rsi(df["close"], cfg["rsi_period"])
    vw    = vwap(df, cfg["vwap_period"])
    reg   = _regime.detect(df, cfg["adx_period"], cfg["atr_period"], cfg["vol_period"])
    sr    = support_resistance(df)

    df["ema_fast"]    = cross["ema_fast"]
    df["ema_slow"]    = cross["ema_slow"]
    df["ema_bullish"] = cross["ema_bullish"]
    df["ema_bearish"] = cross["ema_bearish"]
    df["ema_trend"]   = cross["ema_trend"]
    df["ema_gap"]     = cross["ema_gap"]
    df["rsi"]         = rsi_s
    df["vwap"]        = vw["vwap"]
    df["vwap_dist"]   = vw["vwap_dist"]
    df["regime"]      = reg["regime"]
    df["trade_ok"]    = reg["trade_ok"]
    df["adx"]         = reg["adx"]
    df["plus_di"]     = reg["plus_di"]
    df["minus_di"]    = reg["minus_di"]
    df["atr"]         = reg["atr"]
    df["atr_pct"]     = reg["atr_pct"]
    df["structure"]   = reg["structure"]
    df["support"]     = sr["support"]
    df["resistance"]  = sr["resistance"]

    # ── Higher-timeframe bias ──────────────────────────────────
    df["htf_trend"] = _htf_bias(df, htf_df, cfg)

    # ── Per-bar signal generation ──────────────────────────────
    signals, reasons, scores = [], [], []
    confidences, entries, stop_losses, take_profits = [], [], [], []

    for i in range(len(df)):
        row = df.iloc[i]

        # 1. Warmup gate
        if pd.isna(row["rsi"]) or pd.isna(row["vwap"]) or \
           pd.isna(row["ema_slow"]) or pd.isna(row["adx"]):
            _append_wait(signals, reasons, scores, confidences,
                         entries, stop_losses, take_profits, row["close"])
            continue

        parts = []
        ema_score = rsi_score = vwap_score = 0.0

        # ── EMA score ─────────────────────────────────────────
        if row["ema_bullish"]:
            ema_score = 1.0
            parts.append(f"EMA {cfg['ema_fast']} crossed up {cfg['ema_slow']}")
        elif row["ema_bearish"]:
            ema_score = -1.0
            parts.append(f"EMA {cfg['ema_fast']} crossed dn {cfg['ema_slow']}")
        elif row["ema_trend"] == "BULL":
            ema_score = min(0.6, abs(row["ema_gap"]) / 2)
            parts.append(f"EMA bull {row['ema_gap']:+.2f}%")
        else:
            ema_score = -min(0.6, abs(row["ema_gap"]) / 2)
            parts.append(f"EMA bear {row['ema_gap']:+.2f}%")

        # ── RSI score (with quality filter) ───────────────────
        rv      = row["rsi"]
        os_, ob = cfg["rsi_oversold"], cfg["rsi_overbought"]
        rsi_lo, rsi_hi = cfg["rsi_min_active"], cfg["rsi_max_active"]

        if rv <= os_:
            depth     = (os_ - rv) / os_
            rsi_score = 0.5 + depth * 0.5
            parts.append(f"RSI {rv:.0f} oversold")
        elif rv >= ob:
            depth     = (rv - ob) / (100 - ob)
            rsi_score = -(0.5 + depth * 0.5)
            parts.append(f"RSI {rv:.0f} overbought")
        elif rv < rsi_lo:
            rsi_score = (rv - 50) / 50 * 0.3
            parts.append(f"RSI {rv:.0f} weak-bear")
        elif rv > rsi_hi:
            rsi_score = (rv - 50) / 50 * 0.3
            parts.append(f"RSI {rv:.0f} weak-bull")
        else:
            # 40–60 no-trade zone: zero RSI contribution
            rsi_score = 0.0
            parts.append(f"RSI {rv:.0f} neutral")

        # ── VWAP score ────────────────────────────────────────
        vd = row["vwap_dist"]
        if not pd.isna(vd):
            vwap_score = float(np.clip(vd / 2, -1.0, 1.0))
            parts.append(f"VWAP {'above' if vd > 0 else 'below'} {vd:+.2f}%")

        # ── Composite score ───────────────────────────────────
        total = round(
            ema_score  * cfg["w_ema"] +
            rsi_score  * cfg["w_rsi"] +
            vwap_score * cfg["w_vwap"],
            3,
        )

        # 2. Regime filter
        regime   = row["regime"]
        trade_ok = bool(row["trade_ok"])

        if not trade_ok:
            parts.append(f"blocked:{regime.lower()}")
            _append(signals, reasons, scores, confidences,
                    entries, stop_losses, take_profits,
                    "HOLD", " | ".join(parts), total, 0.0,
                    row["close"], np.nan, np.nan)
            continue

        # 3. Raw signal mapping
        sig = _score_to_signal(total, cfg)

        # 4. Price structure confirmation
        structure = row["structure"]
        if sig in ("BUY", "STRONG BUY") and structure == "BEAR":
            sig = "HOLD"
            parts.append("struct-bear->downgraded")
        elif sig in ("SELL", "STRONG SELL") and structure == "BULL":
            sig = "HOLD"
            parts.append("struct-bull->downgraded")
        elif structure != "NEUTRAL":
            parts.append(f"struct {structure.lower()}")

        # 5. HTF bias filter
        htf = str(row["htf_trend"])
        if htf not in ("UNKNOWN", "nan"):
            if sig in ("BUY", "STRONG BUY") and htf == "BEAR":
                sig = "HOLD"
                parts.append("HTF-bear->blocked")
            elif sig in ("SELL", "STRONG SELL") and htf == "BULL":
                sig = "HOLD"
                parts.append("HTF-bull->blocked")
            else:
                parts.append(f"HTF {htf.lower()}")

        parts.append(f"ADX {row['adx']:.1f} {regime.lower()}")

        # 6. Confidence scoring
        if calibrator is not None:
            try:
                raw_prob = float(calibrator(total))
            except Exception:
                raw_prob = _heuristic_confidence(total, sig)
        else:
            raw_prob = _heuristic_confidence(total, sig)

        # Regime multiplier: trending = full, neutral = 75%
        regime_mult = 1.0 if regime == "TRENDING" else 0.75
        conf = round(raw_prob * regime_mult, 1)

        # 7. ATR-based SL / TP
        close_px = float(row["close"])
        atr_val  = row["atr"]

        if sig in ("BUY", "STRONG BUY") and not pd.isna(atr_val):
            sl_dist = float(atr_val) * cfg["sl_atr_mult"]
            stop    = round(close_px - sl_dist, 2)
            target  = round(close_px + sl_dist * cfg["tp_rr"], 2)
        elif sig in ("SELL", "STRONG SELL") and not pd.isna(atr_val):
            sl_dist = float(atr_val) * cfg["sl_atr_mult"]
            stop    = round(close_px + sl_dist, 2)
            target  = round(close_px - sl_dist * cfg["tp_rr"], 2)
        else:
            stop = target = np.nan

        _append(signals, reasons, scores, confidences,
                entries, stop_losses, take_profits,
                sig, " | ".join(parts), total, conf,
                close_px, stop, target)

    df["signal"]      = signals
    df["reason"]      = reasons
    df["score"]       = scores
    df["confidence"]  = confidences
    df["entry"]       = entries
    df["stop_loss"]   = stop_losses
    df["take_profit"] = take_profits
    return df


# ── Internal helpers ───────────────────────────────────────────

def _score_to_signal(total, cfg):
    if total >= cfg["strong_buy_th"]:  return "STRONG BUY"
    if total >= cfg["buy_th"]:         return "BUY"
    if total > cfg["sell_th"]:         return "HOLD"
    if total > cfg["strong_sell_th"]:  return "SELL"
    return "STRONG SELL"


def _heuristic_confidence(score, signal):
    """Fallback confidence when no calibrator is available."""
    if signal == "WAIT":
        return 0.0
    if signal in ("STRONG BUY", "STRONG SELL"):
        return min(95.0, 65.0 + abs(score) * 30.0)
    if signal in ("BUY", "SELL"):
        return min(95.0, 50.0 + abs(score) * 40.0)
    return 40.0


def _htf_bias(df, htf_df, cfg):
    """
    Compute HTF EMA trend and forward-fill onto primary df index.
    Returns a Series of 'BULL' | 'BEAR' | 'UNKNOWN' aligned to df.index.
    """
    if htf_df is None or len(htf_df) < cfg["htf_ema_slow"] + 5:
        return pd.Series("UNKNOWN", index=df.index)

    from BullShark.indicators import ema as _ema
    f = _ema(htf_df["close"], cfg["htf_ema_fast"])
    s = _ema(htf_df["close"], cfg["htf_ema_slow"])

    htf_trend = pd.Series(
        np.where(f > s, "BULL", "BEAR"),
        index=htf_df.index,
    )
    warmup = f.isna() | s.isna()
    htf_trend[warmup] = "UNKNOWN"

    try:
        htf_norm   = pd.DatetimeIndex([pd.Timestamp(t).normalize() for t in htf_trend.index])
        daily_norm = pd.DatetimeIndex([pd.Timestamp(t).normalize() for t in df.index])
        htf_trend.index = htf_norm
        combined   = htf_trend.reindex(daily_norm.union(htf_norm)).ffill()
        result     = combined.reindex(daily_norm).fillna("UNKNOWN")
        result.index = df.index
        return result
    except Exception:
        return pd.Series("UNKNOWN", index=df.index)


def _append_wait(signals, reasons, scores, confs, entries, sls, tps, close):
    signals.append("WAIT")
    reasons.append("Warming up")
    scores.append(0.0)
    confs.append(0.0)
    entries.append(float(close))
    sls.append(np.nan)
    tps.append(np.nan)


def _append(signals, reasons, scores, confs, entries, sls, tps,
            sig, reason, score, conf, entry, sl, tp):
    signals.append(sig)
    reasons.append(reason)
    scores.append(score)
    confs.append(conf)
    entries.append(float(entry))
    sls.append(sl)
    tps.append(tp)
