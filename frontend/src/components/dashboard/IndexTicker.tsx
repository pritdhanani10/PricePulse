"use client";

import React from "react";
import { ArrowDownRight, ArrowUpRight, Flame } from "lucide-react";
import { MarketTick } from "../../types/stock";

interface IndexTickerProps {
  ticks: Record<string, MarketTick>;
  onSelectSymbol?: (symbol: string) => void;
}

export function IndexTicker({ ticks, onSelectSymbol }: IndexTickerProps) {
  const indexSymbols = ["NIFTY50", "BANKNIFTY", "FINNIFTY"];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
      {indexSymbols.map((symbol) => {
        const tick = ticks[symbol];
        const isUp = (tick?.change || 0) >= 0;
        const displayName =
          symbol === "NIFTY50"
            ? "NIFTY 50"
            : symbol === "BANKNIFTY"
            ? "NIFTY BANK"
            : "FIN NIFTY";

        return (
          <div
            key={symbol}
            onClick={() => onSelectSymbol && onSelectSymbol(symbol)}
            className="group relative overflow-hidden rounded-2xl border border-surface-border bg-gradient-to-b from-surface to-surface/60 p-5 shadow-xl hover:border-cyan-500/40 transition-all cursor-pointer"
          >
            {/* Glow backdrop */}
            <div
              className={`absolute -right-8 -bottom-8 h-28 w-28 rounded-full blur-3xl opacity-20 pointer-events-none transition-all group-hover:scale-150 ${
                isUp ? "bg-bullish" : "bg-bearish"
              }`}
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  {displayName}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-light border border-surface-border text-gray-300 font-mono">
                  INDEX
                </span>
              </div>
              <div
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                  isUp
                    ? "bg-emerald-950/80 text-bullish-text border border-emerald-800/40"
                    : "bg-red-950/80 text-bearish-text border border-red-800/40"
                }`}
              >
                {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                <span>
                  {isUp ? "+" : ""}
                  {tick ? tick.change_percent.toFixed(2) : "0.00"}%
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-baseline justify-between">
              <div className="text-2xl font-black text-white font-mono tracking-tight">
                ₹{tick ? tick.price.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "---"}
              </div>
              <div
                className={`text-xs font-semibold font-mono ${
                  isUp ? "text-bullish-text" : "text-bearish-text"
                }`}
              >
                {isUp ? "+" : ""}
                {tick ? tick.change.toFixed(2) : "0.00"}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-surface-border/60 flex items-center justify-between text-[11px] text-gray-400 font-mono">
              <div>
                Open: <span className="text-gray-200">₹{tick ? tick.open.toLocaleString("en-IN") : "---"}</span>
              </div>
              <div>
                H: <span className="text-gray-200">₹{tick ? tick.high.toLocaleString("en-IN") : "---"}</span>
              </div>
              <div>
                L: <span className="text-gray-200">₹{tick ? tick.low.toLocaleString("en-IN") : "---"}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
