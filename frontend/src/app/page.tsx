"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Activity, ArrowRight, Bell, CheckCircle2, LineChart, ShieldCheck, Zap } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {/* Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800/80 text-cyan-300 text-xs font-semibold mb-6">
        <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
        High-Frequency Indian Market Trigger Engine
      </div>

      {/* Hero Heading */}
      <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white max-w-4xl leading-tight">
        Never Miss an Intraday Breakout on{" "}
        <span className="bg-gradient-to-r from-cyan-400 via-emerald-400 to-indigo-400 bg-clip-text text-transparent">
          NIFTY & Top NSE Stocks
        </span>
      </h1>

      {/* Subtitle */}
      <p className="mt-5 text-base sm:text-lg text-gray-400 max-w-2xl">
        Set percentage-based UP & DOWN price triggers with sub-second execution. Automatic target calculations,
        real-time WebSocket feeds, and institutional-grade technical analysis.
      </p>

      {/* CTA Buttons */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-white font-bold text-sm shadow-xl shadow-cyan-500/20 transition-all hover:scale-105"
        >
          Open Live Terminal
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/register"
          className="px-6 py-3.5 rounded-xl bg-surface border border-surface-border hover:bg-surface-light text-gray-200 font-bold text-sm transition-all"
        >
          Create Free Account
        </Link>
      </div>

      {/* Features Grid */}
      <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 text-left max-w-5xl w-full">
        <div className="rounded-2xl border border-surface-border bg-surface p-6 shadow-xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400 mb-4">
            <Zap className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Dynamic Target Triggers</h3>
          <p className="mt-2 text-xs text-gray-400 leading-relaxed">
            Enter UP (+3%) or DOWN (-2%) percentage thresholds. The engine dynamically calculates target prices from live LTP or market open.
          </p>
        </div>

        <div className="rounded-2xl border border-surface-border bg-surface p-6 shadow-xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-400 mb-4">
            <Bell className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Exact Once Delivery</h3>
          <p className="mt-2 text-xs text-gray-400 leading-relaxed">
            Concurrency-safe row locking and transactional state transitions eliminate duplicate triggers during high-volatility spikes.
          </p>
        </div>

        <div className="rounded-2xl border border-surface-border bg-surface p-6 shadow-xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-950 border border-indigo-800 text-indigo-400 mb-4">
            <LineChart className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Technical Analysis Engine</h3>
          <p className="mt-2 text-xs text-gray-400 leading-relaxed">
            Overlay SMA, EMA, RSI (Wilder's 14), MACD, Bollinger Bands, VWAP, and ATR on responsive candlestick charts.
          </p>
        </div>
      </div>
    </div>
  );
}
