"use client";

import React, { useState } from "react";
import { 
  ArrowDownRight, 
  ArrowUpRight, 
  BarChart2, 
  CheckCircle2, 
  Play, 
  RefreshCw, 
  ShieldAlert, 
  Sliders, 
  TrendingUp, 
  Zap 
} from "lucide-react";
import { BacktestResult } from "../../types/stock";
import { api } from "../../services/api";

interface BacktestPanelProps {
  symbol: string;
}

export function BacktestPanel({ symbol }: BacktestPanelProps) {
  const [buyPercent, setBuyPercent] = useState<number>(3.0);
  const [sellPercent, setSellPercent] = useState<number>(3.0);
  const [candleLimit, setCandleLimit] = useState<number>(100);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const runSimulation = () => {
    if (!symbol) return;
    setLoading(true);
    api
      .runBacktest({
        symbol,
        timeframe: "5m",
        buy_percent: buyPercent,
        sell_percent: sellPercent,
        candle_limit: candleLimit,
        buy_from: "LOW",
        sell_from: "HIGH",
        lifecycle_policy: "REPLACE_ON_NEW_CANDLE",
      })
      .then((data) => setResult(data))
      .catch((err) => console.error("Backtest failed", err))
      .finally(() => setLoading(false));
  };

  return (
    <div className="rounded-xl border border-surface-border bg-surface p-5 space-y-6 shadow-md">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-surface-border/60">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
            <BarChart2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">5-Minute Strategy Backtester</h3>
            <p className="text-xs text-gray-400">
              Chronological simulation on historical 5m OHLC candles with zero look-ahead bias
            </p>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={runSimulation}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all"
        >
          {loading ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5 fill-current" />
          )}
          <span>{loading ? "Simulating..." : "Run Backtest"}</span>
        </button>
      </div>

      {/* Parameter Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-background/60 border border-surface-border/60">
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5">
            BUY Threshold (+%)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="15.0"
              value={buyPercent}
              onChange={(e) => setBuyPercent(parseFloat(e.target.value) || 3.0)}
              className="w-full px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-sm font-mono text-emerald-400 focus:outline-none focus:border-cyan-500"
            />
            <span className="text-xs text-gray-400 font-mono">%</span>
          </div>
          <span className="text-[10px] text-gray-500 mt-1 block">Low + {buyPercent}%</span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5">
            SELL Threshold (-%)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="15.0"
              value={sellPercent}
              onChange={(e) => setSellPercent(parseFloat(e.target.value) || 3.0)}
              className="w-full px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-sm font-mono text-rose-400 focus:outline-none focus:border-cyan-500"
            />
            <span className="text-xs text-gray-400 font-mono">%</span>
          </div>
          <span className="text-[10px] text-gray-500 mt-1 block">High - {sellPercent}%</span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5">
            Candle History Length
          </label>
          <select
            value={candleLimit}
            onChange={(e) => setCandleLimit(parseInt(e.target.value))}
            className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-sm font-mono text-white focus:outline-none focus:border-cyan-500"
          >
            <option value={50}>50 Candles (~4 Hours)</option>
            <option value={100}>100 Candles (~1.5 Days)</option>
            <option value={150}>150 Candles (~2.5 Days)</option>
          </select>
          <span className="text-[10px] text-gray-500 mt-1 block">5-minute resolution</span>
        </div>
      </div>

      {/* Results View */}
      {result && (
        <div className="space-y-4 pt-2">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-surface-light border border-surface-border">
              <span className="text-[10px] text-gray-400 uppercase font-semibold">Candles Analyzed</span>
              <div className="text-xl font-bold text-white font-mono mt-0.5">
                {result.total_candles_analyzed}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-light border border-surface-border">
              <span className="text-[10px] text-gray-400 uppercase font-semibold">Total Signals</span>
              <div className="text-xl font-bold text-cyan-400 font-mono mt-0.5">
                {result.total_signals}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40">
              <span className="text-[10px] text-emerald-400 uppercase font-semibold">BUY Signals</span>
              <div className="text-xl font-bold text-emerald-400 font-mono mt-0.5">
                {result.buy_signals}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-800/40">
              <span className="text-[10px] text-rose-400 uppercase font-semibold">SELL Signals</span>
              <div className="text-xl font-bold text-rose-400 font-mono mt-0.5">
                {result.sell_signals}
              </div>
            </div>
          </div>

          {/* Historical Execution Log */}
          {result.signals.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-300">Simulated Signal Execution Timeline</h4>
              <div className="max-h-60 overflow-y-auto rounded-lg border border-surface-border/60 bg-background/50">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-surface border-b border-surface-border text-[10px] text-gray-400 uppercase">
                    <tr>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Ref Low/High</th>
                      <th className="py-2 px-3">Trigger Target</th>
                      <th className="py-2 px-3">Executed Price</th>
                      <th className="py-2 px-3">Candle Return</th>
                      <th className="py-2 px-3">Trigger Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border/40 font-mono">
                    {result.signals.map((sig, idx) => {
                      const isBuy = sig.signal_type === "BUY";
                      const ret = sig.price_change_from_trigger ?? 0;
                      const isProfit = ret >= 0;
                      return (
                        <tr key={idx} className="hover:bg-surface-light/40">
                          <td className="py-2 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                                isBuy
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                  : "bg-rose-950 text-rose-400 border border-rose-800"
                              }`}
                            >
                              {sig.signal_type}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-gray-300">₹{sig.reference_price.toFixed(2)}</td>
                          <td className="py-2 px-3 font-semibold text-white">₹{sig.trigger_price.toFixed(2)}</td>
                          <td className={`py-2 px-3 font-bold ${isBuy ? "text-emerald-400" : "text-rose-400"}`}>
                            ₹{sig.actual_triggered_price.toFixed(2)}
                          </td>
                          <td className={`py-2 px-3 font-semibold ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>
                            {isProfit ? "+" : ""}{ret.toFixed(2)}%
                          </td>
                          <td className="py-2 px-3 font-sans text-gray-400">
                            {new Date(sig.triggered_candle_time).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="p-3 rounded-lg bg-surface-light/60 border border-surface-border text-[11px] text-gray-400 flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p>{result.disclaimer}</p>
          </div>
        </div>
      )}
    </div>
  );
}
