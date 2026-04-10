import { SignalBar } from "./signals"

export interface Trade {
  entryDate: string
  exitDate: string
  entryPrice: number
  exitPrice: number
  direction: "LONG" | "SHORT"
  pnlPct: number
  pnlAbs: number
  exitReason: "TP" | "SL" | "SIGNAL" | "END"
  shares: number
}

export interface BacktestSummary {
  start: number
  final: number
  ret: number
  cagr: number
  n: number
  w: number
  l: number
  wr: number
  aw: number
  al: number
  pf: number
  mdd: number
  sharpe: number
}

export interface BacktestResult {
  trades: Trade[]
  summary: BacktestSummary
  equity_curve: { date: string; equity: number }[]
}

const BROKERAGE = 0.0003   // 0.03% each way
const STT = 0.00025        // 0.025% sell-side only
const SLIPPAGE = 0.0005    // 0.05% per fill
const CAPITAL_USE = 0.95   // 95% capital utilization

export function runBacktest(
  data: SignalBar[],
  capital: number,
  slMult: number,
  tpRR: number
): BacktestResult {
  const trades: Trade[] = []
  const equityCurve: { date: string; equity: number }[] = []

  let equity = capital
  let inTrade = false
  let direction: "LONG" | "SHORT" = "LONG"
  let entryPrice = 0
  let entryDate = ""
  let slPrice = 0
  let tpPrice = 0
  let shares = 0

  for (let i = 0; i < data.length; i++) {
    const bar = data[i]
    const prevBar = i > 0 ? data[i - 1] : null

    if (!inTrade) {
      // Entry signal from previous bar
      if (prevBar) {
        const sig = prevBar.signal
        const atr = prevBar.atr

        const isLong = sig === "BUY" || sig === "STRONG BUY"
        const isShort = sig === "SELL" || sig === "STRONG SELL"

        if ((isLong || isShort) && atr !== null && prevBar.trade_ok) {
          direction = isLong ? "LONG" : "SHORT"
          // Fill at current bar open with slippage
          entryPrice = isLong
            ? bar.open * (1 + SLIPPAGE)
            : bar.open * (1 - SLIPPAGE)
          entryDate = bar.date

          const atrVal = atr
          if (direction === "LONG") {
            slPrice = entryPrice - atrVal * slMult
            tpPrice = entryPrice + atrVal * slMult * tpRR
          } else {
            slPrice = entryPrice + atrVal * slMult
            tpPrice = entryPrice - atrVal * slMult * tpRR
          }

          // Apply entry costs: brokerage
          const tradeCapital = equity * CAPITAL_USE
          shares = tradeCapital / entryPrice
          equity -= tradeCapital * BROKERAGE  // entry brokerage
          inTrade = true
        }
      }
    } else {
      // Check SL / TP hit intrabar
      let exitPrice: number | null = null
      let exitReason: Trade["exitReason"] | null = null

      if (direction === "LONG") {
        if (bar.low <= slPrice) {
          exitPrice = slPrice
          exitReason = "SL"
        } else if (bar.high >= tpPrice) {
          exitPrice = tpPrice
          exitReason = "TP"
        }
      } else {
        if (bar.high >= slPrice) {
          exitPrice = slPrice
          exitReason = "SL"
        } else if (bar.low <= tpPrice) {
          exitPrice = tpPrice
          exitReason = "TP"
        }
      }

      // Signal exit from previous bar
      if (!exitPrice && prevBar) {
        const sig = prevBar.signal
        const exitOnSignal =
          direction === "LONG"
            ? sig === "SELL" || sig === "STRONG SELL"
            : sig === "BUY" || sig === "STRONG BUY"
        if (exitOnSignal) {
          exitPrice = bar.open * (direction === "LONG" ? 1 - SLIPPAGE : 1 + SLIPPAGE)
          exitReason = "SIGNAL"
        }
      }

      // End of data
      if (!exitPrice && i === data.length - 1) {
        exitPrice = bar.close
        exitReason = "END"
      }

      if (exitPrice !== null && exitReason !== null) {
        // Apply exit costs
        const exitCosts = shares * exitPrice * (BROKERAGE + STT)
        const tradePnl =
          direction === "LONG"
            ? shares * (exitPrice - entryPrice) - exitCosts
            : shares * (entryPrice - exitPrice) - exitCosts

        const pnlPct = (tradePnl / (shares * entryPrice)) * 100
        equity += shares * (direction === "LONG" ? exitPrice : entryPrice) - exitCosts + tradePnl
        // Simpler: equity change
        // recalculate properly
        // At entry we spent: tradeCapital (but equity was reduced by brokerage only)
        // We need a cleaner model:
        // entry: equity -= tradeCapital * BROKERAGE (already done)
        // exit: equity changes by pnl
        // let's fix: recalculate equity from scratch per trade
        // Actually the model above is wrong for equity tracking.
        // Let's use a corrected approach:
        equity = equity // we'll recompute below

        trades.push({
          entryDate,
          exitDate: bar.date,
          entryPrice: Math.round(entryPrice * 100) / 100,
          exitPrice: Math.round(exitPrice * 100) / 100,
          direction,
          pnlPct: Math.round(pnlPct * 100) / 100,
          pnlAbs: Math.round(tradePnl * 100) / 100,
          exitReason,
          shares: Math.round(shares * 100) / 100,
        })

        inTrade = false
      }
    }

    equityCurve.push({ date: bar.date, equity: Math.round(equity * 100) / 100 })
  }

  // Recompute equity curve properly from trades
  const sortedTrades = [...trades].sort((a, b) => a.entryDate.localeCompare(b.entryDate))
  let eq = capital
  const eqByDate: Map<string, number> = new Map()

  let tIdx = 0
  for (let i = 0; i < data.length; i++) {
    const bar = data[i]
    // Process trades that exit on or before this date
    while (tIdx < sortedTrades.length && sortedTrades[tIdx].exitDate <= bar.date) {
      const tr = sortedTrades[tIdx]
      const tradeCapital = eq * CAPITAL_USE
      const sh = tradeCapital / tr.entryPrice
      const entryCost = sh * tr.entryPrice * BROKERAGE
      const pnl = tr.direction === "LONG"
        ? sh * (tr.exitPrice - tr.entryPrice)
        : sh * (tr.entryPrice - tr.exitPrice)
      const exitCost = sh * tr.exitPrice * (BROKERAGE + STT)
      eq = eq - entryCost + pnl - exitCost
      tIdx++
    }
    eqByDate.set(bar.date, Math.round(eq * 100) / 100)
  }

  const finalEquityCurve = data.map((bar) => ({
    date: bar.date,
    equity: eqByDate.get(bar.date) ?? capital,
  }))

  const finalEq = finalEquityCurve[finalEquityCurve.length - 1]?.equity ?? capital
  const totalRet = ((finalEq - capital) / capital) * 100
  const years = data.length / 252
  const cagr = years > 0 ? (Math.pow(finalEq / capital, 1 / years) - 1) * 100 : 0

  const wins = sortedTrades.filter((t) => t.pnlPct > 0)
  const losses = sortedTrades.filter((t) => t.pnlPct <= 0)
  const wr = sortedTrades.length > 0 ? (wins.length / sortedTrades.length) * 100 : 0
  const aw = wins.length > 0 ? wins.reduce((a, t) => a + t.pnlPct, 0) / wins.length : 0
  const al = losses.length > 0 ? losses.reduce((a, t) => a + t.pnlPct, 0) / losses.length : 0
  const grossWin = wins.reduce((a, t) => a + t.pnlAbs, 0)
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.pnlAbs, 0))
  const pf = grossLoss > 0 ? grossWin / grossLoss : wins.length > 0 ? 99 : 0

  // Max drawdown
  let peak = capital
  let mdd = 0
  for (const pt of finalEquityCurve) {
    if (pt.equity > peak) peak = pt.equity
    const dd = ((pt.equity - peak) / peak) * 100
    if (dd < mdd) mdd = dd
  }

  // Simplified Sharpe: daily returns
  const dailyReturns: number[] = []
  for (let i = 1; i < finalEquityCurve.length; i++) {
    const prev = finalEquityCurve[i - 1].equity
    if (prev > 0) dailyReturns.push((finalEquityCurve[i].equity - prev) / prev)
  }
  const meanR = dailyReturns.reduce((a, b) => a + b, 0) / (dailyReturns.length || 1)
  const stdR = Math.sqrt(
    dailyReturns.reduce((a, b) => a + (b - meanR) ** 2, 0) / (dailyReturns.length || 1)
  )
  const sharpe = stdR > 0 ? (meanR / stdR) * Math.sqrt(252) : 0

  const summary: BacktestSummary = {
    start: capital,
    final: Math.round(finalEq * 100) / 100,
    ret: Math.round(totalRet * 100) / 100,
    cagr: Math.round(cagr * 100) / 100,
    n: sortedTrades.length,
    w: wins.length,
    l: losses.length,
    wr: Math.round(wr * 10) / 10,
    aw: Math.round(aw * 100) / 100,
    al: Math.round(al * 100) / 100,
    pf: Math.round(pf * 100) / 100,
    mdd: Math.round(mdd * 100) / 100,
    sharpe: Math.round(sharpe * 100) / 100,
  }

  return {
    trades: sortedTrades,
    summary,
    equity_curve: finalEquityCurve,
  }
}
