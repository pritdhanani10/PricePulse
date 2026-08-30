"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  ArrowDownRight, 
  ArrowUpRight, 
  Bell, 
  Check, 
  CheckCheck, 
  Filter, 
  LineChart, 
  RefreshCw, 
  ShieldCheck, 
  Zap 
} from "lucide-react";
import { UserNotification } from "../../types/auth";

interface WatchlistNotificationsPanelProps {
  notifications: UserNotification[];
  unreadCount: number;
  loading: boolean;
  onRefresh: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

export function WatchlistNotificationsPanel({
  notifications,
  unreadCount,
  loading,
  onRefresh,
  onMarkRead,
  onMarkAllRead,
}: WatchlistNotificationsPanelProps) {
  const [filter, setFilter] = useState<"ALL" | "UNREAD" | "BUY" | "SELL">("ALL");

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "UNREAD") return !n.is_read;
    if (filter === "BUY") return n.signal_type === "BUY";
    if (filter === "SELL") return n.signal_type === "SELL";
    return true;
  });

  return (
    <div className="rounded-2xl border border-surface-border bg-surface p-5 space-y-4 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800/60">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <span>Watchlist Signal Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-extrabold font-mono animate-pulse">
                  {unreadCount} UNREAD
                </span>
              )}
            </h2>
            <p className="text-[11px] text-gray-400">
              Persistent background alerts generated automatically by the 5-minute Strategy Engine.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark All Read
            </button>
          )}

          <button
            onClick={onRefresh}
            title="Refresh Notifications"
            className="p-2 rounded-xl bg-surface-light border border-surface-border text-gray-400 hover:text-cyan-400 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-light border border-surface-border w-fit text-xs font-mono">
        {(["ALL", "UNREAD", "BUY", "SELL"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1 rounded-lg font-bold transition-all ${
              filter === tab
                ? "bg-cyan-600/20 text-cyan-300 border border-cyan-500/40"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {tab === "ALL"
              ? "All Signals"
              : tab === "UNREAD"
              ? `Unread (${unreadCount})`
              : tab === "BUY"
              ? "🟢 BUY Signals"
              : "🔴 SELL Signals"}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-background/50 border border-surface-border">
          <ShieldCheck className="h-8 w-8 text-gray-500 mx-auto mb-2" />
          <p className="text-xs font-bold text-gray-300">No strategy notifications in this view.</p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            When your auto-monitored watchlist stocks hit 5-minute BUY/SELL triggers, alerts appear here 24/7.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
          {filteredNotifications.map((n) => {
            const isBuy = n.signal_type === "BUY";
            const timeStr = new Date(n.created_at).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            });

            return (
              <div
                key={n.id}
                className={`relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                  n.is_read
                    ? "bg-background/40 border-surface-border text-gray-300 opacity-85"
                    : isBuy
                    ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-100 shadow-md shadow-emerald-950/20"
                    : "bg-rose-950/20 border-rose-500/40 text-rose-100 shadow-md shadow-rose-950/20"
                }`}
              >
                {/* Left Info */}
                <div className="flex items-start gap-3">
                  {!n.is_read && (
                    <span className="mt-1 flex h-2 w-2 relative flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
                    </span>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-white font-mono">{n.symbol}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold font-mono border ${
                          isBuy
                            ? "bg-emerald-900/80 text-emerald-300 border-emerald-700"
                            : "bg-rose-900/80 text-rose-300 border-rose-700"
                        }`}
                      >
                        {n.signal_type} SIGNAL (5m 3%)
                      </span>
                    </div>

                    <p className="text-xs text-gray-300 mt-1">{n.message}</p>
                    <span className="text-[10px] text-gray-500 font-mono mt-1 block">{timeStr}</span>
                  </div>
                </div>

                {/* Right Actions & Prices */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-surface-border">
                  <Link
                    href={`/analysis?symbol=${n.symbol}`}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-light hover:bg-surface-border text-cyan-300 text-xs font-bold border border-surface-border transition-colors"
                  >
                    <LineChart className="h-3.5 w-3.5" />
                    5m Chart
                  </Link>

                  {!n.is_read && (
                    <button
                      onClick={() => onMarkRead(n.id)}
                      title="Mark as read"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-400 hover:bg-emerald-950/40 transition-colors"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
