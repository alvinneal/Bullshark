import { OHLCVBar, calcEMA, calcRSI, calcVWAP, calcATR, calcADX } from "./indicators"

export type { OHLCVBar }

export interface Config {
  ema_fast: number
  ema_slow: number
  rsi_period: number
  rsi_oversold: number
  rsi_overbought: number
  vwap_period: number
  adx_period: number
  w_ema: number
  w_rsi: number
  w_vwap: number
  sl_atr_mult: number
  tp_rr: number
}

export const DEFAULT_CONFIG: Config = {
  ema_fast: 9,
  ema_slow: 21,
  rsi_period: 14,
  rsi_oversold: 35,
  rsi_overbought: 65,
  vwap_period: 20,
  adx_period: 14,
  w_ema: 0.40,
  w_rsi: 0.35,
  w_vwap: 0.25,
  sl_atr_mult: 1.5,
  tp_rr: 2.0,
}

export interface SignalBar extends OHLCVBar {
  ema_fast: number
  ema_slow: number
  ema_gap: number
  rsi: number | null
  vwap: number | null
  vwap_dist: number
  atr: number | null
  adx: number | null
  regime: "TRENDING" | "NEUTRAL" | "RANGING" | "VOLATILE" | "UNKNOWN"
  trade_ok: boolean
  signal: "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL" | "WAIT"
  score: number
  confidence: number
  reason: string
  stop_loss: number | null
  take_profit: number | null
  support: number | null
  resistance: number | null
}

function classifyRegime(adx: number | null): { regime: SignalBar["regime"]; trade_ok: boolean } {
  if (adx === null || isNaN(adx)) return { regime: "UNKNOWN", trade_ok: false }
  if (adx >= 25) return { regime: "TRENDING", trade_ok: true }
  if (adx >= 20) return { regime: "NEUTRAL", trade_ok: true }
  return { regime: "RANGING", trade_ok: false }
}

function rollingMinMax(closes: number[], idx: number, window: number): { min: number; max: number } {
  const start = Math.max(0, idx - window + 1)
  const slice = closes.slice(start, idx + 1)
  return { min: Math.min(...slice), max: Math.max(...slice) }
}

function detectStructure(closes: number[], idx: number): "BULL" | "BEAR" | "NEUTRAL" {
  if (idx < 10) return "NEUTRAL"
  const curr = rollingMinMax(closes, idx, 5)
  const prev = rollingMinMax(closes, idx - 5, 5)
  const hh = curr.max > prev.max
  const hl = curr.min > prev.min
  const lh = curr.max < prev.max
  const ll = curr.min < prev.min
  if (hh && hl) return "BULL"
  if (lh && ll) return "BEAR"
  return "NEUTRAL"
}

export function generateSignals(data: OHLCVBar[], config: Config): SignalBar[] {
  const closes = data.map((d) => d.close)

  const emaFastArr = calcEMA(closes, config.ema_fast)
  const emaSlowArr = calcEMA(closes, config.ema_slow)
  const rsiArr = calcRSI(closes, config.rsi_period)
  const vwapArr = calcVWAP(data, config.vwap_period)
  const atrArr = calcATR(data, config.adx_period)
  const adxArr = calcADX(data, config.adx_period)

  const result: SignalBar[] = []

  for (let i = 0; i < data.length; i++) {
    const bar = data[i]
    const emaFast = emaFastArr[i]
    const emaSlow = emaSlowArr[i]
    const emaGap = emaSlow > 0 ? ((emaFast - emaSlow) / emaSlow) * 100 : 0
    const rsi = rsiArr[i]
    const vwap = vwapArr[i]
    const vwapDist = vwap !== null ? ((bar.close - vwap) / vwap) * 100 : 0
    const atr = atrArr[i]
    const adx = adxArr[i]

    const { regime, trade_ok: rawTradeOk } = classifyRegime(adx)

    // Compute component scores [-1, +1]
    // EMA score
    const emaScore = emaGap > 0 ? Math.min(1, emaGap / 1.5) : Math.max(-1, emaGap / 1.5)

    // RSI score – neutral zone [40,60] contributes 0
    let rsiScore = 0
    if (rsi !== null) {
      if (rsi > 60) rsiScore = Math.min(1, (rsi - 60) / (100 - 60))
      else if (rsi < 40) rsiScore = Math.max(-1, (rsi - 40) / 40)
      // else [40,60] = 0
    }

    // VWAP score
    const vwapScore = Math.max(-1, Math.min(1, vwapDist / 2))

    // Weighted composite
    const rawScore =
      config.w_ema * emaScore + config.w_rsi * rsiScore + config.w_vwap * vwapScore

    // Regime confidence modifier
    let confMult = 1.0
    if (regime === "NEUTRAL") confMult = 0.75
    else if (regime === "RANGING" || regime === "UNKNOWN") confMult = 0.5

    const score = rawScore * confMult
    const trade_ok = rawTradeOk && regime !== "UNKNOWN"

    // Determine signal from score
    let signal: SignalBar["signal"]
    if (score >= 0.35) signal = "STRONG BUY"
    else if (score >= 0.10) signal = "BUY"
    else if (score <= -0.35) signal = "STRONG SELL"
    else if (score <= -0.10) signal = "SELL"
    else if (!trade_ok) signal = "WAIT"
    else signal = "HOLD"

    // Structure check
    const structure = detectStructure(closes, i)
    if (signal === "BUY" && structure === "BEAR") signal = "HOLD"
    if (signal === "SELL" && structure === "BULL") signal = "HOLD"

    // Confidence: absolute score * 100 clamped [30, 95]
    const confidence = Math.min(95, Math.max(30, Math.round(Math.abs(score) * 200 * confMult + 30)))

    // SL / TP
    let stop_loss: number | null = null
    let take_profit: number | null = null
    if (atr !== null && (signal === "BUY" || signal === "STRONG BUY")) {
      stop_loss = bar.close - atr * config.sl_atr_mult
      take_profit = bar.close + atr * config.sl_atr_mult * config.tp_rr
    } else if (atr !== null && (signal === "SELL" || signal === "STRONG SELL")) {
      stop_loss = bar.close + atr * config.sl_atr_mult
      take_profit = bar.close - atr * config.sl_atr_mult * config.tp_rr
    }

    // Support / resistance: 20-bar rolling min/max
    const lookback = Math.min(i + 1, 20)
    const slice = closes.slice(Math.max(0, i - lookback + 1), i + 1)
    const support = Math.min(...slice)
    const resistance = Math.max(...slice)

    // Reason string
    const reasons: string[] = []
    if (emaGap > 0.05) reasons.push(`EMA ${config.ema_fast} above ${config.ema_slow} +${emaGap.toFixed(2)}%`)
    else if (emaGap < -0.05) reasons.push(`EMA ${config.ema_fast} below ${config.ema_slow} ${emaGap.toFixed(2)}%`)
    if (rsi !== null) {
      if (rsi > config.rsi_overbought) reasons.push(`RSI ${rsi.toFixed(1)} overbought`)
      else if (rsi < config.rsi_oversold) reasons.push(`RSI ${rsi.toFixed(1)} oversold`)
      else reasons.push(`RSI ${rsi.toFixed(1)} neutral`)
    }
    if (vwap !== null) reasons.push(`VWAP dist ${vwapDist >= 0 ? "+" : ""}${vwapDist.toFixed(2)}%`)
    if (adx !== null) reasons.push(`ADX ${adx.toFixed(1)} ${regime.toLowerCase()}`)

    result.push({
      ...bar,
      ema_fast: emaFast,
      ema_slow: emaSlow,
      ema_gap: emaGap,
      rsi,
      vwap,
      vwap_dist: vwapDist,
      atr,
      adx,
      regime,
      trade_ok,
      signal,
      score,
      confidence,
      reason: reasons.join(" | "),
      stop_loss,
      take_profit,
      support,
      resistance,
    })
  }

  return result
}

// Simple seeded PRNG (mulberry32)
function makeRNG(seed: number) {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Generate ~300 synthetic daily bars for Nifty 50 starting ~23500 */
export function generateSampleData(): OHLCVBar[] {
  const rng = makeRNG(42)
  const bars: OHLCVBar[] = []

  let price = 23500
  // Start date ~300 trading days back from today
  const start = new Date(2025, 3, 15) // April 15 2025, gives ~240 trading days to April 2026

  let d = new Date(start)
  const totalDays = 300

  for (let i = 0; i < totalDays; i++) {
    // skip weekends
    while (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() + 1)
    }

    const dateStr = d.toISOString().slice(0, 10)

    // Daily return: slight upward drift with volatility
    const drift = 0.0003
    const vol = 0.012
    const ret = drift + (rng() - 0.5) * vol * 2
    const open = price
    const close = open * (1 + ret)
    const intraVol = 0.008
    const high = Math.max(open, close) * (1 + rng() * intraVol)
    const low = Math.min(open, close) * (1 - rng() * intraVol)
    const volume = Math.round(50000 + rng() * 150000)

    bars.push({
      date: dateStr,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume,
    })

    price = close
    d.setDate(d.getDate() + 1)
  }

  return bars
}
