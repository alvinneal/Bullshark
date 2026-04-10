"use client"

import { useState } from "react"
import { Sun, Moon, TrendingUp, TrendingDown, Activity, AlertTriangle, Target, Shield, BarChart3, RefreshCw } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine,
  ComposedChart,
  Bar,
} from "recharts"

// Simulated BullShark data based on backend outputs
const priceData = [
  { date: "Mar 01", close: 22450, ema_fast: 22380, ema_slow: 22320, rsi: 52, adx: 28, signal: "HOLD" },
  { date: "Mar 04", close: 22580, ema_fast: 22420, ema_slow: 22350, rsi: 56, adx: 30, signal: "HOLD" },
  { date: "Mar 05", close: 22720, ema_fast: 22480, ema_slow: 22380, rsi: 62, adx: 32, signal: "BUY" },
  { date: "Mar 06", close: 22890, ema_fast: 22560, ema_slow: 22420, rsi: 68, adx: 35, signal: "BUY" },
  { date: "Mar 07", close: 23050, ema_fast: 22680, ema_slow: 22480, rsi: 72, adx: 38, signal: "STRONG BUY" },
  { date: "Mar 08", close: 22980, ema_fast: 22750, ema_slow: 22530, rsi: 65, adx: 36, signal: "BUY" },
  { date: "Mar 11", close: 22850, ema_fast: 22780, ema_slow: 22570, rsi: 58, adx: 32, signal: "HOLD" },
  { date: "Mar 12", close: 22720, ema_fast: 22770, ema_slow: 22600, rsi: 48, adx: 28, signal: "HOLD" },
  { date: "Mar 13", close: 22580, ema_fast: 22730, ema_slow: 22620, rsi: 42, adx: 24, signal: "SELL" },
  { date: "Mar 14", close: 22450, ema_fast: 22680, ema_slow: 22630, rsi: 38, adx: 22, signal: "SELL" },
  { date: "Mar 15", close: 22320, ema_fast: 22600, ema_slow: 22630, rsi: 32, adx: 20, signal: "STRONG SELL" },
  { date: "Mar 18", close: 22480, ema_fast: 22560, ema_slow: 22620, rsi: 38, adx: 18, signal: "HOLD" },
  { date: "Mar 19", close: 22650, ema_fast: 22540, ema_slow: 22610, rsi: 45, adx: 19, signal: "HOLD" },
  { date: "Mar 20", close: 22820, ema_fast: 22560, ema_slow: 22600, rsi: 52, adx: 22, signal: "BUY" },
  { date: "Mar 21", close: 22950, ema_fast: 22620, ema_slow: 22600, rsi: 58, adx: 26, signal: "BUY" },
]

const latestSignal = {
  date: "2026-03-21",
  close: 22950.45,
  change: 0.57,
  score: 0.342,
  confidence: 72.5,
  signal: "BUY",
  reason: "EMA 9 crossed up 21 | RSI 58 weak-bull | VWAP above +0.85% | ADX 26.2 trending",
  ema_fast: 22620.30,
  ema_slow: 22598.15,
  ema_gap: 0.10,
  rsi: 58.2,
  vwap: 22780.50,
  vwap_dist: 0.85,
  adx: 26.2,
  atr: 285.40,
  atr_pct: 1.24,
  regime: "TRENDING",
  htf_trend: "BULL",
  stop_loss: 22522.35,
  take_profit: 23806.65,
  support: 22180.00,
  resistance: 23250.00,
}

const recentSignals = [
  { date: "2026-03-21", close: 22950.45, rsi: 58.2, vwap_dist: 0.85, adx: 26.2, regime: "TRENDING", score: 0.342, confidence: 72, signal: "BUY" },
  { date: "2026-03-20", close: 22820.10, rsi: 52.1, vwap_dist: 0.42, adx: 22.5, regime: "NEUTRAL", score: 0.185, confidence: 58, signal: "BUY" },
  { date: "2026-03-19", close: 22650.80, rsi: 45.3, vwap_dist: -0.15, adx: 19.2, regime: "RANGING", score: 0.025, confidence: 42, signal: "HOLD" },
  { date: "2026-03-18", close: 22480.25, rsi: 38.5, vwap_dist: -0.85, adx: 18.1, regime: "RANGING", score: -0.120, confidence: 40, signal: "HOLD" },
  { date: "2026-03-15", close: 22320.90, rsi: 32.4, vwap_dist: -1.45, adx: 20.8, regime: "NEUTRAL", score: -0.485, confidence: 78, signal: "STRONG SELL" },
  { date: "2026-03-14", close: 22450.60, rsi: 38.2, vwap_dist: -0.92, adx: 22.3, regime: "NEUTRAL", score: -0.225, confidence: 55, signal: "SELL" },
  { date: "2026-03-13", close: 22580.35, rsi: 42.8, vwap_dist: -0.55, adx: 24.1, regime: "NEUTRAL", score: -0.165, confidence: 52, signal: "SELL" },
  { date: "2026-03-12", close: 22720.20, rsi: 48.5, vwap_dist: 0.12, adx: 28.4, regime: "TRENDING", score: 0.085, confidence: 48, signal: "HOLD" },
  { date: "2026-03-11", close: 22850.75, rsi: 58.2, vwap_dist: 0.68, adx: 32.1, regime: "TRENDING", score: 0.225, confidence: 62, signal: "HOLD" },
  { date: "2026-03-08", close: 22980.40, rsi: 65.3, vwap_dist: 1.25, adx: 36.2, regime: "TRENDING", score: 0.385, confidence: 75, signal: "BUY" },
]

const backtestResults = {
  start: 100000,
  final: 118542.35,
  ret: 18.54,
  cagr: 18.54,
  trades: 24,
  wins: 15,
  losses: 9,
  winRate: 62.5,
  avgWin: 3.85,
  avgLoss: -2.12,
  profitFactor: 1.82,
  maxDrawdown: -8.45,
  sharpe: 1.42,
}

const signalDistribution = [
  { signal: "STRONG BUY", count: 12, percentage: 8.2 },
  { signal: "BUY", count: 38, percentage: 26.0 },
  { signal: "HOLD", count: 65, percentage: 44.5 },
  { signal: "SELL", count: 24, percentage: 16.4 },
  { signal: "STRONG SELL", count: 7, percentage: 4.9 },
]

const equityCurve = [
  { date: "Jan", equity: 100000 },
  { date: "Feb", equity: 102500 },
  { date: "Mar", equity: 105200 },
  { date: "Apr", equity: 103800 },
  { date: "May", equity: 108500 },
  { date: "Jun", equity: 112300 },
  { date: "Jul", equity: 110200 },
  { date: "Aug", equity: 114800 },
  { date: "Sep", equity: 116500 },
  { date: "Oct", equity: 118542 },
]

// Config
const config = {
  ema_fast: 9,
  ema_slow: 21,
  rsi_period: 14,
  vwap_period: 20,
  adx_period: 14,
  atr_period: 14,
}

// Theme helper
function t(isDark: boolean, dark: string, light: string) {
  return isDark ? dark : light
}

// Signal color helper
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

// Regime color helper
function getRegimeColor(regime: string) {
  switch (regime) {
    case "TRENDING": return "#22c55e"
    case "NEUTRAL": return "#eab308"
    case "RANGING": return "#ef4444"
    case "VOLATILE": return "#a855f7"
    default: return "#64748b"
  }
}

function CustomPriceTooltip({ active, payload, isDark }: { active?: boolean; payload?: Array<{ payload: typeof priceData[0] }>; isDark: boolean }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className={`border rounded-lg p-3 shadow-lg ${t(isDark, "bg-[#1e293b] border-[#334155]", "bg-white border-[#e2e8f0]")}`}>
        <p className={`text-xs font-medium mb-2 ${t(isDark, "text-white", "text-[#0f172a]")}`}>{data.date}</p>
        <div className="space-y-1 text-xs">
          <p><span className={t(isDark, "text-[#94a3b8]", "text-[#64748b]")}>Close:</span> <span className={t(isDark, "text-white", "text-[#0f172a]")}>Rs.{data.close.toLocaleString()}</span></p>
          <p><span className={t(isDark, "text-[#94a3b8]", "text-[#64748b]")}>EMA 9:</span> <span className="text-[#3b82f6]">Rs.{data.ema_fast.toLocaleString()}</span></p>
          <p><span className={t(isDark, "text-[#94a3b8]", "text-[#64748b]")}>EMA 21:</span> <span className="text-[#f59e0b]">Rs.{data.ema_slow.toLocaleString()}</span></p>
          <p><span className={t(isDark, "text-[#94a3b8]", "text-[#64748b]")}>RSI:</span> <span className={t(isDark, "text-white", "text-[#0f172a]")}>{data.rsi}</span></p>
          <p><span className={t(isDark, "text-[#94a3b8]", "text-[#64748b]")}>Signal:</span> <span style={{ color: getSignalColor(data.signal) }}>{data.signal}</span></p>
        </div>
      </div>
    )
  }
  return null
}

export default function BullSharkDashboard() {
  const [isDark, setIsDark] = useState(true)
  const [activeTab, setActiveTab] = useState("Signals")

  // Theme colors
  const bg = t(isDark, "bg-[#0f172a]", "bg-[#f1f5f9]")
  const card = t(isDark, "bg-[#1e293b]", "bg-white")
  const border = t(isDark, "border-[#334155]", "border-[#e2e8f0]")
  const textPrimary = t(isDark, "text-white", "text-[#0f172a]")
  const textMuted = t(isDark, "text-[#94a3b8]", "text-[#64748b]")
  const tickColor = isDark ? "#64748b" : "#94a3b8"

  return (
    <div className={`min-h-screen p-4 md:p-6 transition-colors duration-300 ${t(isDark, "bg-[#1e293b]", "bg-[#cbd5e1]")}`}>
      <div className={`max-w-[1400px] mx-auto rounded-2xl overflow-hidden shadow-2xl transition-colors duration-300 ${bg}`}>

        {/* Header */}
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

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {["Dashboard", "Configuration", "Simulations"].map((item) => (
                <button
                  key={item}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                    item === "Dashboard"
                      ? `${card} ${textPrimary} font-medium`
                      : `${textMuted} hover:${textPrimary}`
                  }`}
                >
                  {item}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className={`hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${card}`}>
              <span className={textMuted}>Nifty 50</span>
              <span className={textMuted}>|</span>
              <span className={textMuted}>EMA {config.ema_fast}/{config.ema_slow}</span>
              <span className={textMuted}>|</span>
              <span className={textMuted}>RSI {config.rsi_period}</span>
              <span className={textMuted}>|</span>
              <span className={textMuted}>1D</span>
            </div>

            <button className={`p-2 rounded-lg transition-colors ${card} ${t(isDark, "hover:bg-[#334155]", "hover:bg-[#e2e8f0]")}`}>
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

        {/* Latest Signal Banner */}
        <div className={`px-6 py-4 border-b ${border} ${card}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div>
                <p className={`text-xs ${textMuted}`}>{latestSignal.date}</p>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-bold ${textPrimary}`}>Rs.{latestSignal.close.toLocaleString()}</span>
                  <span className={`text-sm ${latestSignal.change >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                    ({latestSignal.change >= 0 ? "+" : ""}{latestSignal.change}%)
                  </span>
                </div>
              </div>
              <div className={`h-12 w-px ${t(isDark, "bg-[#334155]", "bg-[#e2e8f0]")}`} />
              <div>
                <p className={`text-xs ${textMuted}`}>Score</p>
                <p className={`text-lg font-semibold ${latestSignal.score >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                  {latestSignal.score >= 0 ? "+" : ""}{latestSignal.score.toFixed(3)}
                </p>
              </div>
              <div>
                <p className={`text-xs ${textMuted}`}>Confidence</p>
                <p className="text-lg font-semibold text-cyan-400">{latestSignal.confidence}%</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div
                className="px-4 py-2 rounded-lg font-bold text-white text-lg"
                style={{ backgroundColor: getSignalColor(latestSignal.signal) }}
              >
                {latestSignal.signal === "STRONG BUY" && "^^ "}
                {latestSignal.signal === "BUY" && "^ "}
                {latestSignal.signal === "HOLD" && "-- "}
                {latestSignal.signal === "SELL" && "v "}
                {latestSignal.signal === "STRONG SELL" && "vv "}
                {latestSignal.signal}
              </div>
              <div
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white"
                style={{ backgroundColor: getRegimeColor(latestSignal.regime) }}
              >
                {latestSignal.regime}
              </div>
              <div className={`px-3 py-1.5 rounded-lg text-sm ${card}`}>
                <span className={textMuted}>HTF: </span>
                <span className={latestSignal.htf_trend === "BULL" ? "text-[#22c55e]" : "text-[#ef4444]"}>
                  {latestSignal.htf_trend}
                </span>
              </div>
            </div>
          </div>

          <p className={`mt-3 text-sm ${textMuted}`}>{latestSignal.reason}</p>
        </div>

        {/* Indicator Stats Row - Horizontal Scrollable */}
        <div className={`border-b ${border} overflow-x-auto`}>
          <div className="flex min-w-max">
            {[
              { label: `EMA ${config.ema_fast}`, value: `Rs.${latestSignal.ema_fast.toLocaleString()}`, sub: "Fast EMA", color: "#3b82f6" },
              { label: `EMA ${config.ema_slow}`, value: `Rs.${latestSignal.ema_slow.toLocaleString()}`, sub: "Slow EMA", color: "#f59e0b" },
              { label: "EMA Gap", value: `${latestSignal.ema_gap >= 0 ? "+" : ""}${latestSignal.ema_gap.toFixed(2)}%`, sub: latestSignal.ema_gap >= 0 ? "Bullish" : "Bearish", color: latestSignal.ema_gap >= 0 ? "#22c55e" : "#ef4444" },
              { label: "RSI", value: latestSignal.rsi.toFixed(1), sub: latestSignal.rsi > 65 ? "Overbought" : latestSignal.rsi < 35 ? "Oversold" : "Neutral", color: latestSignal.rsi > 65 ? "#ef4444" : latestSignal.rsi < 35 ? "#22c55e" : "#a855f7" },
              { label: "VWAP", value: `Rs.${latestSignal.vwap.toLocaleString()}`, sub: "Fair Value", color: "#06b6d4" },
              { label: "VWAP Dist", value: `${latestSignal.vwap_dist >= 0 ? "+" : ""}${latestSignal.vwap_dist.toFixed(2)}%`, sub: latestSignal.vwap_dist >= 0 ? "Above FV" : "Below FV", color: latestSignal.vwap_dist >= 0 ? "#22c55e" : "#ef4444" },
              { label: "ADX", value: latestSignal.adx.toFixed(1), sub: latestSignal.adx >= 25 ? "Strong Trend" : "Weak Trend", color: latestSignal.adx >= 25 ? "#22c55e" : "#eab308" },
              { label: "ATR", value: `Rs.${latestSignal.atr.toFixed(2)}`, sub: `${latestSignal.atr_pct.toFixed(2)}% volatility`, color: "#a855f7" },
              { label: "Support", value: `Rs.${latestSignal.support.toLocaleString()}`, sub: "Key Level", color: "#22c55e" },
              { label: "Resistance", value: `Rs.${latestSignal.resistance.toLocaleString()}`, sub: "Key Level", color: "#ef4444" },
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
            <p className={`text-sm font-bold ${latestSignal.score >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
              {latestSignal.score >= 0 ? "+" : ""}{latestSignal.score.toFixed(3)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-[#ef4444] w-10">SELL</span>
            <div className={`flex-1 h-2 rounded-full relative ${t(isDark, "bg-[#1e293b]", "bg-[#e2e8f0]")}`}>
              {/* Gradient background */}
              <div className="absolute inset-0 rounded-full overflow-hidden">
                <div className="h-full w-full" style={{ background: "linear-gradient(to right, #ef4444 0%, #fbbf24 50%, #22c55e 100%)", opacity: 0.3 }} />
              </div>
              {/* Center line */}
              <div className={`absolute left-1/2 top-0 bottom-0 w-px ${t(isDark, "bg-[#64748b]", "bg-[#94a3b8]")}`} />
              {/* Score indicator */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full shadow-lg transition-all duration-300"
                style={{ 
                  left: `${((Math.max(-0.6, Math.min(0.6, latestSignal.score)) + 0.6) / 1.2) * 100}%`,
                  transform: "translate(-50%, -50%)",
                  backgroundColor: latestSignal.score >= 0 ? "#22c55e" : latestSignal.score < -0.15 ? "#ef4444" : "#eab308",
                  boxShadow: `0 0 12px ${latestSignal.score >= 0 ? "#22c55e" : latestSignal.score < -0.15 ? "#ef4444" : "#eab308"}66`
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

        {/* Trade Levels (for actionable signals) */}
        {(latestSignal.signal === "BUY" || latestSignal.signal === "STRONG BUY" || latestSignal.signal === "SELL" || latestSignal.signal === "STRONG SELL") && (
          <div className={`px-6 py-3 border-b ${border} flex items-center gap-6`}>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-cyan-400" />
              <span className={`text-sm ${textMuted}`}>Entry:</span>
              <span className={`text-sm font-medium ${textPrimary}`}>Rs.{latestSignal.close.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#ef4444]" />
              <span className={`text-sm ${textMuted}`}>SL:</span>
              <span className="text-sm font-medium text-[#ef4444]">Rs.{latestSignal.stop_loss.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#22c55e]" />
              <span className={`text-sm ${textMuted}`}>TP:</span>
              <span className="text-sm font-medium text-[#22c55e]">Rs.{latestSignal.take_profit.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Main Charts */}
        <div className={`grid grid-cols-1 lg:grid-cols-3 border-b ${border}`}>
          {/* Price Chart with EMAs */}
          <div className={`lg:col-span-2 p-6 border-r ${border}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-semibold ${textPrimary}`}>Price & EMA Crossover</h3>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 bg-[#94a3b8]" />
                  <span className={textMuted}>Price</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 bg-[#3b82f6]" />
                  <span className={textMuted}>EMA 9</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 bg-[#f59e0b]" />
                  <span className={textMuted}>EMA 21</span>
                </div>
              </div>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={priceData}>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: tickColor, fontSize: 11 }} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: tickColor, fontSize: 11 }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
                    domain={["dataMin - 200", "dataMax + 200"]}
                  />
                  <Tooltip content={<CustomPriceTooltip isDark={isDark} />} />
                  <Line type="monotone" dataKey="close" stroke="#94a3b8" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ema_fast" stroke="#3b82f6" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="ema_slow" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* RSI Chart */}
          <div className="p-6">
            <h3 className={`font-semibold mb-4 ${textPrimary}`}>RSI ({config.rsi_period})</h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={priceData}>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: tickColor, fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: tickColor, fontSize: 11 }} domain={[0, 100]} ticks={[0, 30, 50, 70, 100]} />
                  <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <ReferenceLine y={50} stroke={tickColor} strokeDasharray="3 3" strokeOpacity={0.3} />
                  <Area type="monotone" dataKey="rsi" stroke="#a855f7" fill="#a855f7" fillOpacity={0.2} strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between mt-2 text-xs">
              <span className="text-[#22c55e]">Oversold {"<"} 35</span>
              <span className="text-[#ef4444]">Overbought {">"} 65</span>
            </div>
          </div>
        </div>

        {/* Backtest & Statistics Row */}
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
                <span className={`text-sm ${textPrimary}`}>Rs.{backtestResults.start.toLocaleString()} → Rs.{backtestResults.final.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className={`text-sm ${textMuted}`}>Return</span>
                <span className={`text-sm font-semibold ${backtestResults.ret >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                  {backtestResults.ret >= 0 ? "+" : ""}{backtestResults.ret}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className={`text-sm ${textMuted}`}>CAGR</span>
                <span className={`text-sm ${backtestResults.cagr >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                  {backtestResults.cagr >= 0 ? "+" : ""}{backtestResults.cagr}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className={`text-sm ${textMuted}`}>Sharpe</span>
                <span className={`text-sm ${backtestResults.sharpe >= 1 ? "text-[#22c55e]" : "text-[#eab308]"}`}>{backtestResults.sharpe}</span>
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
                <span className={`text-sm ${textPrimary}`}>{backtestResults.trades}</span>
              </div>
              <div className="flex justify-between">
                <span className={`text-sm ${textMuted}`}>Win / Loss</span>
                <span className={`text-sm`}>
                  <span className="text-[#22c55e]">{backtestResults.wins}</span>
                  <span className={textMuted}> / </span>
                  <span className="text-[#ef4444]">{backtestResults.losses}</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className={`text-sm ${textMuted}`}>Win Rate</span>
                <span className={`text-sm ${textPrimary}`}>{backtestResults.winRate}%</span>
              </div>
              <div className="flex justify-between">
                <span className={`text-sm ${textMuted}`}>Avg W/L</span>
                <span className={`text-sm`}>
                  <span className="text-[#22c55e]">+{backtestResults.avgWin}%</span>
                  <span className={textMuted}> / </span>
                  <span className="text-[#ef4444]">{backtestResults.avgLoss}%</span>
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
                <span className={`text-sm ${backtestResults.profitFactor >= 1 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                  {backtestResults.profitFactor}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={`text-sm ${textMuted}`}>Max Drawdown</span>
                <span className="text-sm text-[#ef4444]">{backtestResults.maxDrawdown}%</span>
              </div>
              <div className="flex justify-between">
                <span className={`text-sm ${textMuted}`}>SL/TP Mult</span>
                <span className={`text-sm ${textPrimary}`}>1.5x ATR / 2:1 RR</span>
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
              {signalDistribution.map((item) => (
                <div key={item.signal} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getSignalColor(item.signal) }} />
                  <span className={`text-xs w-24 ${textMuted}`}>{item.signal}</span>
                  <div className={`flex-1 h-2 rounded-full ${t(isDark, "bg-[#334155]", "bg-[#e2e8f0]")}`}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${item.percentage}%`, backgroundColor: getSignalColor(item.signal) }}
                    />
                  </div>
                  <span className={`text-xs w-12 text-right ${textPrimary}`}>{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Signals Table */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {["Signals", "Trades", "Equity"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                    activeTab === tab
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

          {activeTab === "Signals" && (
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
                      <td className={`py-3 text-sm pr-4 ${textPrimary}`}>Rs.{row.close.toLocaleString()}</td>
                      <td className={`py-3 text-sm pr-4 ${textPrimary}`}>{row.rsi.toFixed(1)}</td>
                      <td className={`py-3 text-sm pr-4 ${row.vwap_dist >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                        {row.vwap_dist >= 0 ? "+" : ""}{row.vwap_dist.toFixed(2)}%
                      </td>
                      <td className={`py-3 text-sm pr-4 ${textPrimary}`}>{row.adx.toFixed(1)}</td>
                      <td className="py-3 text-sm pr-4">
                        <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: getRegimeColor(row.regime), color: "white" }}>
                          {row.regime}
                        </span>
                      </td>
                      <td className={`py-3 text-sm pr-4 ${row.score >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                        {row.score >= 0 ? "+" : ""}{row.score.toFixed(3)}
                      </td>
                      <td className="py-3 text-sm pr-4 text-cyan-400">{row.confidence}%</td>
                      <td className="py-3 text-sm">
                        <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: getSignalColor(row.signal), color: "white" }}>
                          {row.signal}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "Equity" && (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={equityCurve}>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: tickColor, fontSize: 11 }} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: tickColor, fontSize: 11 }}
                    tickFormatter={(v) => `Rs.${(v / 1000).toFixed(0)}k`}
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

          {activeTab === "Trades" && (
            <div className={`text-center py-12 ${textMuted}`}>
              <p>Trade history will appear here when connected to live data.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
