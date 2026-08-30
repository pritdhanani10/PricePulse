"use client";

import React, { useEffect, useState } from "react";
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  ShieldCheck, 
  Sliders, 
  Zap, 
  Activity, 
  CheckCircle2, 
  AlertCircle,
  BarChart3
} from "lucide-react";
import { Candle5m, StrategyConfig, StrategyTrigger } from "../../types/stock";
import { api } from "../../services/api";
import { useMarketSocket } from "../../context/MarketSocketContext";

interface StrategyTriggerCardsProps {
  symbol: string;
  currentPrice: number;
  latestCandle: Candle5m | null;
}

export function StrategyTriggerCards({
  symbol,
  currentPrice,
  latestCandle,
}: StrategyTriggerCardsProps) {
  const [triggers, setTriggers] = useState<StrategyTrigger[]>([]);
  const [config, setConfig] = useState<StrategyConfig>({
    timeframe: "5m",
    buy_from: "LOW",
    buy_percent: 3.0,
    sell_from: "HIGH",
    sell_percent: 3.0,
    lifecycle_policy: "REPLACE_ON_NEW_CANDLE",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    Promise.all([
      api.getActiveTriggers(symbol).catch(() => []),
      api.getStrategyConfig().then((res) => res.config).catch(() => null),
    ])
      .then(([activeTrigs, cfg]) => {
        setTriggers(activeTrigs);
        if (cfg) setConfig(cfg);
      })
      .finally(() => setLoading(false));
  }, [symbol, latestCandle]);

  // Compute live targets from latest completed candle or fallback to active triggers
  const refLow = latestCandle?.low ?? (currentPrice ? currentPrice * 0.99 : 100);
  const refHigh = latestCandle?.high ?? (currentPrice ? currentPrice * 1.01 : 100);

  const buyTargetPrice = Number((refLow * (1 + config.buy_percent / 100)).toFixed(2));
  const sellTargetPrice = Number((refHigh * (1 - config.sell_percent / 100)).toFixed(2));

  // Distance from current price to trigger
  const buyDistance = buyTargetPrice > 0 ? ((buyTargetPrice - currentPrice) / currentPrice) * 100 : 0;
  const sellDistance = sellTargetPrice > 0 ? ((currentPrice - sellTargetPrice) / currentPrice) * 100 : 0;

  const buyHit = currentPrice >= buyTargetPrice && buyTargetPrice > 0;
  const sellHit = currentPrice <= sellTargetPrice && sellTargetPrice > 0;

  return (
    <div className="space-y-4">
      {/* Strategy Bar Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-surface-light via-surface to-background border border-surface-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">5-Minute 3% Automated Candle Strategy</h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-semibold flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live Monitoring
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Reference: <strong className="text-gray-200">Completed 5m Candle</strong> | Lifecycle: <strong className="text-cyan-400">Rolling Candle ({config.lifecycle_policy})</strong>
            </p>
          </div>
        </div>

        {/* Current Strategy Parameters */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-md bg-surface border border-surface-border text-gray-300">
            TF: <strong>5m</strong>
          </span>
          <span className="px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-800/60 text-emerald-400">
            BUY: <strong>Low +{config.buy_percent}%</strong>
          </span>
          <span className="px-2.5 py-1 rounded-md bg-rose-950/40 border border-rose-800/60 text-rose-400">
            SELL: <strong>High -{config.sell_percent}%</strong>
          </span>
        </div>
      </div>

      {/* Grid: Latest Candle + BUY Trigger + SELL Trigger */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Latest Completed 5-Minute Candle */}
        <div className="rounded-xl border border-surface-border bg-surface p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-300">
                <Clock className="h-4 w-4 text-cyan-400" />
                <span>Latest Completed 5m Candle</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-light text-cyan-400 border border-surface-border">
                Finalized
              </span>
            </div>

            {latestCandle ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-background/60 border border-surface-border/50">
                    <span className="text-[10px] text-gray-400">Open</span>
                    <div className="font-bold text-white font-mono">₹{latestCandle.open.toFixed(2)}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-background/60 border border-surface-border/50">
                    <span className="text-[10px] text-gray-400">High (Sell Ref)</span>
                    <div className="font-bold text-rose-400 font-mono">₹{latestCandle.high.toFixed(2)}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-background/60 border border-surface-border/50">
                    <span className="text-[10px] text-gray-400">Low (Buy Ref)</span>
                    <div className="font-bold text-emerald-400 font-mono">₹{latestCandle.low.toFixed(2)}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-background/60 border border-surface-border/50">
                    <span className="text-[10px] text-gray-400">Close</span>
                    <div className="font-bold text-white font-mono">₹{latestCandle.close.toFixed(2)}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                  <span>Candle Time:</span>
                  <span className="font-mono text-gray-200">
                    {new Date(latestCandle.candle_start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex h-28 items-center justify-center text-xs text-gray-500">
                Awaiting 5-minute candle finalization...
              </div>
            )}
          </div>

          <div className="mt-3 pt-2 border-t border-surface-border/60 text-[10px] text-gray-500">
            *Strategy only evaluates closed candles to prevent repainting.
          </div>
        </div>

        {/* 2. Active BUY Trigger Card */}
        <div className={`rounded-xl border p-4 flex flex-col justify-between transition-all ${
          buyHit 
            ? "border-emerald-500 bg-emerald-950/20 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30" 
            : "border-surface-border bg-surface"
        }`}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-400">
                <ArrowUpRight className="h-4 w-4" />
                <span>BUY TRIGGER LEVEL</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                buyHit 
                  ? "bg-emerald-500 text-black animate-pulse" 
                  : "bg-emerald-950 text-emerald-400 border border-emerald-800"
              }`}>
                {buyHit ? "TRIGGER REACHED" : "ACTIVE"}
              </span>
            </div>

            <div className="mb-3">
              <div className="text-[10px] text-gray-400 uppercase font-semibold">Target Price (Low + 3%)</div>
              <div className="text-2xl font-black text-emerald-400 font-mono mt-0.5">
                ₹{buyTargetPrice.toFixed(2)}
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between text-gray-400">
                <span>Reference Low:</span>
                <span className="font-mono text-gray-200">₹{refLow.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-gray-400">
                <span>Current Price:</span>
                <span className="font-mono text-white font-semibold">₹{currentPrice.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-gray-400">
                <span>Distance to Trigger:</span>
                <span className={`font-mono font-bold ${buyDistance <= 0 ? "text-emerald-400" : "text-gray-300"}`}>
                  {buyDistance <= 0 ? "Triggered (0.00%)" : `+${buyDistance.toFixed(2)}%`}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-2 border-t border-surface-border/60 flex items-center justify-between text-[11px]">
            <span className="text-gray-400">Rule:</span>
            <span className="font-mono text-emerald-400 font-semibold">Price ≥ ₹{buyTargetPrice}</span>
          </div>
        </div>

        {/* 3. Active SELL Trigger Card */}
        <div className={`rounded-xl border p-4 flex flex-col justify-between transition-all ${
          sellHit 
            ? "border-rose-500 bg-rose-950/20 shadow-lg shadow-rose-500/10 ring-1 ring-rose-500/30" 
            : "border-surface-border bg-surface"
        }`}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 font-bold text-xs text-rose-400">
                <ArrowDownRight className="h-4 w-4" />
                <span>SELL TRIGGER LEVEL</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                sellHit 
                  ? "bg-rose-500 text-white animate-pulse" 
                  : "bg-rose-950 text-rose-400 border border-rose-800"
              }`}>
                {sellHit ? "TRIGGER REACHED" : "ACTIVE"}
              </span>
            </div>

            <div className="mb-3">
              <div className="text-[10px] text-gray-400 uppercase font-semibold">Target Price (High - 3%)</div>
              <div className="text-2xl font-black text-rose-400 font-mono mt-0.5">
                ₹{sellTargetPrice.toFixed(2)}
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between text-gray-400">
                <span>Reference High:</span>
                <span className="font-mono text-gray-200">₹{refHigh.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-gray-400">
                <span>Current Price:</span>
                <span className="font-mono text-white font-semibold">₹{currentPrice.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-gray-400">
                <span>Distance to Trigger:</span>
                <span className={`font-mono font-bold ${sellDistance <= 0 ? "text-rose-400" : "text-gray-300"}`}>
                  {sellDistance <= 0 ? "Triggered (0.00%)" : `-${sellDistance.toFixed(2)}%`}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-2 border-t border-surface-border/60 flex items-center justify-between text-[11px]">
            <span className="text-gray-400">Rule:</span>
            <span className="font-mono text-rose-400 font-semibold">Price ≤ ₹{sellTargetPrice}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
