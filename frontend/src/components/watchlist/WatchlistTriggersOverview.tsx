"use client";

import React from "react";
import Link from "next/link";
import { 
  ArrowDownRight, 
  ArrowUpRight, 
  CheckCircle2, 
  Eye, 
  LineChart, 
  Radio, 
  Sliders, 
  Zap 
} from "lucide-react";
import { AutoMonitorItemSummary, MarketTick } from "../../types/stock";

interface WatchlistTriggersOverviewProps {
  summaries: AutoMonitorItemSummary[];
  ticks: Record<string, MarketTick>;
  loading: boolean;
  onRefresh: () => void;
}

export function WatchlistTriggersOverview({
  summaries,
  ticks,
  loading,
}: WatchlistTriggersOverviewProps) {
  if (summaries.length === 0) {
    return (
      <div className="p-12 text-center rounded-2xl border border-surface-border bg-surface">
        <Zap className="h-8 w-8 text-cyan-400 mx-auto mb-2 opacity-60" />
        <h3 className="text-sm font-bold text-white">No Active Auto-Monitored Stocks</h3>
        <p className="text-xs text-gray-400 mt-1">
          Add stocks to your Watchlist and keep Auto-Monitoring enabled to track 5-minute BUY/SELL triggers in real time.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-surface-border bg-surface overflow-hidden shadow-xl">
      <div className="p-4 border-b border-surface-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
          <h2 className="text-sm font-black text-white uppercase tracking-wider">
            Live 5m Strategy Trigger Radar ({summaries.length} Monitored)
          </h2>
        </div>
        <span className="text-[11px] text-gray-400 font-mono">
          Engine: 5-Minute 3% Threshold
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-surface-light border-b border-surface-border text-gray-400 uppercase text-[10px]">
            <tr>
              <th className="px-4 py-3">Symbol & Basket</th>
              <th className="px-4 py-3">Live Price</th>
              <th className="px-4 py-3">5m BUY Trigger Target</th>
              <th className="px-4 py-3">5m SELL Trigger Target</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border/60">
            {summaries.map((s) => {
              const liveTick = ticks[s.symbol.toUpperCase()];
              const price = liveTick?.price ?? s.current_price;
              const change = liveTick?.change ?? 0;
              const changePct = liveTick?.change_percent ?? 0;
              const isUp = change >= 0;

              // Calculate live distance to BUY/SELL
              const buyTarget = s.buy_trigger_price ?? price * (1 + s.buy_percent / 100);
              const sellTarget = s.sell_trigger_price ?? price * (1 - s.sell_percent / 100);
              const buyDistance = ((buyTarget - price) / price) * 100;
              const sellDistance = ((price - sellTarget) / price) * 100;

              return (
                <tr key={s.item_id} className="hover:bg-surface-light/40 transition-colors">
                  {/* Symbol */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-white text-sm">{s.symbol}</span>
                      <span className="text-[10px] px-1 rounded bg-surface-light text-gray-400">
                        {s.instrument_type}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400 font-sans truncate max-w-[150px]">
                      {s.watchlist_name} • {s.name}
                    </div>
                  </td>

                  {/* Live Price */}
                  <td className="px-4 py-3.5">
                    <div className="font-extrabold text-white text-sm">
                      ₹{price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                    <div className={`text-[11px] ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                      {isUp ? "+" : ""}
                      {changePct.toFixed(2)}%
                    </div>
                  </td>

                  {/* BUY Target */}
                  <td className="px-4 py-3.5">
                    <div className="text-emerald-300 font-bold">
                      ₹{buyTarget.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-gray-400 flex items-center gap-1">
                      <span>Dist:</span>
                      <span className="text-emerald-400 font-semibold">
                        +{buyDistance.toFixed(2)}%
                      </span>
                    </div>
                  </td>

                  {/* SELL Target */}
                  <td className="px-4 py-3.5">
                    <div className="text-rose-300 font-bold">
                      ₹{sellTarget.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-gray-400 flex items-center gap-1">
                      <span>Dist:</span>
                      <span className="text-rose-400 font-semibold">
                        -{sellDistance.toFixed(2)}%
                      </span>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                      MONITORING
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3.5 text-right">
                    <Link
                      href={`/analysis?symbol=${s.symbol}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 text-[11px] font-bold border border-cyan-500/30 transition-colors"
                    >
                      <LineChart className="h-3 w-3" />
                      5m Terminal
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
