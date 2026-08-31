"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { 
  ArrowDownRight, 
  ArrowUpRight, 
  BarChart2, 
  Compass, 
  History, 
  Layers, 
  LineChart, 
  Play, 
  RefreshCw, 
  Sliders, 
  Sparkles, 
  TrendingUp, 
  Zap 
} from "lucide-react";
import { Candle5m, Instrument, TechnicalAnalysisData } from "../../types/stock";
import { api } from "../../services/api";
import { useMarketSocket } from "../../context/MarketSocketContext";
import { InteractiveChart } from "../../components/analysis/InteractiveChart";
import { StrategyTriggerCards } from "../../components/strategy/StrategyTriggerCards";
import { StrategySignalHistory } from "../../components/strategy/StrategySignalHistory";
import { BacktestPanel } from "../../components/strategy/BacktestPanel";

function TechnicalAnalysisContent() {
  const searchParams = useSearchParams();
  const initialSymbol = searchParams.get("symbol") || "TEJASNET";

  const { ticks } = useMarketSocket();
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [symbol, setSymbol] = useState<string>(initialSymbol);
  const [timeframe, setTimeframe] = useState<string>("5m");
  const [analysisData, setAnalysisData] = useState<TechnicalAnalysisData | null>(null);
  const [latestCandle5m, setLatestCandle5m] = useState<Candle5m | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"strategy" | "backtest" | "signals">("strategy");

  // Indicator Toggles
  const [indicators, setIndicators] = useState({
    sma20: true,
    sma50: false,
    ema20: true,
    bb: false,
    vwap: true,
    rsi: true,
    macd: false,
    atr: false,
  });

  useEffect(() => {
    api.getInstruments().then((insts) => setInstruments(insts));
  }, []);

  const fetchAnalysisAndCandles = () => {
    setLoading(true);
    Promise.all([
      api.getTechnicalAnalysis(symbol, timeframe, 120).catch(() => null),
      api.get5mCandles(symbol, 60).catch(() => null),
    ])
      .then(([ta, candleRes]) => {
        if (ta) setAnalysisData(ta);
        if (candleRes && candleRes.latest_completed_candle) {
          setLatestCandle5m(candleRes.latest_completed_candle);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAnalysisAndCandles();
  }, [symbol, timeframe]);

  const toggleIndicator = (key: keyof typeof indicators) => {
    setIndicators((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const currentTick = ticks[symbol.toUpperCase()];
  const currentPrice = currentTick?.price || (analysisData?.candles.slice(-1)[0]?.close ?? 100);
  const isUp = (currentTick?.change || 0) >= 0;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <LineChart className="h-6 w-6 text-cyan-400" />
              Stock Analysis & 5m Strategy Terminal
            </h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono font-bold">
              5M CANDLE ENGINE
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Real-time 5-minute OHLC candlestick analysis, automated 3% trigger levels, and backtesting.
          </p>
        </div>

        {/* Symbol & Timeframe Dropdown Bar */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Symbol Select */}
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="rounded-xl bg-surface border border-surface-border px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-cyan-500 font-mono"
          >
            {instruments.map((inst) => (
              <option key={inst.id} value={inst.symbol}>
                {inst.symbol} — {inst.name}
              </option>
            ))}
          </select>

          {/* Timeframe Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-surface border border-surface-border font-mono text-xs">
            {(["5m", "15m", "1H", "1D"] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  timeframe === tf
                    ? "bg-cyan-600/20 text-cyan-300 border border-cyan-500/40"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <button
            onClick={fetchAnalysisAndCandles}
            className="p-2 rounded-xl bg-surface border border-surface-border text-gray-400 hover:text-cyan-400 transition-colors"
            title="Refresh chart & 5m strategy"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Live 5-Minute Strategy Trigger Cards */}
      <StrategyTriggerCards
        symbol={symbol}
        currentPrice={currentPrice}
        latestCandle={latestCandle5m}
      />

      {/* Indicator Toggles Bar */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl border border-surface-border bg-surface">
        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 mr-2">
          <Sliders className="h-3.5 w-3.5 text-cyan-400" />
          <span>Indicators:</span>
        </div>

        {[
          { key: "sma20", label: "SMA 20", color: "border-cyan-500/40 text-cyan-400 bg-cyan-950/40" },
          { key: "sma50", label: "SMA 50", color: "border-indigo-500/40 text-indigo-400 bg-indigo-950/40" },
          { key: "ema20", label: "EMA 20", color: "border-amber-500/40 text-amber-400 bg-amber-950/40" },
          { key: "vwap", label: "VWAP", color: "border-pink-500/40 text-pink-400 bg-pink-950/40" },
          { key: "bb", label: "Bollinger Bands", color: "border-purple-500/40 text-purple-400 bg-purple-950/40" },
          { key: "rsi", label: "RSI (14)", color: "border-sky-500/40 text-sky-400 bg-sky-950/40" },
        ].map(({ key, label, color }) => {
          const isActive = indicators[key as keyof typeof indicators];
          return (
            <button
              key={key}
              onClick={() => toggleIndicator(key as keyof typeof indicators)}
              className={`px-3 py-1 rounded-lg text-xs font-bold font-mono transition-all border ${
                isActive
                  ? color
                  : "bg-surface-light border-surface-border text-gray-500 hover:text-gray-300"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Main Candlestick Chart */}
      {analysisData ? (
        <InteractiveChart data={analysisData} activeIndicators={indicators} />
      ) : (
        <div className="flex items-center justify-center p-20 rounded-2xl border border-surface-border bg-surface text-gray-400 text-xs">
          Loading 5-minute candlestick chart for {symbol}...
        </div>
      )}

      {/* Bottom Strategy & Backtest Section Tabs */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-surface-border pb-2">
          <button
            onClick={() => setActiveTab("strategy")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold text-xs transition-all ${
              activeTab === "strategy"
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                : "text-gray-400 hover:text-white bg-surface-light/40"
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>5m Strategy Overview</span>
          </button>

          <button
            onClick={() => setActiveTab("signals")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all ${
              activeTab === "signals"
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Signal History Log</span>
          </button>

          <button
            onClick={() => setActiveTab("backtest")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all ${
              activeTab === "backtest"
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Play className="h-3.5 w-3.5" />
            <span>Strategy Backtester</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "strategy" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StrategySignalHistory symbol={symbol} />
            <div className="rounded-xl border border-surface-border bg-surface p-5 space-y-4 shadow-md">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="h-4 w-4 text-cyan-400" />
                Strategy Execution Rules
              </h3>
              <div className="space-y-3 text-xs text-gray-300">
                <div className="p-3 rounded-lg bg-background/70 border border-surface-border">
                  <div className="font-bold text-emerald-400">BUY Trigger Condition</div>
                  <p className="text-gray-400 mt-1">
                    Takes the reference candle's <strong className="text-gray-200">LOW</strong>. Trigger level = <code className="text-emerald-400">LOW × 1.03</code>.
                    Generates BUY SIGNAL automatically when <code className="text-white">Price ≥ BUY_TRIGGER_PRICE</code>.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-background/70 border border-surface-border">
                  <div className="font-bold text-rose-400">SELL Trigger Condition</div>
                  <p className="text-gray-400 mt-1">
                    Takes the reference candle's <strong className="text-gray-200">HIGH</strong>. Trigger level = <code className="text-rose-400">HIGH × 0.97</code>.
                    Generates SELL SIGNAL automatically when <code className="text-white">Price ≤ SELL_TRIGGER_PRICE</code>.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-background/70 border border-surface-border">
                  <div className="font-bold text-cyan-400">Lifecycle & Duplicate Protection</div>
                  <p className="text-gray-400 mt-1">
                    Triggers only evaluate finalized 5-minute candles. When a trigger is reached, it transitions from <span className="text-cyan-400">ACTIVE</span> to <span className="text-emerald-400">TRIGGERED</span> atomically, preventing duplicate signals.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "signals" && <StrategySignalHistory symbol={symbol} />}

        {activeTab === "backtest" && <BacktestPanel symbol={symbol} />}
      </div>
    </div>
  );
}

export default function TechnicalAnalysisPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Suspense fallback={<div className="p-12 text-center text-xs text-gray-400">Loading Analysis Terminal...</div>}>
        <TechnicalAnalysisContent />
      </Suspense>
    </div>
  );
}
