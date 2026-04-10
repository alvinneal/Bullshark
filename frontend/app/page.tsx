"use client"

import { useState, useMemo } from "react"
import {
  Sun, Moon, TrendingUp, Activity, AlertTriangle,
  Target, Shield, BarChart3, RefreshCw, Settings, FlaskConical,
} from "lucide-react"
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, ReferenceLine, ComposedChart, Bar,
} from "recharts"
import { generateSampleData, generateSignals, DEFAULT_CONFIG, Config, SignalBar } from "../lib/signals"
import { runBacktest, BacktestResult } from "../lib/backtest"

// ─── helpers ────────────────────────────────────────────────────────────────

function t(isDark: boolean, dark: string, light: string) {
  return isDark ? dark : light
}

function getSignalColor(signal: string) {
  switch (signal) {
    case "STRONG BUY": return "#22c55e"
    case "BUY": return "#4ade80"
    case "HOLD": return "#eab308"
    case "SELL": return "#f87171"
    case "STRONG SELL": return "#ef4444"
    default: return "#64748b"
  }
}

function getRegimeColor(regime: string) {
  switch (regime) {
    case "TRENDING": return "#22c55e"
    case "NEUTRAL": return "#eab308"
    case "RANGING": return "#ef4444"
    case "VOLATILE": return "#a855f7"
    default: return "#64748b"
  }
}

function fmt(n: number) {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 })
}

// ─── tooltip ────────────────────────────────────────────────────────────────

interface PricePayloadEntry {
  payload: {
    date: string
    close: number
    ema_fast: number
    ema_slow: number
    rsi: number | null
    signal: string
  }
}

function CustomPriceTooltip({
  active, payload, isDark,
}: {
  active?: boolean
  payload?: PricePayloadEntry[]
  isDark: boolean
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const cardCls = t(isDark, "bg-[#1e293b] border-[#334155]", "bg-white border-[#e2e8f0]")
  const tp = t(isDark, "text-white", "text-[#0f172a]")
  const tm = t(isDark, "text-[#94a3b8]", "text-[#64748b]")
  return (
    <div className={`border rounded-lg p-3 shadow-lg ${cardCls}`}>
      <p className={`text-xs font-medium mb-2 ${tp}`}>{d.date}</p>
      <div className="space-y-1 text-xs">
        <p><span className={tm}>Close:</span> <span className={tp}>Rs.{fmt(d.close)}</span></p>
        <p><span className={tm}>EMA Fast:</span> <span className="text-[#3b82f6]">Rs.{fmt(d.ema_fast)}</span></p>
        <p><span className={tm}>EMA Slow:</span> <span className="text-[#f59e0b]">Rs.{fmt(d.ema_slow)}</span></p>
        {d.rsi !== null && <p><span className={tm}>RSI:</span> <span className={tp}>{(d.rsi as number).toFixed(1)}</span></p>}
        <p><span className={tm}>Signal:</span> <span style={{ color: getSignalColor(d.signal) }}>{d.signal}</span></p>
      </div>
    </div>
  )
}

// ─── config tab ──────────────────────────────────────────────────────────────

function ConfigTab({
  cfg, onChange, isDark,
}: {
  cfg: Config
  onChange: (c: Config) => void
  isDark: boolean
}) {
  const [draft, setDraft] = useState<Config>(cfg)
  const cardCls = t(isDark, "bg-[#1e293b]", "bg-white")
  const borderCls = t(isDark, "border-[#334155]", "border-[#e2e8f0]")
  const tp = t(isDark, "text-white", "text-[#0f172a]")
  const tm = t(isDark, "text-[#94a3b8]", "text-[#64748b]")
  const inputCls = `w-full rounded-lg border ${borderCls} ${cardCls} ${tp} px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500`

  function numField(label: string, key: keyof Config, step = 1, min = 0, max = 999) {
    return (
      <div className="space-y-1">
        <label className={`text-xs font-medium ${tm}`}>{label}</label>
        <input
          type="number"
          step={step}
          min={min}
          max={max}
          value={draft[key] as number}
          onChange={(e) => setDraft((p) => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
          className={inputCls}
        />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className={`rounded-xl border ${borderCls} ${cardCls} p-6`}>
        <h3 className={`font-semibold mb-4 ${tp}`}>EMA Parameters</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {numField("EMA Fast Period", "ema_fast", 1, 2, 50)}
          {numField("EMA Slow Period", "ema_slow", 1, 2, 200)}
        </div>
      </div>

      <div className={`rounded-xl border ${borderCls} ${cardCls} p-6`}>
        <h3 className={`font-semibold mb-4 ${tp}`}>RSI Parameters</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {numField("RSI Period", "rsi_period", 1, 2, 100)}
          {numField("Oversold Level", "rsi_oversold", 1, 0, 50)}
          {numField("Overbought Level", "rsi_overbought", 1, 50, 100)}
        </div>
      </div>

      <div className={`rounded-xl border ${borderCls} ${cardCls} p-6`}>
        <h3 className={`font-semibold mb-4 ${tp}`}>VWAP / ADX Parameters</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {numField("VWAP Period", "vwap_period", 1, 5, 100)}
          {numField("ADX Period", "adx_period", 1, 5, 50)}
        </div>
      </div>

      <div className={`rounded-xl border ${borderCls} ${cardCls} p-6`}>
        <h3 className={`font-semibold mb-4 ${tp}`}>Signal Weights (must sum to 1)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {numField("EMA Weight", "w_ema", 0.05, 0, 1)}
          {numField("RSI Weight", "w_rsi", 0.05, 0, 1)}
          {numField("VWAP Weight", "w_vwap", 0.05, 0, 1)}
        </div>
        <p className={`text-xs mt-2 ${tm}`}>Current sum: {(draft.w_ema + draft.w_rsi + draft.w_vwap).toFixed(2)}</p>
      </div>

      <div className={`rounded-xl border ${borderCls} ${cardCls} p-6`}>
        <h3 className={`font-semibold mb-4 ${tp}`}>Risk Management</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {numField("ATR SL Multiplier", "sl_atr_mult", 0.1, 0.5, 5)}
          {numField("TP R:R Ratio", "tp_rr", 0.1, 0.5, 10)}
        </div>
      </div>

      <button
        onClick={() => onChange(draft)}
        className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg text-sm transition-colors"
      >
        Apply &amp; Recalculate
      </button>
    </div>
  )
}

// ─── simulations tab ─────────────────────────────────────────────────────────

interface SimResult {
  trades: number
  wr: number
  pf: number
  best: number
  expected: number
  worst: number
  recommendation: string
  equity_curve: { date: string; equity: number }[]
}

function SimulationsTab({
  signals, isDark,
}: {
  signals: SignalBar[]
  isDark: boolean
}) {
  const [capital, setCapital] = useState(100000)
  const [horizon, setHorizon] = useState("1yr")
  const [risk, setRisk] = useState<"Conservative" | "Moderate" | "Aggressive">("Moderate")
  const [simResult, setSimResult] = useState<SimResult | null>(null)

  const cardCls = t(isDark, "bg-[#1e293b]", "bg-white")
  const borderCls = t(isDark, "border-[#334155]", "border-[#e2e8f0]")
  const tp = t(isDark, "text-white", "text-[#0f172a]")
  const tm = t(isDark, "text-[#94a3b8]", "text-[#64748b]")
  const tickColor = isDark ? "#64748b" : "#94a3b8"
  const inputCls = `w-full rounded-lg border ${borderCls} ${cardCls} ${tp} px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500`

  const horizonBars: Record<string, number> = { "1mo": 21, "3mo": 63, "6mo": 126, "1yr": 252 }
  const riskMults: Record<string, { sl: number; tp: number }> = {
    Conservative: { sl: 1.0, tp: 1.5 },
    Moderate: { sl: 1.5, tp: 2.0 },
    Aggressive: { sl: 2.5, tp: 3.0 },
  }

  function runSim() {
    const bars = horizonBars[horizon] ?? 252
    const slice = signals.slice(-bars)
    if (slice.length === 0) return
    const mults = riskMults[risk]
    const result = runBacktest(slice, capital, mults.sl, mults.tp)
    const s = result.summary
    const best = s.ret * 1.4
    const worst = s.ret < 0 ? s.ret * 1.4 : s.ret * 0.4

    let recommendation = ""
    if (s.wr >= 55 && s.pf >= 1.5 && s.mdd > -15) recommendation = "Strong conditions — consider deploying."
    else if (s.wr >= 45 && s.pf >= 1.0) recommendation = "Moderate conditions — trade with caution."
    else recommendation = "Unfavorable conditions — reduce exposure."

    setSimResult({
      trades: s.n,
      wr: s.wr,
      pf: s.pf,
      best: Math.round(best * 100) / 100,
      expected: s.ret,
      worst: Math.round(worst * 100) / 100,
      recommendation,
      equity_curve: result.equity_curve,
    })
  }

  return (
    <div className="p-6 space-y-6">
      <div className={`rounded-xl border ${borderCls} ${cardCls} p-6`}>
        <h3 className={`font-semibold mb-4 ${tp}`}>Simulation Parameters</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className={`text-xs font-medium ${tm}`}>Capital (Rs.)</label>
            <input type="number" value={capital} onChange={(e) => setCapital(Number(e.target.value) || 100000)} className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className={`text-xs font-medium ${tm}`}>Time Horizon</label>
            <select value={horizon} onChange={(e) => setHorizon(e.target.value)} className={inputCls}>
              <option value="1mo">1 Month</option>
              <option value="3mo">3 Months</option>
              <option value="6mo">6 Months</option>
              <option value="1yr">1 Year</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className={`text-xs font-medium ${tm}`}>Risk Level</label>
            <select value={risk} onChange={(e) => setRisk(e.target.value as "Conservative" | "Moderate" | "Aggressive")} className={inputCls}>
              <option>Conservative</option>
              <option>Moderate</option>
              <option>Aggressive</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={runSim} className="w-full px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg text-sm transition-colors">
              Run Simulation
            </button>
          </div>
        </div>
      </div>

      {simResult && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: "Est. Trades", value: String(simResult.trades), color: tp },
              { label: "Win Rate", value: `${simResult.wr}%`, color: simResult.wr >= 50 ? "text-[#22c55e]" : "text-[#ef4444]" },
              { label: "Profit Factor", value: String(simResult.pf), color: simResult.pf >= 1 ? "text-[#22c55e]" : "text-[#ef4444]" },
              { label: "Best Case", value: `+${simResult.best}%`, color: "text-[#22c55e]" },
              { label: "Expected", value: `${simResult.expected >= 0 ? "+" : ""}${simResult.expected}%`, color: simResult.expected >= 0 ? "text-[#22c55e]" : "text-[#ef4444]" },
              { label: "Worst Case", value: `${simResult.worst}%`, color: "text-[#ef4444]" },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl border ${borderCls} ${cardCls} p-4 text-center`}>
                <p className={`text-xs ${tm} mb-1`}>{s.label}</p>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className={`rounded-xl border ${borderCls} ${cardCls} p-4`}>
            <p className={`text-sm ${tm}`}>
              <span className="font-medium text-cyan-400">Recommendation: </span>
              {simResult.recommendation}
            </p>
          </div>

          <div className={`rounded-xl border ${borderCls} ${cardCls} p-6`}>
            <h3 className={`font-semibold mb-4 ${tp}`}>Simulation Equity Curve</h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={simResult.equity_curve.filter((_, i) => i % 3 === 0)}>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: tickColor, fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} interval="preserveStartEnd" />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: tickColor, fontSize: 10 }} tickFormatter={(v: number) => `Rs.${(v / 1000).toFixed(0)}k`} domain={["dataMin - 2000", "dataMax + 2000"]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: isDark ? "#1e293b" : "white", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: "8px" }}
                    formatter={(value: number) => [`Rs.${value.toLocaleString()}`, "Equity"]}
                  />
                  <Area type="monotone" dataKey="equity" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── main dashboard ──────────────────────────────────────────────────────────

const RAW_DATA = generateSampleData()

export default function BullSharkDashboard() {
  const [isDark, setIsDark] = useState(true)
  const [activeTab, setActiveTab] = useState("Dashboard")
  const [activeBottomTab, setActiveBottomTab] = useState("Signals")
  const [cfg, setCfg] = useState<Config>(DEFAULT_CONFIG)

  // Theme shortcuts
  const bg = t(isDark, "bg-[#0f172a]", "bg-[#f1f5f9]")
  const card = t(isDark, "bg-[#1e293b]", "bg-white")
  const border = t(isDark, "border-[#334155]", "border-[#e2e8f0]")
  const textPrimary = t(isDark, "text-white", "text-[#0f172a]")
  const textMuted = t(isDark, "text-[#94a3b8]", "text-[#64748b]")
  const tickColor = isDark ? "#64748b" : "#94a3b8"

  // Computed data
  const signals = useMemo(() => generateSignals(RAW_DATA, cfg), [cfg])

  const latest = signals[signals.length - 1]
  const prev = signals.length >= 2 ? signals[signals.length - 2] : null
  const change = prev ? ((latest.close - prev.close) / prev.close) * 100 : 0
  const atrPct = latest.atr !== null ? ((latest.atr as number) / latest.close) * 100 : 0

  // HTF: weekly-equivalent EMA bias
  const weeklyBars = signals.filter((_, i) => i % 5 === 0)
  const lastWeekly = weeklyBars[weeklyBars.length - 1]
  const htf = lastWeekly && lastWeekly.ema_fast > lastWeekly.ema_slow ? "BULL" : "BEAR"

  // Chart data: last 120 bars
  const chartData = useMemo(
    () =>
      signals.slice(-120).map((s) => ({
        date: s.date.slice(5),
        close: s.close,
        ema_fast: s.ema_fast,
        ema_slow: s.ema_slow,
        rsi: s.rsi,
        adx: s.adx,
        signal: s.signal,
      })),
    [signals]
  )

  // Backtest
  const backtestResult: BacktestResult = useMemo(
    () => runBacktest(signals, 100000, cfg.sl_atr_mult, cfg.tp_rr),
    [signals, cfg.sl_atr_mult, cfg.tp_rr]
  )
  const bt = backtestResult.summary
  const btTrades = backtestResult.trades

  // Signal distribution
  const signalDist = useMemo(() => {
    const counts: Record<string, number> = {
      "STRONG BUY": 0, BUY: 0, HOLD: 0, SELL: 0, "STRONG SELL": 0, WAIT: 0,
    }
    for (const s of signals) counts[s.signal] = (counts[s.signal] ?? 0) + 1
    const total = signals.length
    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([signal, count]) => ({ signal, count, percentage: (count / total) * 100 }))
  }, [signals])

  // Recent signals (last 20, newest first)
  const recentSignals = useMemo(() => signals.slice(-20).reverse(), [signals])

  // Equity curve for chart (sampled)
  const equityCurve = useMemo(
    () => backtestResult.equity_curve.filter((_, i) => i % 5 === 0),
    [backtestResult]
  )

  const isActionable = ["BUY", "STRONG BUY", "SELL", "STRONG SELL"].includes(latest.signal)

  return (
    <div className={`min-h-screen p-4 md:p-6 transition-colors duration-300 ${t(isDark, "bg-[#1e293b]", "bg-[#cbd5e1]")}`}>
      <div className={`max-w-[1400px] mx-auto rounded-2xl overflow-hidden shadow-2xl transition-colors duration-300 ${bg}`}>

        {/* ── Header ── */}
        <header className={`flex items-center justify-between px-6 py-4 border-b ${border}`}>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="BullShark Logo"
                className={`h-10 w-10 object-contain ${isDark ? "invert" : ""}`}
              />
              <div>
                <h1 className={`text-xl font-bold ${textPrimary}`}>BullShark</h1>
                <p className={`text-xs ${textMuted}`}>Built to Detect. Designed to Strike.</p>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-1">
              {[
                { name: "Dashboard", icon: <BarChart3 className="w-4 h-4" /> },
                { name: "Configuration", icon: <Settings className="w-4 h-4" /> },
                { name: "Simulations", icon: <FlaskConical className="w-4 h-4" /> },
              ].map(({ name, icon }) => (
                <button
                  key={name}
                  onClick={() => setActiveTab(name)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-colors ${
                    activeTab === name
                      ? `${card} ${textPrimary} font-medium`
                      : `${textMuted} hover:${textPrimary}`
                  }`}
                >
                  {icon}
                  {name}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className={`hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${card}`}>
              <span className={textMuted}>Nifty 50</span>
              <span className={textMuted}>|</span>
              <span className={textMuted}>EMA {cfg.ema_fast}/{cfg.ema_slow}</span>
              <span className={textMuted}>|</span>
              <span className={textMuted}>RSI {cfg.rsi_period}</span>
              <span className={textMuted}>|</span>
              <span className={textMuted}>1D</span>
            </div>

            <button
              onClick={() => setCfg((c) => ({ ...c }))}
              className={`p-2 rounded-lg transition-colors ${card} ${t(isDark, "hover:bg-[#334155]", "hover:bg-[#e2e8f0]")}`}
              aria-label="Recalculate"
            >
              <RefreshCw className={`w-4 h-4 ${textMuted}`} />
            </button>

            <button
              onClick={() => setIsDark(!isDark)}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className={`p-2 rounded-lg transition-all duration-300 ${t(isDark, "bg-[#1e293b] hover:bg-[#334155]", "bg-[#e2e8f0] hover:bg-[#cbd5e1]")}`}
            >
              {isDark ? <Moon className="w-5 h-5 text-[#94a3b8]" /> : <Sun className="w-5 h-5 text-[#f59e0b]" />}
            </button>
          </div>
        </header>

        {/* ── Configuration Tab ── */}
        {activeTab === "Configuration" && (
          <ConfigTab cfg={cfg} onChange={setCfg} isDark={isDark} />
        )}

        {/* ── Simulations Tab ── */}
        {activeTab === "Simulations" && (
          <SimulationsTab signals={signals} isDark={isDark} />
        )}

        {/* ── Dashboard Tab ── */}
        {activeTab === "Dashboard" && (
          <>
            {/* Latest Signal Banner */}
            <div className={`px-6 py-4 border-b ${border} ${card}`}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div>
                    <p className={`text-xs ${textMuted}`}>{latest.date}</p>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-2xl font-bold ${textPrimary}`}>Rs.{fmt(latest.close)}</span>
                      <span className={`text-sm ${change >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                        ({change >= 0 ? "+" : ""}{change.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                  <div className={`h-12 w-px ${t(isDark, "bg-[#334155]", "bg-[#e2e8f0]")}`} />
                  <div>
                    <p className={`text-xs ${textMuted}`}>Score</p>
                    <p className={`text-lg font-semibold ${latest.score >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                      {latest.score >= 0 ? "+" : ""}{latest.score.toFixed(3)}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs ${textMuted}`}>Confidence</p>
                    <p className="text-lg font-semibold text-cyan-400">{latest.confidence}%</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div
                    className="px-4 py-2 rounded-lg font-bold text-white text-lg"
                    style={{ backgroundColor: getSignalColor(latest.signal) }}
                  >
                    {latest.signal === "STRONG BUY" && "^^ "}
                    {latest.signal === "BUY" && "^ "}
                    {latest.signal === "HOLD" && "-- "}
                    {latest.signal === "SELL" && "v "}
                    {latest.signal === "STRONG SELL" && "vv "}
                    {latest.signal}
                  </div>
                  <div
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-white"
                    style={{ backgroundColor: getRegimeColor(latest.regime) }}
                  >
                    {latest.regime}
                  </div>
                  <div className={`px-3 py-1.5 rounded-lg text-sm ${card}`}>
                    <span className={textMuted}>HTF: </span>
                    <span className={htf === "BULL" ? "text-[#22c55e]" : "text-[#ef4444]"}>{htf}</span>
                  </div>
                </div>
              </div>

              <p className={`mt-3 text-sm ${textMuted}`}>{latest.reason}</p>
            </div>

            {/* Indicator Stats Row */}
            <div className={`border-b ${border} overflow-x-auto`}>
              <div className="flex min-w-max">
                {[
                  { label: `EMA ${cfg.ema_fast}`, value: `Rs.${fmt(latest.ema_fast)}`, sub: "Fast EMA", color: "#3b82f6" },
                  { label: `EMA ${cfg.ema_slow}`, value: `Rs.${fmt(latest.ema_slow)}`, sub: "Slow EMA", color: "#f59e0b" },
                  {
                    label: "EMA Gap",
                    value: `${latest.ema_gap >= 0 ? "+" : ""}${latest.ema_gap.toFixed(2)}%`,
                    sub: latest.ema_gap >= 0 ? "Bullish" : "Bearish",
                    color: latest.ema_gap >= 0 ? "#22c55e" : "#ef4444",
                  },
                  {
                    label: "RSI",
                    value: latest.rsi !== null ? (latest.rsi as number).toFixed(1) : "—",
                    sub: latest.rsi !== null
                      ? (latest.rsi as number) > cfg.rsi_overbought ? "Overbought"
                        : (latest.rsi as number) < cfg.rsi_oversold ? "Oversold"
                        : "Neutral"
                      : "—",
                    color: latest.rsi !== null
                      ? (latest.rsi as number) > cfg.rsi_overbought ? "#ef4444"
                        : (latest.rsi as number) < cfg.rsi_oversold ? "#22c55e"
                        : "#a855f7"
                      : "#64748b",
                  },
                  {
                    label: "VWAP",
                    value: latest.vwap !== null ? `Rs.${fmt(latest.vwap as number)}` : "—",
                    sub: "Fair Value",
                    color: "#06b6d4",
                  },
                  {
                    label: "VWAP Dist",
                    value: `${latest.vwap_dist >= 0 ? "+" : ""}${latest.vwap_dist.toFixed(2)}%`,
                    sub: latest.vwap_dist >= 0 ? "Above FV" : "Below FV",
                    color: latest.vwap_dist >= 0 ? "#22c55e" : "#ef4444",
                  },
                  {
                    label: "ADX",
                    value: latest.adx !== null ? (latest.adx as number).toFixed(1) : "—",
                    sub: latest.adx !== null ? (latest.adx as number) >= 25 ? "Strong Trend" : "Weak Trend" : "—",
                    color: latest.adx !== null ? (latest.adx as number) >= 25 ? "#22c55e" : "#eab308" : "#64748b",
                  },
                  {
                    label: "ATR",
                    value: latest.atr !== null ? `Rs.${(latest.atr as number).toFixed(2)}` : "—",
                    sub: `${atrPct.toFixed(2)}% volatility`,
                    color: "#a855f7",
                  },
                  {
                    label: "Support",
                    value: latest.support !== null ? `Rs.${fmt(latest.support as number)}` : "—",
                    sub: "Key Level",
                    color: "#22c55e",
                  },
                  {
                    label: "Resistance",
                    value: latest.resistance !== null ? `Rs.${fmt(latest.resistance as number)}` : "—",
                    sub: "Key Level",
                    color: "#ef4444",
                  },
                ].map((stat, i, arr) => (
                  <div key={stat.label} className={`p-4 min-w-[140px] ${i < arr.length - 1 ? `border-r ${border}` : ""}`}>
                    <p className={`text-xs ${textMuted}`}>{stat.label}</p>
                    <p className="text-sm font-semibold truncate" style={{ color: stat.color }}>{stat.value}</p>
                    <p className={`text-xs ${textMuted}`}>{stat.sub}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Composite Score Bar */}
            <div className={`px-6 py-4 border-b ${border}`}>
              <div className="flex items-center justify-between mb-2">
                <p className={`text-xs font-medium ${textMuted}`}>Composite Score</p>
                <p className={`text-sm font-bold ${latest.score >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                  {latest.score >= 0 ? "+" : ""}{latest.score.toFixed(3)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-[#ef4444] w-10">SELL</span>
                <div className={`flex-1 h-2 rounded-full relative ${t(isDark, "bg-[#1e293b]", "bg-[#e2e8f0]")}`}>
                  <div className="absolute inset-0 rounded-full overflow-hidden">
                    <div
                      className="h-full w-full"
                      style={{ background: "linear-gradient(to right, #ef4444 0%, #fbbf24 50%, #22c55e 100%)", opacity: 0.3 }}
                    />
                  </div>
                  <div className={`absolute left-1/2 top-0 bottom-0 w-px ${t(isDark, "bg-[#64748b]", "bg-[#94a3b8]")}`} />
                  <div
                    className="absolute w-4 h-4 rounded-full shadow-lg transition-all duration-300"
                    style={{
                      left: `${((Math.max(-0.6, Math.min(0.6, latest.score)) + 0.6) / 1.2) * 100}%`,
                      top: "50%",
                      transform: "translate(-50%, -50%)",
                      backgroundColor: latest.score >= 0 ? "#22c55e" : latest.score < -0.15 ? "#ef4444" : "#eab308",
                      boxShadow: `0 0 12px ${latest.score >= 0 ? "#22c55e" : latest.score < -0.15 ? "#ef4444" : "#eab308"}66`,
                    }}
                  />
                </div>
                <span className="text-xs font-medium text-[#22c55e] w-10 text-right">BUY</span>
              </div>
              <div className="flex justify-between mt-2">
                <span className={`text-xs ${textMuted}`}>-0.6</span>
                <span className={`text-xs ${textMuted}`}>0</span>
                <span className={`text-xs ${textMuted}`}>+0.6</span>
              </div>
            </div>

            {/* Trade Levels */}
            {isActionable && (
              <div className={`px-6 py-3 border-b ${border} flex flex-wrap items-center gap-6`}>
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-cyan-400" />
                  <span className={`text-sm ${textMuted}`}>Entry:</span>
                  <span className={`text-sm font-medium ${textPrimary}`}>Rs.{fmt(latest.close)}</span>
                </div>
                {latest.stop_loss !== null && (
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#ef4444]" />
                    <span className={`text-sm ${textMuted}`}>SL:</span>
                    <span className="text-sm font-medium text-[#ef4444]">Rs.{fmt(latest.stop_loss as number)}</span>
                  </div>
                )}
                {latest.take_profit !== null && (
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#22c55e]" />
                    <span className={`text-sm ${textMuted}`}>TP:</span>
                    <span className="text-sm font-medium text-[#22c55e]">Rs.{fmt(latest.take_profit as number)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Main Charts */}
            <div className={`grid grid-cols-1 lg:grid-cols-3 border-b ${border}`}>
              {/* Price Chart */}
              <div className={`lg:col-span-2 p-6 border-r ${border}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`font-semibold ${textPrimary}`}>Price &amp; EMA Crossover</h3>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-0.5 bg-[#94a3b8]" />
                      <span className={textMuted}>Price</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-0.5 bg-[#3b82f6]" />
                      <span className={textMuted}>EMA {cfg.ema_fast}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-0.5 bg-[#f59e0b]" />
                      <span className={textMuted}>EMA {cfg.ema_slow}</span>
                    </div>
                  </div>
                </div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: tickColor, fontSize: 11 }}
                        interval={Math.floor(chartData.length / 8)}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: tickColor, fontSize: 11 }}
                        tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}k`}
                        domain={["dataMin - 200", "dataMax + 200"]}
                      />
                      <Tooltip content={(props) => <CustomPriceTooltip {...props} isDark={isDark} />} />
                      <Line type="monotone" dataKey="close" stroke="#94a3b8" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="ema_fast" stroke="#3b82f6" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                      <Line type="monotone" dataKey="ema_slow" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* RSI Chart */}
              <div className="p-6">
                <h3 className={`font-semibold mb-4 ${textPrimary}`}>RSI ({cfg.rsi_period})</h3>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: tickColor, fontSize: 11 }}
                        interval={Math.floor(chartData.length / 5)}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: tickColor, fontSize: 11 }}
                        domain={[0, 100]}
                        ticks={[0, 30, 50, 70, 100]}
                      />
                      <ReferenceLine y={cfg.rsi_overbought} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
                      <ReferenceLine y={cfg.rsi_oversold} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.5} />
                      <ReferenceLine y={50} stroke={tickColor} strokeDasharray="3 3" strokeOpacity={0.3} />
                      <Area type="monotone" dataKey="rsi" stroke="#a855f7" fill="#a855f7" fillOpacity={0.2} strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-between mt-2 text-xs">
                  <span className="text-[#22c55e]">Oversold {"<"} {cfg.rsi_oversold}</span>
                  <span className="text-[#ef4444]">Overbought {">"} {cfg.rsi_overbought}</span>
                </div>
              </div>
            </div>

            {/* ADX Panel */}
            <div className={`px-6 py-4 border-b ${border}`}>
              <h3 className={`font-semibold mb-3 text-sm ${textPrimary}`}>ADX — Trend Strength</h3>
              <div className="h-[100px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: tickColor, fontSize: 10 }}
                      interval={Math.floor(chartData.length / 8)}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: tickColor, fontSize: 10 }}
                      domain={[0, 60]}
                      ticks={[0, 20, 25, 40, 60]}
                    />
                    <ReferenceLine y={25} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.6} />
                    <ReferenceLine y={20} stroke="#eab308" strokeDasharray="3 3" strokeOpacity={0.5} />
                    <Bar dataKey="adx" fill="#06b6d4" fillOpacity={0.6} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4 mt-1 text-xs">
                <span className="text-[#22c55e]">Trending ≥ 25</span>
                <span className="text-[#eab308]">Neutral 20–25</span>
                <span className="text-[#ef4444]">Ranging &lt; 20</span>
              </div>
            </div>

            {/* Backtest & Stats Row */}
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border-b ${border}`}>
              {/* Backtest Summary */}
              <div className={`p-6 border-r ${border}`}>
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-cyan-400" />
                  <h3 className={`font-semibold ${textPrimary}`}>Backtest</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className={`text-sm ${textMuted}`}>Capital</span>
                    <span className={`text-sm ${textPrimary}`}>
                      Rs.{(bt.start / 1000).toFixed(0)}k → Rs.{(bt.final / 1000).toFixed(1)}k
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${textMuted}`}>Return</span>
                    <span className={`text-sm font-semibold ${bt.ret >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                      {bt.ret >= 0 ? "+" : ""}{bt.ret}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${textMuted}`}>CAGR</span>
                    <span className={`text-sm ${bt.cagr >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                      {bt.cagr >= 0 ? "+" : ""}{bt.cagr}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${textMuted}`}>Sharpe</span>
                    <span className={`text-sm ${bt.sharpe >= 1 ? "text-[#22c55e]" : "text-[#eab308]"}`}>{bt.sharpe}</span>
                  </div>
                </div>
              </div>

              {/* Trade Stats */}
              <div className={`p-6 border-r ${border}`}>
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-5 h-5 text-cyan-400" />
                  <h3 className={`font-semibold ${textPrimary}`}>Trade Stats</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className={`text-sm ${textMuted}`}>Trades</span>
                    <span className={`text-sm ${textPrimary}`}>{bt.n}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${textMuted}`}>Win / Loss</span>
                    <span className="text-sm">
                      <span className="text-[#22c55e]">{bt.w}</span>
                      <span className={textMuted}> / </span>
                      <span className="text-[#ef4444]">{bt.l}</span>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${textMuted}`}>Win Rate</span>
                    <span className={`text-sm ${textPrimary}`}>{bt.wr}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${textMuted}`}>Avg W/L</span>
                    <span className="text-sm">
                      <span className="text-[#22c55e]">{bt.aw >= 0 ? "+" : ""}{bt.aw}%</span>
                      <span className={textMuted}> / </span>
                      <span className="text-[#ef4444]">{bt.al}%</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Risk Metrics */}
              <div className={`p-6 border-r ${border}`}>
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-cyan-400" />
                  <h3 className={`font-semibold ${textPrimary}`}>Risk Metrics</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className={`text-sm ${textMuted}`}>Profit Factor</span>
                    <span className={`text-sm ${bt.pf >= 1 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>{bt.pf}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${textMuted}`}>Max Drawdown</span>
                    <span className="text-sm text-[#ef4444]">{bt.mdd}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${textMuted}`}>SL/TP Mult</span>
                    <span className={`text-sm ${textPrimary}`}>{cfg.sl_atr_mult}x ATR / {cfg.tp_rr}:1 RR</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${textMuted}`}>Costs</span>
                    <span className={`text-sm ${textMuted}`}>0.03% + STT + slip</span>
                  </div>
                </div>
              </div>

              {/* Signal Distribution */}
              <div className="p-6">
                <h3 className={`font-semibold mb-4 ${textPrimary}`}>Signal Distribution</h3>
                <div className="space-y-2">
                  {signalDist.map((item) => (
                    <div key={item.signal} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getSignalColor(item.signal) }} />
                      <span className={`text-xs w-24 flex-shrink-0 ${textMuted}`}>{item.signal}</span>
                      <div className={`flex-1 h-2 rounded-full ${t(isDark, "bg-[#334155]", "bg-[#e2e8f0]")}`}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${item.percentage}%`, backgroundColor: getSignalColor(item.signal) }}
                        />
                      </div>
                      <span className={`text-xs w-10 text-right flex-shrink-0 ${textPrimary}`}>{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Tabs */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {["Signals", "Trades", "Equity"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveBottomTab(tab)}
                      className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                        activeBottomTab === tab
                          ? "bg-cyan-500 text-white"
                          : `${textMuted} ${t(isDark, "hover:text-white", "hover:text-[#0f172a]")}`
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <p className={`text-xs ${textMuted}`}>[!] Educational only. Not financial advice.</p>
              </div>

              {/* Signals Table */}
              {activeBottomTab === "Signals" && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left">
                        {["Date", "Close", "RSI", "VWAP Dist", "ADX", "Regime", "Score", "Conf", "Signal"].map((h) => (
                          <th key={h} className="py-3 text-cyan-400 text-xs font-medium pr-4">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recentSignals.map((row, i) => (
                        <tr key={i} className={`border-t ${border}`}>
                          <td className={`py-3 text-sm pr-4 ${textMuted}`}>{row.date}</td>
                          <td className={`py-3 text-sm pr-4 ${textPrimary}`}>Rs.{fmt(row.close)}</td>
                          <td className={`py-3 text-sm pr-4 ${textPrimary}`}>
                            {row.rsi !== null ? (row.rsi as number).toFixed(1) : "—"}
                          </td>
                          <td className={`py-3 text-sm pr-4 ${row.vwap_dist >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                            {row.vwap_dist >= 0 ? "+" : ""}{row.vwap_dist.toFixed(2)}%
                          </td>
                          <td className={`py-3 text-sm pr-4 ${textPrimary}`}>
                            {row.adx !== null ? (row.adx as number).toFixed(1) : "—"}
                          </td>
                          <td className="py-3 text-sm pr-4">
                            <span
                              className="px-2 py-0.5 rounded text-xs"
                              style={{ backgroundColor: getRegimeColor(row.regime), color: "white" }}
                            >
                              {row.regime}
                            </span>
                          </td>
                          <td className={`py-3 text-sm pr-4 ${row.score >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                            {row.score >= 0 ? "+" : ""}{row.score.toFixed(3)}
                          </td>
                          <td className="py-3 text-sm pr-4 text-cyan-400">{row.confidence}%</td>
                          <td className="py-3 text-sm">
                            <span
                              className="px-2 py-1 rounded text-xs font-medium"
                              style={{ backgroundColor: getSignalColor(row.signal), color: "white" }}
                            >
                              {row.signal}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Trades Table */}
              {activeBottomTab === "Trades" && (
                <div className="overflow-x-auto">
                  {btTrades.length === 0 ? (
                    <div className={`text-center py-12 ${textMuted}`}>No trades generated in backtest.</div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="text-left">
                          {["Entry Date", "Exit Date", "Dir", "Entry", "Exit", "PnL %", "PnL Rs.", "Reason"].map((h) => (
                            <th key={h} className="py-3 text-cyan-400 text-xs font-medium pr-4">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {btTrades.slice(-30).reverse().map((tr, i) => (
                          <tr key={i} className={`border-t ${border}`}>
                            <td className={`py-2 text-xs pr-4 ${textMuted}`}>{tr.entryDate}</td>
                            <td className={`py-2 text-xs pr-4 ${textMuted}`}>{tr.exitDate}</td>
                            <td className={`py-2 text-xs pr-4 font-medium ${tr.direction === "LONG" ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                              {tr.direction}
                            </td>
                            <td className={`py-2 text-xs pr-4 ${textPrimary}`}>Rs.{fmt(tr.entryPrice)}</td>
                            <td className={`py-2 text-xs pr-4 ${textPrimary}`}>Rs.{fmt(tr.exitPrice)}</td>
                            <td className={`py-2 text-xs pr-4 font-medium ${tr.pnlPct >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                              {tr.pnlPct >= 0 ? "+" : ""}{tr.pnlPct}%
                            </td>
                            <td className={`py-2 text-xs pr-4 ${tr.pnlAbs >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                              {tr.pnlAbs >= 0 ? "+" : ""}Rs.{fmt(tr.pnlAbs)}
                            </td>
                            <td className={`py-2 text-xs ${textMuted}`}>{tr.exitReason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Equity Curve */}
              {activeBottomTab === "Equity" && (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={equityCurve}>
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: tickColor, fontSize: 11 }}
                        tickFormatter={(v: string) => v.slice(5)}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: tickColor, fontSize: 11 }}
                        tickFormatter={(v: number) => `Rs.${(v / 1000).toFixed(0)}k`}
                        domain={["dataMin - 5000", "dataMax + 5000"]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? "#1e293b" : "white",
                          border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => [`Rs.${value.toLocaleString()}`, "Equity"]}
                      />
                      <Area type="monotone" dataKey="equity" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Disclaimer */}
              <p className={`mt-6 text-xs text-center ${textMuted}`}>
                BullShark is for educational purposes only. All signals are generated from synthetic data and do not
                constitute financial advice. Past performance does not guarantee future results. Always consult a
                SEBI-registered advisor before trading.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
