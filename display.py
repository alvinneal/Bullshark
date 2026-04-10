import numpy as np
import pandas as pd


class C:
    R  = "\033[0m"
    B  = "\033[1m"
    D  = "\033[2m"
    G  = "\033[32m"
    RD = "\033[31m"
    Y  = "\033[33m"
    CN = "\033[36m"
    MG = "\033[35m"


SIG = {
    "STRONG BUY":  (C.G  + C.B, "^^"),
    "BUY":         (C.G,        "^ "),
    "HOLD":        (C.Y,        "-- "),
    "SELL":        (C.RD,       "v "),
    "STRONG SELL": (C.RD + C.B, "vv"),
    "WAIT":        (C.D,        ".. "),
}

REGIME_C = {
    "TRENDING": C.G,
    "NEUTRAL":  C.Y,
    "RANGING":  C.RD,
    "VOLATILE": C.MG,
    "UNKNOWN":  C.D,
}


def header(cfg, interval="1d", period="1y"):
    print(f"\n{C.CN}{C.B}  B U L L S H A R K{C.R}  "
          f"{C.D}Built to Detect. Designed to Strike.{C.R}")
    print(f"  {C.D}Nifty 50 | EMA {cfg['ema_fast']}/{cfg['ema_slow']} | "
          f"RSI {cfg['rsi_period']} | VWAP {cfg['vwap_period']} | "
          f"ADX {cfg.get('adx_period', 14)} | ATR {cfg.get('atr_period', 14)} | "
          f"{interval} | {period}{C.R}\n")


def latest(df, cfg):
    r, p = df.iloc[-1], df.iloc[-2]
    chg  = (r["close"] / p["close"] - 1) * 100
    s, a = SIG.get(r["signal"], (C.Y, "?"))
    rc   = REGIME_C.get(r.get("regime", "UNKNOWN"), C.D)
    conf = r.get("confidence", 0.0)
    htf  = r.get("htf_trend", "UNKNOWN")

    print(f"  {df.index[-1].strftime('%Y-%m-%d')}  "
          f"Rs.{r['close']:,.2f} ({chg:+.2f}%)  "
          f"Score: {r['score']:+.3f}  "
          f"Confidence: {C.CN}{conf:.1f}%{C.R}")
    print(f"  EMA {cfg['ema_fast']}/{cfg['ema_slow']}  "
          f"Rs.{r['ema_fast']:,.2f} / Rs.{r['ema_slow']:,.2f}  "
          f"gap: {r['ema_gap']:+.2f}%")
    print(f"  RSI {r['rsi']:.1f}  |  "
          f"VWAP Rs.{r['vwap']:,.2f}  dist: {r['vwap_dist']:+.2f}%")
    atr_pct = r.get("atr_pct", np.nan)
    print(f"  ADX {r['adx']:.1f}  |  "
          f"ATR Rs.{r['atr']:,.2f} ({atr_pct:.2f}%)  |  "
          f"Regime: {rc}{r.get('regime', '?')}{C.R}  |  "
          f"HTF: {htf}")
    print(f"  {s}{a} {r['signal']}{C.R}  {C.D}{r['reason']}{C.R}")

    # Trade levels (only for actionable signals)
    sl  = r.get("stop_loss", np.nan)
    tgt = r.get("take_profit", np.nan)
    if r["signal"] in ("BUY", "STRONG BUY", "SELL", "STRONG SELL") \
            and not pd.isna(sl):
        print(f"  Entry: Rs.{r['close']:,.2f}  "
              f"SL: {C.RD}Rs.{sl:,.2f}{C.R}  "
              f"TP: {C.G}Rs.{tgt:,.2f}{C.R}\n")
    else:
        print()


def recent(df, n=10):
    for dt, r in df.tail(n).iterrows():
        s, a   = SIG.get(r["signal"], (C.Y, "?"))
        rc     = REGIME_C.get(r.get("regime", "UNKNOWN"), C.D)
        conf   = r.get("confidence", 0.0)
        regime = r.get("regime", "?")[:7]
        print(
            f"  {dt.strftime('%Y-%m-%d')}  "
            f"Rs.{r['close']:>9,.2f}  "
            f"RSI {r['rsi']:>5.1f}  "
            f"VWAP {r['vwap_dist']:>+5.2f}%  "
            f"ADX {r['adx']:>4.1f}  "
            f"{rc}{regime:<7}{C.R}  "
            f"{r['score']:>+.3f}  "
            f"{C.CN}{conf:>4.0f}%{C.R}  "
            f"{s}{a}{r['signal']}{C.R}"
        )
    print()


def stats(df):
    v = df[df["signal"] != "WAIT"]
    c = v["signal"].value_counts()
    t = len(v)
    for sig in ["STRONG BUY", "BUY", "HOLD", "SELL", "STRONG SELL"]:
        n   = c.get(sig, 0)
        pct = n / t * 100 if t else 0
        st, _ = SIG.get(sig, (C.Y, ""))
        print(f"  {st}{sig:<12s}{C.R} {n:>4d} ({pct:>5.1f}%)")
    print()


def disclaimer():
    print(f"  {C.D}[!] Educational only. Not financial advice.{C.R}\n")
