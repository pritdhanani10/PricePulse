"use client";

import React, { useEffect, useState } from "react";
import { 
  ArrowDownRight, 
  ArrowUpRight, 
  Clock, 
  Filter, 
  History, 
  RefreshCw, 
  ShieldAlert, 
  Sparkles, 
  Zap 
} from "lucide-react";
import { StrategySignal } from "../../types/stock";
import { api } from "../../services/api";

interface StrategySignalHistoryProps {
  symbol?: string;
}

export function StrategySignalHistory({ symbol }: StrategySignalHistoryProps) {
  const [signals, setSignals] = useState<StrategySignal[]>([]);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [loading, setLoading] = useState(false);

  const fetchSignals = () => {
    setLoading(true);
    const params: any = { limit: 50 };
    if (symbol) params.symbol = symbol;
    if (filterType !== "ALL") params.signal_type = filterType;

    api
      .getStrategySignals(params)
      .then((data) => setSignals(data))
      .catch((err) => console.error("Failed to load strategy signals", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSignals();
  }, [symbol, filterType]);

  return (
    <div className="rounded-xl border border-surface-border bg-surface p-5 space-y-4 shadow-md">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-surface-border/60">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
            <History className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Strategy Signal History</h3>
            <p className="text-xs text-gray-400">
              {symbol ? `All generated BUY & SELL triggers for ${symbol}` : "Live stream of 5-minute candle strategy signals"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Signal Filter */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-background border border-surface-border text-xs">
            <button
              onClick={() => setFilterType("ALL")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                filterType === "ALL" ? "bg-surface-light text-white shadow-sm" : "text-gray-400 hover:text-white"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType("BUY")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                filterType === "BUY" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-gray-400 hover:text-emerald-400"
              }`}
            >
              BUY Only
            </button>
            <button
              onClick={() => setFilterType("SELL")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                filterType === "SELL" ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "text-gray-400 hover:text-rose-400"
              }`}
            >
              SELL Only
            </button>
          </div>

          <button
            onClick={fetchSignals}
            disabled={loading}
            className="p-2 rounded-lg bg-surface-light hover:bg-surface-border text-gray-300 hover:text-white transition-colors"
            title="Refresh signals"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Signals Table */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
        </div>
      ) : signals.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center text-center p-4">
          <Zap className="h-8 w-8 text-gray-600 mb-2" />
          <p className="text-sm font-semibold text-gray-300">No strategy signals generated yet</p>
          <p className="text-xs text-gray-500 max-w-sm mt-0.5">
            Signals are generated automatically when a completed 5-minute candle's Low +3% or High -3% level is reached by live market ticks.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border/60 text-[10px] text-gray-400 uppercase tracking-wider">
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Symbol</th>
                <th className="py-2.5 px-3">Trigger Target</th>
                <th className="py-2.5 px-3">Executed Price</th>
                <th className="py-2.5 px-3">Ref Price (5m)</th>
                <th className="py-2.5 px-3">Signal Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/40 font-mono">
              {signals.map((sig) => {
                const isBuy = sig.signal_type === "BUY";
                return (
                  <tr key={sig.id} className="hover:bg-surface-light/40 transition-colors">
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          isBuy
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                            : "bg-rose-950 text-rose-400 border border-rose-800"
                        }`}
                      >
                        {isBuy ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {sig.signal_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-sans font-bold text-white">
                      {sig.symbol}
                      {sig.index_category && (
                        <span className="ml-1.5 text-[9px] font-mono px-1 py-0.2 rounded bg-surface-light text-gray-400">
                          {sig.index_category}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-gray-300">
                      ₹{sig.trigger_price.toFixed(2)}
                    </td>
                    <td className={`py-2.5 px-3 font-bold ${isBuy ? "text-emerald-400" : "text-rose-400"}`}>
                      ₹{sig.actual_market_price.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-gray-400">
                      ₹{sig.reference_price ? sig.reference_price.toFixed(2) : "-"}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-gray-400">
                      {new Date(sig.signal_time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Strategy Disclaimer */}
      <div className="pt-2 text-[10px] text-gray-500 flex items-center gap-1.5 border-t border-surface-border/40">
        <ShieldAlert className="h-3 w-3 text-gray-500" />
        <span>Strategy signals are algorithmic indicators for technical analysis only. Not financial or investment advice.</span>
      </div>
    </div>
  );
}
