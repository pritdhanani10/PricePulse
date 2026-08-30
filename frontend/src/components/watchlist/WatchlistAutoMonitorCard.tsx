"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowDownRight, 
  ArrowUpRight, 
  Bell, 
  CheckCircle2, 
  LineChart, 
  MoreVertical, 
  Power, 
  Settings2, 
  Sliders, 
  Trash2, 
  Zap 
} from "lucide-react";
import { WatchlistItem } from "../../types/auth";
import { MarketTick } from "../../types/stock";
import { api } from "../../services/api";

interface WatchlistAutoMonitorCardProps {
  item: WatchlistItem;
  tick?: MarketTick;
  onItemUpdated: (updatedItem: WatchlistItem) => void;
  onRemoveItem: (instrumentId: string) => void;
  onSetAlert: (instrument: import("../../types/stock").Instrument) => void;
}

export function WatchlistAutoMonitorCard({
  item,
  tick,
  onItemUpdated,
  onRemoveItem,
  onSetAlert,
}: WatchlistAutoMonitorCardProps) {
  const router = useRouter();
  const inst = item.instrument;
  const price = tick?.price ?? inst.base_price;
  const change = tick?.change ?? 0;
  const changePct = tick?.change_percent ?? 0;
  const isUp = change >= 0;

  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [buyPercent, setBuyPercent] = useState<number>(item.buy_percent || 3.0);
  const [sellPercent, setSellPercent] = useState<number>(item.sell_percent || 3.0);

  // Approximate reference triggers based on base/current price or configured %
  const estBuyTrigger = price * (1 + (item.buy_percent || 3.0) / 100);
  const estSellTrigger = price * (1 - (item.sell_percent || 3.0) / 100);

  const handleToggleAutoMonitor = async () => {
    setIsUpdating(true);
    try {
      const updatedWl = await api.updateWatchlistItem(item.watchlist_id, item.id, {
        auto_monitor: !item.auto_monitor,
      });
      const updatedItem = updatedWl.items.find((i) => i.id === item.id);
      if (updatedItem) onItemUpdated(updatedItem);
    } catch (err: any) {
      alert(err.message || "Failed to toggle auto-monitor");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsUpdating(true);
    try {
      const updatedWl = await api.updateWatchlistItem(item.watchlist_id, item.id, {
        buy_percent: buyPercent,
        sell_percent: sellPercent,
      });
      const updatedItem = updatedWl.items.find((i) => i.id === item.id);
      if (updatedItem) onItemUpdated(updatedItem);
      setShowConfig(false);
    } catch (err: any) {
      alert(err.message || "Failed to update strategy config");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div
      className={`relative flex flex-col justify-between rounded-2xl border bg-surface p-4 transition-all duration-300 shadow-xl group ${
        item.auto_monitor
          ? "border-cyan-500/40 hover:border-cyan-400/80 shadow-cyan-950/20"
          : "border-surface-border hover:border-surface-border/80 opacity-80"
      }`}
    >
      <div>
        {/* Top Header: Symbol, Type, Status Pill, Toggle */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 font-black text-white text-base">
              <span>{inst.symbol}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-light text-gray-400 font-mono">
                {inst.exchange}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">
                {inst.instrument_type}
              </span>
            </div>
            <p className="text-xs text-gray-400 truncate max-w-[200px] mt-0.5">{inst.name}</p>
          </div>

          {/* Auto-Monitor Toggle & Config */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowConfig(!showConfig)}
              title="Configure 5m Strategy Triggers"
              className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-400 hover:bg-cyan-950/40 transition-colors"
            >
              <Settings2 className="h-4 w-4" />
            </button>
            <button
              onClick={handleToggleAutoMonitor}
              disabled={isUpdating}
              title={item.auto_monitor ? "Auto-Monitoring Active (Click to Pause)" : "Auto-Monitoring Paused (Click to Enable)"}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-extrabold transition-all border ${
                item.auto_monitor
                  ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-500/20"
                  : "bg-surface-light text-gray-400 border-surface-border hover:text-white"
              }`}
            >
              <span className="relative flex h-2 w-2">
                {item.auto_monitor && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    item.auto_monitor ? "bg-emerald-500" : "bg-gray-500"
                  }`}
                />
              </span>
              <span>{item.auto_monitor ? "AUTO ON" : "PAUSED"}</span>
            </button>
          </div>
        </div>

        {/* Live Price & Change */}
        <div className="mt-3 flex items-baseline justify-between font-mono">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">
              ₹{price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div
            className={`flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded ${
              isUp
                ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                : "bg-rose-950 text-rose-400 border border-rose-800/60"
            }`}
          >
            {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {isUp ? "+" : ""}
            {changePct.toFixed(2)}%
          </div>
        </div>

        {/* 5-Minute Strategy Triggers Dashboard Bar */}
        <div className="mt-3 rounded-xl bg-black/40 border border-surface-border/80 p-2.5 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-gray-400 flex items-center gap-1 font-semibold">
              <Zap className="h-3 w-3 text-cyan-400" />
              5m Strategy Triggers:
            </span>
            <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/50">
              +{item.buy_percent || 3}% / -{item.sell_percent || 3}%
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            {/* BUY TRIGGER */}
            <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-900/50">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-emerald-400 font-extrabold uppercase">BUY Target</span>
                <span className="text-[9px] text-gray-400">+{item.buy_percent}%</span>
              </div>
              <div className="text-sm font-black text-white mt-0.5">
                ₹{estBuyTrigger.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* SELL TRIGGER */}
            <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-900/50">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-rose-400 font-extrabold uppercase">SELL Target</span>
                <span className="text-[9px] text-gray-400">-{item.sell_percent}%</span>
              </div>
              <div className="text-sm font-black text-white mt-0.5">
                ₹{estSellTrigger.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        {/* Inline Config Drawer */}
        {showConfig && (
          <div className="mt-3 p-3 rounded-xl bg-surface-light border border-cyan-500/40 space-y-2 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between text-xs font-bold text-cyan-300">
              <span>Custom Strategy Thresholds</span>
              <button
                onClick={() => setShowConfig(false)}
                className="text-gray-400 hover:text-white text-[11px]"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[10px] text-gray-400 block font-mono">BUY Offset (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="20"
                  value={buyPercent}
                  onChange={(e) => setBuyPercent(parseFloat(e.target.value) || 3.0)}
                  className="w-full mt-1 px-2 py-1 rounded-lg bg-surface border border-surface-border text-white text-xs font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block font-mono">SELL Offset (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="20"
                  value={sellPercent}
                  onChange={(e) => setSellPercent(parseFloat(e.target.value) || 3.0)}
                  className="w-full mt-1 px-2 py-1 rounded-lg bg-surface border border-surface-border text-white text-xs font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
            <button
              onClick={handleSaveConfig}
              disabled={isUpdating}
              className="w-full mt-2 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors"
            >
              Save Strategy Rule
            </button>
          </div>
        )}
      </div>

      {/* Action Footer Bar */}
      <div className="mt-4 pt-3 border-t border-surface-border/70 flex items-center justify-between gap-2">
        <button
          onClick={() => onSetAlert(inst)}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 text-xs font-bold border border-cyan-500/30 transition-colors"
        >
          <Bell className="h-3.5 w-3.5" />
          Price Alert
        </button>

        <button
          onClick={() => router.push(`/analysis?symbol=${inst.symbol}`)}
          title="Open 5m Candlestick Analysis Terminal"
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface-light hover:bg-surface-border text-gray-200 text-xs font-semibold transition-colors"
        >
          <LineChart className="h-3.5 w-3.5 text-cyan-400" />
          <span>5m Chart</span>
        </button>

        <button
          onClick={() => onRemoveItem(inst.id)}
          title="Remove from Watchlist"
          className="p-2 rounded-xl text-gray-400 hover:text-rose-400 hover:bg-rose-950/40 text-xs transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
