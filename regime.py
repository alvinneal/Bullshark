"""
BullShark/regime.py
───────────────────
Market regime classifier.

  TRENDING  ADX ≥ 25                         → trend strategy applies, full confidence
  NEUTRAL   20 ≤ ADX < 25                    → weak trend, reduced confidence
  RANGING   ADX < 20                          → filter out all trend signals
  VOLATILE  ATR z-score > 2.0 (spike)        → news / gap risk, skip trades
  UNKNOWN   Warmup period (indicators NaN)   → no trading

Only TRENDING and NEUTRAL regimes allow trade entry.
"""

import numpy as np
import pandas as pd
from BullShark.indicators import adx as _adx, atr as _atr, price_structure


_ADX_TREND = 25     # strong trend threshold
_ADX_RANGE = 20     # range-bound threshold
_ATR_Z_MAX = 2.0    # skip when ATR spikes > 2σ above its rolling mean


def detect(df, adx_period=14, atr_period=14, vol_period=20):
    """
    Classify each bar into a market regime.

    Parameters
    ----------
    df          : OHLCV DataFrame
    adx_period  : ADX smoothing period
    atr_period  : ATR smoothing period
    vol_period  : rolling window for ATR mean/std (volatility z-score)

    Returns
    -------
    DataFrame (same index as df) with columns:
      regime      : TRENDING | NEUTRAL | RANGING | VOLATILE | UNKNOWN
      trade_ok    : bool – True when regime permits trade entry
      adx         : ADX value
      plus_di     : +DI (bullish directional indicator)
      minus_di    : -DI (bearish directional indicator)
      atr         : ATR absolute value (₹)
      atr_pct     : ATR as % of close  (for normalised sizing)
      atr_z       : ATR z-score vs rolling mean (volatility regime)
      structure   : BULL | BEAR | NEUTRAL (price swing structure)
      struct_bull : bool – HH + HL confirmed
      struct_bear : bool – LH + LL confirmed
    """
    adx_df  = _adx(df, adx_period)
    atr_s   = _atr(df, atr_period)
    struct  = price_structure(df)

    atr_mean = atr_s.rolling(vol_period).mean()
    atr_std  = atr_s.rolling(vol_period).std()
    atr_z    = (atr_s - atr_mean) / atr_std.replace(0, np.nan)
    atr_pct  = atr_s / df["close"] * 100

    adx_vals = adx_df["adx"].values
    z_vals   = atr_z.values

    regimes  = []
    trade_ok = []

    for adx_v, z in zip(adx_vals, z_vals):
        if np.isnan(adx_v) or np.isnan(z):
            regimes.append("UNKNOWN")
            trade_ok.append(False)
        elif z > _ATR_Z_MAX:
            # Volatility spike – step aside, risk is undefined
            regimes.append("VOLATILE")
            trade_ok.append(False)
        elif adx_v >= _ADX_TREND:
            regimes.append("TRENDING")
            trade_ok.append(True)
        elif adx_v < _ADX_RANGE:
            regimes.append("RANGING")
            trade_ok.append(False)
        else:
            # Transition zone: allow entry but reduce confidence downstream
            regimes.append("NEUTRAL")
            trade_ok.append(True)

    return pd.DataFrame({
        "regime":      regimes,
        "trade_ok":    trade_ok,
        "adx":         adx_df["adx"].values,
        "plus_di":     adx_df["plus_di"].values,
        "minus_di":    adx_df["minus_di"].values,
        "atr":         atr_s.values,
        "atr_pct":     atr_pct.values,
        "atr_z":       z_vals,
        "structure":   struct["structure"].values,
        "struct_bull": struct["struct_bull"].values,
        "struct_bear": struct["struct_bear"].values,
    }, index=df.index)
