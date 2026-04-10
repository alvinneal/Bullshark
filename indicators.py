import numpy as np
import pandas as pd


# ── EMA ────────────────────────────────────────────────────────

def ema(close, period):
    return close.ewm(span=period, adjust=False).mean()


def ema_crossover(close, fast=9, slow=21):
    f, s = ema(close, fast), ema(close, slow)
    return pd.DataFrame({
        "ema_fast":    f,
        "ema_slow":    s,
        "ema_bullish": (f > s) & (f.shift(1) <= s.shift(1)),
        "ema_bearish": (f < s) & (f.shift(1) >= s.shift(1)),
        "ema_trend":   np.where(f > s, "BULL", "BEAR"),
        "ema_gap":     ((f - s) / s * 100),
    }, index=close.index)


# ── RSI ────────────────────────────────────────────────────────

def rsi(close, period=14):
    delta    = close.diff()
    gain     = delta.clip(lower=0)
    loss     = (-delta).clip(lower=0)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period).mean()
    rs       = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


# ── VWAP ───────────────────────────────────────────────────────
# Rolling VWAP (resets over lookback window) suitable for daily data.
# Price above VWAP → buyers in control (bullish)
# Price below VWAP → sellers in control (bearish)

def vwap(df, period=20):
    tp      = (df["high"] + df["low"] + df["close"]) / 3
    tp_vol  = tp * df["volume"]
    cum_tpv = tp_vol.rolling(period).sum()
    cum_v   = df["volume"].rolling(period).sum()
    v_line  = cum_tpv / cum_v.replace(0, np.nan)
    v_dist  = (df["close"] - v_line) / v_line * 100
    return pd.DataFrame({"vwap": v_line, "vwap_dist": v_dist}, index=df.index)


# ── ATR ────────────────────────────────────────────────────────
# Average True Range: absolute volatility measure.
# Used for: dynamic SL/TP, regime filtering, position sizing.
# TR = max(H-L, |H-prevC|, |L-prevC|)

def atr(df, period=14):
    hl = df["high"] - df["low"]
    hc = (df["high"] - df["close"].shift(1)).abs()
    lc = (df["low"]  - df["close"].shift(1)).abs()
    tr = pd.concat([hl, hc, lc], axis=1).max(axis=1)
    return tr.ewm(alpha=1 / period, min_periods=period).mean()


# ── ADX ────────────────────────────────────────────────────────
# Average Directional Index: trend *strength* (not direction).
# ADX > 25 → strong trend   |   ADX < 20 → ranging / chop
# +DI > -DI → bullish bias  |   -DI > +DI → bearish bias

def adx(df, period=14):
    high, low, close = df["high"], df["low"], df["close"]

    hl   = high - low
    hc   = (high - close.shift(1)).abs()
    lc   = (low  - close.shift(1)).abs()
    tr   = pd.concat([hl, hc, lc], axis=1).max(axis=1)

    up   = high - high.shift(1)
    down = low.shift(1) - low

    plus_dm  = pd.Series(np.where((up > down) & (up > 0),   up,   0.0), index=df.index)
    minus_dm = pd.Series(np.where((down > up) & (down > 0), down, 0.0), index=df.index)

    alpha    = 1 / period
    s_tr     = tr.ewm(alpha=alpha, min_periods=period).mean()
    s_plus   = plus_dm.ewm(alpha=alpha,  min_periods=period).mean()
    s_minus  = minus_dm.ewm(alpha=alpha, min_periods=period).mean()

    plus_di  = 100 * s_plus  / s_tr.replace(0, np.nan)
    minus_di = 100 * s_minus / s_tr.replace(0, np.nan)
    dx       = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
    adx_line = dx.ewm(alpha=alpha, min_periods=period).mean()

    return pd.DataFrame({
        "adx":      adx_line,
        "plus_di":  plus_di,
        "minus_di": minus_di,
    }, index=df.index)


# ── PRICE STRUCTURE ────────────────────────────────────────────
# Detects Higher High / Higher Low (HH/HL → bullish structure)
# and Lower High / Lower Low (LH/LL → bearish structure)
# over two consecutive rolling windows.

def price_structure(df, lookback=10):
    roll_high = df["high"].rolling(lookback).max()
    roll_low  = df["low"].rolling(lookback).min()
    prev_high = roll_high.shift(lookback)
    prev_low  = roll_low.shift(lookback)

    hh = roll_high > prev_high   # Higher High
    hl = roll_low  > prev_low    # Higher Low
    lh = roll_high < prev_high   # Lower High
    ll = roll_low  < prev_low    # Lower Low

    structure = np.where(
        hh & hl, "BULL",
        np.where(lh & ll, "BEAR", "NEUTRAL")
    )

    return pd.DataFrame({
        "struct_bull": (hh & hl),
        "struct_bear": (lh & ll),
        "structure":   pd.Series(structure, index=df.index),
    }, index=df.index)


# ── SUPPORT / RESISTANCE ───────────────────────────────────────
# Vectorised S/R using rolling window extremes.
# resistance = highest high over lookback (shifted to avoid lookahead)
# support    = lowest  low  over lookback (shifted to avoid lookahead)

def support_resistance(df, lookback=20):
    resistance = df["high"].rolling(lookback).max().shift(1)
    support    = df["low"].rolling(lookback).min().shift(1)
    return pd.DataFrame({
        "support":    support,
        "resistance": resistance,
    }, index=df.index)
