"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { 
  ArrowDownRight, 
  ArrowUpRight, 
  BarChart2, 
  Compass, 
  Layers, 
  Search, 
  Sparkles, 
  TrendingUp, 
  Zap,
  Activity,
  ArrowRight
} from "lucide-react";
import { IndexCategoryResponse, IndexConstituent } from "../../types/stock";
import { api } from "../../services/api";
import { useMarketSocket } from "../../context/MarketSocketContext";

type CategoryType = "MIDCAP" | "SMALLCAP" | "MICROCAP";

const CATEGORIES: { key: CategoryType; label: string; sub: string; icon: any; color: string; bgGradient: string }[] = [
  {
    key: "MIDCAP",
    label: "NIFTY MIDCAP",
    sub: "NIFTY Midcap 100 Constituents",
    icon: TrendingUp,
    color: "text-amber-400",
    bgGradient: "from-amber-500/20 via-amber-500/5 to-transparent",
  },
  {
    key: "SMALLCAP",
    label: "NIFTY SMALLCAP",
    sub: "NIFTY Smallcap 100 Constituents",
    icon: Zap,
    color: "text-cyan-400",
    bgGradient: "from-cyan-500/20 via-cyan-500/5 to-transparent",
  },
  {
    key: "MICROCAP",
    label: "NIFTY MICROCAP",
    sub: "NIFTY Microcap 250 Constituents",
    icon: Sparkles,
    color: "text-purple-400",
    bgGradient: "from-purple-500/20 via-purple-500/5 to-transparent",
  },
];

export function IndexExplorer() {
  const [activeCategory, setActiveCategory] = useState<CategoryType>("SMALLCAP");
  const [indexData, setIndexData] = useState<IndexCategoryResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const { ticks } = useMarketSocket();

  useEffect(() => {
    setLoading(true);
    api
      .getIndexByCategory(activeCategory)
      .then((data) => setIndexData(data))
      .catch((err) => console.error("Failed to load index category", err))
      .finally(() => setLoading(false));
  }, [activeCategory]);

  const constituents = indexData?.constituents || [];
  const filtered = constituents.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    return c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-surface-border bg-gradient-to-r from-surface-light via-surface to-background p-6 sm:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold">
              <Layers className="h-3.5 w-3.5" />
              <span>Official NSE Hierarchy Explorer</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Indian Stock Index Explorer
            </h1>
            <p className="text-sm text-gray-400 max-w-2xl">
              Explore constituent stocks across <strong className="text-gray-200">NIFTY MIDCAP</strong>,{" "}
              <strong className="text-gray-200">NIFTY SMALLCAP</strong>, and{" "}
              <strong className="text-gray-200">NIFTY MICROCAP</strong>. Run automated 5-minute 3% candle breakout & reversal strategies on any constituent.
            </p>
          </div>

          {/* Quick Strategy Info Box */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-light/80 border border-surface-border backdrop-blur-md">
            <div className="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-400">Strategy Engine</div>
              <div className="text-sm font-bold text-white">5-Min 3% Candle Engine</div>
              <div className="text-[11px] text-emerald-400 font-medium">BUY: Low +3% | SELL: High -3%</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Main Index Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isSelected = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => {
                setActiveCategory(cat.key);
                setSearchQuery("");
              }}
              className={`group relative overflow-hidden rounded-xl border p-5 text-left transition-all duration-200 ${
                isSelected
                  ? "border-cyan-500/50 bg-surface-light shadow-lg shadow-cyan-500/5 ring-1 ring-cyan-500/30"
                  : "border-surface-border bg-surface hover:border-gray-700 hover:bg-surface-light/60"
              }`}
            >
              <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${cat.bgGradient} blur-2xl transition-all group-hover:scale-125`} />
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg bg-surface border border-surface-border ${cat.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className={`font-bold text-base ${isSelected ? "text-white" : "text-gray-200"}`}>
                      {cat.label}
                    </h2>
                    <p className="text-xs text-gray-400">{cat.sub}</p>
                  </div>
                </div>
                {isSelected && (
                  <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Index Summary Bar & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-xl bg-surface border border-surface-border">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white">
            {indexData?.name || "Constituents"}
          </span>
          <span className="px-2 py-0.5 rounded-md bg-surface-light text-xs font-mono text-cyan-400 border border-surface-border">
            {filtered.length} Stocks
          </span>
          <span className="text-xs text-gray-400 hidden sm:inline">
            Exchange: <strong className="text-gray-200">NSE</strong>
          </span>
        </div>

        {/* Search */}
        <div className="relative min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeCategory.toLowerCase()} stocks (e.g. Tejas)...`}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-background border border-surface-border text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>
      </div>

      {/* Constituent Stocks Grid / Table */}
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-surface-border bg-surface">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
            <p className="text-sm text-gray-400">Loading {activeCategory} constituents...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-surface-border bg-surface text-center p-6">
          <Compass className="h-10 w-10 text-gray-500 mb-3" />
          <p className="text-base font-semibold text-gray-300">No stocks found matching "{searchQuery}"</p>
          <p className="text-xs text-gray-500 mt-1">Try another search term or switch index category above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((stock) => {
            const liveTick = ticks[stock.symbol.toUpperCase()];
            const price = liveTick?.price || stock.current_price;
            const change = liveTick?.change ?? stock.change;
            const changePct = liveTick?.change_percent ?? stock.change_percent;
            const isUp = change >= 0;

            // Strategy trigger calculations for preview
            const buyTarget = (price * 1.03).toFixed(2);
            const sellTarget = (price * 0.97).toFixed(2);

            return (
              <div
                key={stock.id}
                className="group relative overflow-hidden rounded-xl border border-surface-border bg-surface p-5 hover:border-cyan-500/40 hover:bg-surface-light/80 transition-all duration-200 shadow-md flex flex-col justify-between"
              >
                <div>
                  {/* Top: Symbol & Exchange */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-base text-white tracking-tight group-hover:text-cyan-400 transition-colors">
                          {stock.symbol}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-border text-gray-300">
                          {stock.exchange}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{stock.name}</p>
                    </div>

                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
                      {activeCategory}
                    </span>
                  </div>

                  {/* Price Row */}
                  <div className="my-4 flex items-baseline justify-between border-y border-surface-border/60 py-3">
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Live Price</div>
                      <div className="text-xl font-black text-white">₹{price.toFixed(2)}</div>
                    </div>
                    <div
                      className={`flex items-center gap-1 font-semibold text-sm px-2.5 py-1 rounded-lg ${
                        isUp ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                      }`}
                    >
                      {isUp ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      <span>
                        {isUp ? "+" : ""}
                        {change.toFixed(2)} ({isUp ? "+" : ""}
                        {changePct.toFixed(2)}%)
                      </span>
                    </div>
                  </div>

                  {/* 5m Strategy Preview Targets */}
                  <div className="grid grid-cols-2 gap-2 mb-4 p-2.5 rounded-lg bg-background/60 border border-surface-border/50 text-[11px]">
                    <div>
                      <div className="text-gray-400 text-[10px]">BUY Target (+3%)</div>
                      <div className="font-bold text-emerald-400 font-mono">₹{buyTarget}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-[10px]">SELL Target (-3%)</div>
                      <div className="font-bold text-rose-400 font-mono">₹{sellTarget}</div>
                    </div>
                  </div>
                </div>

                {/* Direct Action Button */}
                <Link
                  href={`/analysis?symbol=${stock.symbol}`}
                  className="mt-2 flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-cyan-500/10 hover:bg-cyan-500 text-cyan-400 hover:text-black font-semibold text-xs border border-cyan-500/30 transition-all duration-200 group-hover:shadow-lg group-hover:shadow-cyan-500/20"
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  <span>Analyze & Run 5m Strategy</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
