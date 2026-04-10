export interface OHLCVBar {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/** EMA using multiplier = 2/(n+1) */
export function calcEMA(prices: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const result: number[] = new Array(prices.length).fill(0)
  // seed with SMA
  let sum = 0
  for (let i = 0; i < period && i < prices.length; i++) sum += prices[i]
  result[period - 1] = sum / period
  for (let i = period; i < prices.length; i++) {
    result[i] = prices[i] * k + result[i - 1] * (1 - k)
  }
  // fill leading values (mirror the first computed EMA)
  for (let i = 0; i < period - 1; i++) result[i] = result[period - 1]
  return result
}

/** RSI using Wilder's smoothing (alpha = 1/period) */
export function calcRSI(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(prices.length).fill(null)
  if (prices.length < period + 1) return result

  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1]
    if (diff > 0) avgGain += diff
    else avgLoss -= diff
  }
  avgGain /= period
  avgLoss /= period

  const toRSI = (g: number, l: number) => (l === 0 ? 100 : 100 - 100 / (1 + g / l))
  result[period] = toRSI(avgGain, avgLoss)

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? -diff : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    result[i] = toRSI(avgGain, avgLoss)
  }
  return result
}

/** Rolling VWAP over lookback window */
export function calcVWAP(data: OHLCVBar[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null)
  for (let i = period - 1; i < data.length; i++) {
    let tpvSum = 0
    let volSum = 0
    for (let j = i - period + 1; j <= i; j++) {
      const tp = (data[j].high + data[j].low + data[j].close) / 3
      tpvSum += tp * data[j].volume
      volSum += data[j].volume
    }
    result[i] = volSum > 0 ? tpvSum / volSum : null
  }
  return result
}

/** ATR using Wilder's EMA */
export function calcATR(data: OHLCVBar[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null)
  if (data.length < 2) return result

  const trues: number[] = []
  for (let i = 1; i < data.length; i++) {
    const hl = data[i].high - data[i].low
    const hc = Math.abs(data[i].high - data[i - 1].close)
    const lc = Math.abs(data[i].low - data[i - 1].close)
    trues.push(Math.max(hl, hc, lc))
  }

  if (trues.length < period) return result

  // seed
  let atr = trues.slice(0, period).reduce((a, b) => a + b, 0) / period
  result[period] = atr // index in original data = period (offset +1 from trues)
  for (let i = period; i < trues.length; i++) {
    atr = (atr * (period - 1) + trues[i]) / period
    result[i + 1] = atr
  }
  return result
}

/** ADX with Wilder's smoothing */
export function calcADX(data: OHLCVBar[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null)
  if (data.length < period * 2 + 1) return result

  const plusDM: number[] = []
  const minusDM: number[] = []
  const trues: number[] = []

  for (let i = 1; i < data.length; i++) {
    const upMove = data[i].high - data[i - 1].high
    const downMove = data[i - 1].low - data[i].low
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0)
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0)
    const hl = data[i].high - data[i].low
    const hc = Math.abs(data[i].high - data[i - 1].close)
    const lc = Math.abs(data[i].low - data[i - 1].close)
    trues.push(Math.max(hl, hc, lc))
  }

  if (trues.length < period) return result

  // Initial smoothed values
  let smoothTR = trues.slice(0, period).reduce((a, b) => a + b, 0)
  let smoothPDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0)
  let smoothMDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0)

  const dxArr: number[] = []
  const calcDX = (pdi: number, mdi: number) => {
    const sum = pdi + mdi
    return sum === 0 ? 0 : (Math.abs(pdi - mdi) / sum) * 100
  }

  let pdi = (smoothPDM / smoothTR) * 100
  let mdi = (smoothMDM / smoothTR) * 100
  dxArr.push(calcDX(pdi, mdi))

  for (let i = period; i < trues.length; i++) {
    smoothTR = smoothTR - smoothTR / period + trues[i]
    smoothPDM = smoothPDM - smoothPDM / period + plusDM[i]
    smoothMDM = smoothMDM - smoothMDM / period + minusDM[i]
    pdi = (smoothPDM / smoothTR) * 100
    mdi = (smoothMDM / smoothTR) * 100
    dxArr.push(calcDX(pdi, mdi))
  }

  if (dxArr.length < period) return result

  // ADX is Wilder EMA of DX over period
  let adx = dxArr.slice(0, period).reduce((a, b) => a + b, 0) / period
  // Map back: dxArr[0] corresponds to data index period, dxArr[period-1] to data index 2*period-1
  result[2 * period] = adx
  for (let i = period; i < dxArr.length; i++) {
    adx = (adx * (period - 1) + dxArr[i]) / period
    result[i + period + 1] = adx
  }
  return result
}
