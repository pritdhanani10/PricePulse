"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, BarChart2, Layers, LineChart, RefreshCw, Sliders } from "lucide-react";
import { Instrument, TechnicalAnalysisData } from "../../types/stock";
import { api } from "../../services/api";
import { useMarketSocket } from "../../context/MarketSocketContext";
import { InteractiveChart } from "../../components/analysis/InteractiveChart";

function TechnicalAnalysisContent() {
  const searchParams = useSearchParams();
  const initialSymbol = searchParams.get("symbol") || "NIFTY50";

  const { ticks } = useMarketSocket();
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [symbol, setSymbol] = useState<string>(initialSymbol);
  const [timeframe, setTimeframe] = useState<string>("1D");
  const [analysisData, setAnalysisData] = useState<TechnicalAnalysisData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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

  const fetchAnalysis = () => {
    setLoading(true);
    api
      .getTechnicalAnalysis(symbol, timeframe, 120)
      .then((data) => setAnalysisData(data))
      .catch((err) => console.error("Failed to load analysis data", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAnalysis();
  }, [symbol, timeframe]);

  const toggleIndicator = (key: keyof typeof indicators) => {
    setIndicators((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const currentTick = ticks[symbol.toUpperCase()];
  const isUp = (currentTick?.change || 0) >= 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <LineChart className="h-6 w-6 text-cyan-400" />
            Technical Analysis Terminal
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Quantitative moving averages, momentum oscillators, volatility bands, and VWAP metrics.
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
            {(["15m", "1H", "1D"] as const).map((tf) => (
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
            onClick={fetchAnalysis}
            className="p-2 rounded-xl bg-surface border border-surface-border text-gray-400 hover:text-cyan-400 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Live Instrument Metric Pill */}
      {currentTick && (
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border border-surface-border bg-surface">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400 font-mono font-bold">
              {symbol.substring(0, 3)}
            </div>
            <div>
              <div className="text-sm font-extrabold text-white">{symbol}</div>
              <div className="text-xs text-gray-400 font-mono">NSE Live Tick Feed</div>
            </div>
          </div>

          <div className="flex items-center gap-6 font-mono text-xs">
            <div>
              <span className="text-[10px] text-gray-400 block">LTP Price</span>
              <span className="text-base font-extrabold text-white">
                ₹{currentTick.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 block">Day Change</span>
              <span className={`font-bold ${isUp ? "text-bullish-text" : "text-bearish-text"}`}>
                {isUp ? "+" : ""}
                {currentTick.change_percent.toFixed(2)}% (₹{currentTick.change.toFixed(2)})
              </span>
            </div>

            <div className="hidden sm:block">
              <span className="text-[10px] text-gray-400 block">Day High / Low</span>
              <span className="text-gray-200">
                ₹{currentTick.high.toFixed(1)} / ₹{currentTick.low.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      )}

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

      {/* Main Interactive Candlestick Chart */}
      {analysisData ? (
        <InteractiveChart data={analysisData} activeIndicators={indicators} />
      ) : (
        <div className="flex items-center justify-center p-20 rounded-2xl border border-surface-border bg-surface text-gray-400 text-xs">
          Loading technical analysis candlestick bars...
        </div>
      )}
    </div>
  );
}

export default function TechnicalAnalysisPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-gray-400">Loading Analysis Terminal...</div>}>
      <TechnicalAnalysisContent />
    </Suspense>
  );
}
