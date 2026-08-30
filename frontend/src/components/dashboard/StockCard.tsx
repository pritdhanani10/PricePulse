"use client";

import React, { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Bell, LineChart } from "lucide-react";
import { Instrument, MarketTick } from "../../types/stock";

interface StockCardProps {
  instrument: Instrument;
  tick?: MarketTick;
  onCreateAlert: (instrument: Instrument) => void;
  onOpenAnalysis: (symbol: string) => void;
}

export function StockCard({
  instrument,
  tick,
  onCreateAlert,
  onOpenAnalysis,
}: StockCardProps) {
  const [flashClass, setFlashClass] = useState<string>("");
  const prevPriceRef = useRef<number | null>(null);

  useEffect(() => {
    if (tick && prevPriceRef.current !== null) {
      if (tick.price > prevPriceRef.current) {
        setFlashClass("bg-emerald-500/15 ring-1 ring-emerald-500/50");
      } else if (tick.price < prevPriceRef.current) {
        setFlashClass("bg-red-500/15 ring-1 ring-red-500/50");
      }
      const timeout = setTimeout(() => setFlashClass(""), 600);
      return () => clearTimeout(timeout);
    }
    if (tick) {
      prevPriceRef.current = tick.price;
    }
  }, [tick?.price]);

  const price = tick?.price ?? instrument.base_price;
  const open = tick?.open ?? instrument.base_price;
  const high = tick?.high ?? price * 1.01;
  const low = tick?.low ?? price * 0.99;
  const change = tick?.change ?? (price - open);
  const changePercent = tick?.change_percent ?? ((change / open) * 100);
  const isUp = change >= 0;

  // Day Range position (0 to 100%)
  const rangePercent = Math.min(
    100,
    Math.max(0, high === low ? 50 : ((price - low) / (high - low)) * 100)
  );

  return (
    <div
      className={`relative flex flex-col justify-between rounded-xl border border-surface-border bg-surface p-4 transition-all duration-300 hover:border-cyan-500/40 hover:shadow-lg ${flashClass}`}
    >
      <div>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-base tracking-tight">{instrument.symbol}</span>
              <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-surface-light text-gray-400 border border-surface-border">
                {instrument.exchange}
              </span>
            </div>
            <p className="text-xs text-gray-400 truncate max-w-[170px] mt-0.5">{instrument.name}</p>
          </div>

          <div
            className={`flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-bold font-mono ${
              isUp
                ? "bg-emerald-950 text-bullish-text border border-emerald-800/40"
                : "bg-red-950 text-bearish-text border border-red-800/40"
            }`}
          >
            {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            <span>
              {isUp ? "+" : ""}
              {changePercent.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Current Price */}
        <div className="mt-3 flex items-baseline justify-between">
          <div className="text-xl font-extrabold text-white font-mono tracking-tight">
            ₹{price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className={`text-xs font-semibold font-mono ${isUp ? "text-bullish-text" : "text-bearish-text"}`}>
            {isUp ? "+" : ""}
            {change.toFixed(2)}
          </div>
        </div>

        {/* Day Range Bar */}
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-gray-400 font-mono">
            <span>L: ₹{low.toFixed(2)}</span>
            <span>H: ₹{high.toFixed(2)}</span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-surface-light overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isUp ? "bg-bullish" : "bg-bearish"
              }`}
              style={{ width: `${rangePercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 pt-3 border-t border-surface-border/70 flex items-center gap-2">
        <button
          onClick={() => onCreateAlert(instrument)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition-all hover:scale-[1.02]"
        >
          <Bell className="h-3.5 w-3.5" />
          Set Alert
        </button>

        <button
          onClick={() => onOpenAnalysis(instrument.symbol)}
          title="Open Technical Analysis Chart"
          className="p-1.5 rounded-lg bg-surface-light hover:bg-surface-border text-gray-300 hover:text-white border border-surface-border text-xs transition-colors"
        >
          <LineChart className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
