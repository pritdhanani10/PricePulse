"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { 
  ArrowDownRight, 
  ArrowUpRight, 
  Bell, 
  Bookmark, 
  CheckCircle, 
  ExternalLink, 
  LineChart, 
  Volume2, 
  X, 
  Zap 
} from "lucide-react";
import { MarketStatus, MarketTick } from "../types/stock";
import { UserNotification } from "../types/auth";
import { marketSocket } from "../services/websocket";
import { useAuth } from "./AuthContext";
import { api } from "../services/api";
import { soundService } from "../services/sound";
import { deviceNotificationService } from "../services/notification";

export interface TriggerNotification {
  id: string;
  alert_id: string;
  symbol: string;
  direction: "UP" | "DOWN";
  threshold_percent?: number;
  reference_price?: number;
  target_price: number;
  trigger_price: number;
  triggered_at: string;
}

export interface WatchlistSignalToast {
  id: string;
  symbol: string;
  signal_type: "BUY" | "SELL";
  title: string;
  message: string;
  trigger_price?: number;
  market_price?: number;
  reference_price?: number;
  created_at: string;
}

export interface CreatedAlertNotification {
  id: string;
  symbol: string;
  name?: string;
  reference_price: number;
  up_target?: number;
  up_percent?: number;
  down_target?: number;
  down_percent?: number;
  created_at: string;
}

interface MarketSocketContextType {
  ticks: Record<string, MarketTick>;
  marketStatus: MarketStatus | null;
  triggeredNotifications: TriggerNotification[];
  watchlistToasts: WatchlistSignalToast[];
  createdNotifications: CreatedAlertNotification[];
  unreadNotificationCount: number;
  userNotifications: UserNotification[];
  hasNotificationPermission: boolean;
  isPushSubscribed: boolean;
  permissionState: NotificationPermission;
  fetchUserNotifications: () => void;
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  dismissTriggerNotification: (id: string) => void;
  dismissWatchlistToast: (id: string) => void;
  dismissCreatedNotification: (id: string) => void;
  notifyAlertCreated: (alertData: Omit<CreatedAlertNotification, "id" | "created_at">) => void;
  subscribeSymbols: (symbols: string[]) => void;
  unsubscribeSymbols: (symbols: string[]) => void;
  requestDesktopNotificationPermission: () => Promise<boolean>;
}

const MarketSocketContext = createContext<MarketSocketContextType | undefined>(undefined);

export function MarketSocketProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const [ticks, setTicks] = useState<Record<string, MarketTick>>({});
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);
  const [triggeredNotifications, setTriggeredNotifications] = useState<TriggerNotification[]>([]);
  const [watchlistToasts, setWatchlistToasts] = useState<WatchlistSignalToast[]>([]);
  const [createdNotifications, setCreatedNotifications] = useState<CreatedAlertNotification[]>([]);
  const [userNotifications, setUserNotifications] = useState<UserNotification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState<number>(0);
  const [hasNotificationPermission, setHasNotificationPermission] = useState<boolean>(false);
  const [isPushSubscribed, setIsPushSubscribed] = useState<boolean>(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission>("default");

  // Request browser desktop/mobile notification permissions & register Web Push
  const requestDesktopNotificationPermission = async (): Promise<boolean> => {
    const granted = await deviceNotificationService.requestPermission();
    setHasNotificationPermission(granted);
    setPermissionState(deviceNotificationService.getPermission());
    if (granted && user) {
      const subSuccess = await deviceNotificationService.syncPushSubscription();
      setIsPushSubscribed(subSuccess);
    }
    return granted;
  };

  const fetchUserNotifications = () => {
    if (!user) return;
    api
      .getWatchlistNotifications(false, 30)
      .then((res) => {
        setUserNotifications(res.notifications);
        setUnreadNotificationCount(res.unread_count);
      })
      .catch(() => {});
  };

  const markNotificationAsRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setUserNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadNotificationCount((prev) => Math.max(0, prev - 1));
    } catch (_) {}
  };

  const markAllNotificationsAsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setUserNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadNotificationCount(0);
    } catch (_) {}
  };

  // 1. Initial snapshot fetch and Service Worker registration
  useEffect(() => {
    api
      .getMarketStatus()
      .then((status) => setMarketStatus(status))
      .catch(() => {});

    api
      .getAllQuotes()
      .then((quotes) => {
        const dict: Record<string, MarketTick> = {};
        quotes.forEach((q) => {
          dict[q.symbol.toUpperCase()] = q;
        });
        setTicks(dict);
      })
      .catch(() => {});

    // Initialize Service Worker for cross-device support
    deviceNotificationService.initServiceWorker().catch(() => {});
    const perm = deviceNotificationService.getPermission();
    setPermissionState(perm);
    setHasNotificationPermission(perm === "granted");
  }, []);

  // 2. Sync Web Push subscription when user logs in
  useEffect(() => {
    if (user) {
      fetchUserNotifications();
      if (deviceNotificationService.getPermission() === "granted") {
        deviceNotificationService
          .syncPushSubscription()
          .then((success) => setIsPushSubscribed(success))
          .catch(() => {});
      }
    }
  }, [user]);

  // 3. WebSocket listener setup
  useEffect(() => {
    marketSocket.connect(token);

    const unsubscribeTick = marketSocket.onTick((tick) => {
      setTicks((prev) => ({
        ...prev,
        [tick.symbol.toUpperCase()]: tick,
      }));
    });

    const unsubscribeAlert = marketSocket.onAlert((alertData) => {
      const notif: TriggerNotification = {
        id: alertData.id || Math.random().toString(36).substring(2, 9),
        alert_id: alertData.alert_id,
        symbol: alertData.symbol,
        direction: alertData.direction,
        threshold_percent: alertData.threshold_percent,
        reference_price: alertData.reference_price,
        target_price: alertData.target_price,
        trigger_price: alertData.trigger_price,
        triggered_at: alertData.triggered_at || new Date().toISOString(),
      };

      setTriggeredNotifications((prev) => [notif, ...prev]);

      setTimeout(() => {
        setTriggeredNotifications((prev) => prev.filter((n) => n.id !== notif.id));
      }, 15000);

      // Trigger cross-device system notification (Windows Action Center, Android, iOS, macOS)
      const dirEmoji = alertData.direction === "UP" ? "🚀" : "🔻";
      const title = `${dirEmoji} HIGH PRIORITY ALERT: ${alertData.symbol} Target Hit!`;
      const body = `Target: ₹${alertData.target_price?.toLocaleString("en-IN")} | Live Price: ₹${alertData.trigger_price?.toLocaleString("en-IN")}`;

      deviceNotificationService.displayNotification(title, {
        body,
        url: "/alerts/history",
        data: alertData,
      });

      // Refresh unread notifications
      if (user) {
        fetchUserNotifications();
      }
    });

    const unsubscribeWatchlistNotif = marketSocket.onWatchlistNotification((notifData) => {
      const toast: WatchlistSignalToast = {
        id: notifData.id || Math.random().toString(36).substring(2, 9),
        symbol: notifData.symbol,
        signal_type: notifData.signal_type || "BUY",
        title: notifData.title,
        message: notifData.message,
        trigger_price: notifData.trigger_price,
        market_price: notifData.market_price,
        reference_price: notifData.reference_price,
        created_at: notifData.created_at || new Date().toISOString(),
      };

      setWatchlistToasts((prev) => [toast, ...prev]);
      setUnreadNotificationCount((prev) => prev + 1);

      // Refresh full ledger
      fetchUserNotifications();

      // Auto-dismiss in-app toast after 15 seconds
      setTimeout(() => {
        setWatchlistToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 15000);

      // Trigger native device notification (Windows Action Center, Android, iOS)
      const emoji = toast.signal_type === "BUY" ? "🟢" : "🔴";
      const title = `${emoji} Watchlist ${toast.signal_type} Signal: ${toast.symbol}`;
      const body = `Target: ₹${toast.trigger_price?.toLocaleString("en-IN") || ""} | Executed: ₹${toast.market_price?.toLocaleString("en-IN") || ""}`;

      deviceNotificationService.displayNotification(title, {
        body,
        url: "/watchlist",
        data: notifData,
      });
    });

    return () => {
      unsubscribeTick();
      unsubscribeAlert();
      unsubscribeWatchlistNotif();
    };
  }, [token, user]);

  const notifyAlertCreated = (data: Omit<CreatedAlertNotification, "id" | "created_at">) => {
    const createdNotif: CreatedAlertNotification = {
      ...data,
      id: Math.random().toString(36).substring(2, 9),
      created_at: new Date().toLocaleTimeString(),
    };
    setCreatedNotifications((prev) => [createdNotif, ...prev]);
    soundService.playAlertCreatedSound();

    setTimeout(() => {
      dismissCreatedNotification(createdNotif.id);
    }, 7000);
  };

  const dismissTriggerNotification = (id: string) => {
    setTriggeredNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const dismissWatchlistToast = (id: string) => {
    setWatchlistToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const dismissCreatedNotification = (id: string) => {
    setCreatedNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const subscribeSymbols = (symbols: string[]) => {
    marketSocket.subscribe(symbols);
  };

  const unsubscribeSymbols = (symbols: string[]) => {
    marketSocket.unsubscribe(symbols);
  };

  return (
    <MarketSocketContext.Provider
      value={{
        ticks,
        marketStatus,
        triggeredNotifications,
        watchlistToasts,
        createdNotifications,
        unreadNotificationCount,
        userNotifications,
        hasNotificationPermission,
        isPushSubscribed,
        permissionState,
        fetchUserNotifications,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        dismissTriggerNotification,
        dismissWatchlistToast,
        dismissCreatedNotification,
        notifyAlertCreated,
        subscribeSymbols,
        unsubscribeSymbols,
        requestDesktopNotificationPermission,
      }}
    >
      {children}

      {/* ========================================================================= */}
      {/* HIGH PRIORITY TOAST OVERLAY (Bottom Right Global Notifications)           */}
      {/* ========================================================================= */}
      <div className="fixed bottom-20 sm:bottom-5 right-0 sm:right-5 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-3">
        {/* 1. WATCHLIST AUTO-MONITOR SIGNAL TOASTS */}
        {watchlistToasts.slice(0, 3).map((w) => {
          const isBuy = w.signal_type === "BUY";
          const timeStr = new Date(w.created_at).toLocaleTimeString();

          return (
            <div
              key={w.id}
              className={`pointer-events-auto relative overflow-hidden rounded-2xl border p-4 shadow-2xl backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 ${
                isBuy
                  ? "border-emerald-500/80 bg-gradient-to-br from-emerald-950/95 via-gray-900/95 to-surface text-emerald-100 shadow-emerald-900/50"
                  : "border-rose-500/80 bg-gradient-to-br from-rose-950/95 via-gray-900/95 to-surface text-rose-100 shadow-rose-900/50"
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        isBuy ? "bg-emerald-400" : "bg-rose-400"
                      }`}
                    />
                    <span
                      className={`relative inline-flex rounded-full h-3 w-3 ${
                        isBuy ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                    />
                  </span>
                  <span className="text-[11px] font-black tracking-wider uppercase text-white flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-cyan-400" />
                    WATCHLIST AUTO-MONITOR SIGNAL
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-300 font-mono">{timeStr}</span>
                  <button
                    onClick={() => dismissWatchlistToast(w.id)}
                    title="Dismiss"
                    className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black text-white font-mono">{w.symbol}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-black font-mono border ${
                        isBuy
                          ? "bg-emerald-900 text-emerald-300 border-emerald-700"
                          : "bg-rose-900 text-rose-300 border-rose-700"
                      }`}
                    >
                      {w.signal_type} SIGNAL (5m 3%)
                    </span>
                  </div>
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-2 rounded-xl bg-black/40 p-2.5 text-xs font-mono border border-white/5">
                  {w.trigger_price && (
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase">Trigger Target</span>
                      <span className="text-sm font-bold text-gray-200">
                        ₹{w.trigger_price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  {w.market_price && (
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase">Executed Live Price</span>
                      <span className="text-sm font-extrabold text-white underline decoration-cyan-400">
                        ₹{w.market_price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-3 flex items-center gap-2 pt-2 border-t border-white/10">
                <Link
                  href={`/analysis?symbol=${w.symbol}`}
                  onClick={() => dismissWatchlistToast(w.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 text-xs font-bold transition-all"
                >
                  <LineChart className="h-3.5 w-3.5" />
                  View 5m Chart
                </Link>
                <Link
                  href="/watchlist"
                  onClick={() => dismissWatchlistToast(w.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-surface-light/60 hover:bg-surface-light text-gray-200 border border-surface-border text-xs font-semibold transition-all"
                >
                  <Bookmark className="h-3.5 w-3.5 text-cyan-400" />
                  Watchlist
                </Link>
              </div>
            </div>
          );
        })}

        {/* 2. TRIGGERED PRICE ALERTS NOTIFICATIONS */}
        {triggeredNotifications.slice(0, 2).map((n) => {
          const isUp = n.direction === "UP";
          const refPrice = n.reference_price || n.target_price;
          const diff = n.trigger_price - refPrice;
          const pct = refPrice > 0 ? (diff / refPrice) * 100 : 0;
          const timeStr = new Date(n.triggered_at).toLocaleTimeString();

          return (
            <div
              key={n.id}
              className={`pointer-events-auto relative overflow-hidden rounded-2xl border p-4 shadow-2xl backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 ${
                isUp
                  ? "border-emerald-500/80 bg-gradient-to-br from-emerald-950/95 via-gray-900/95 to-surface text-emerald-100 shadow-emerald-900/50"
                  : "border-red-500/80 bg-gradient-to-br from-red-950/95 via-gray-900/95 to-surface text-red-100 shadow-red-900/50"
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        isUp ? "bg-emerald-400" : "bg-red-400"
                      }`}
                    />
                    <span
                      className={`relative inline-flex rounded-full h-3 w-3 ${
                        isUp ? "bg-emerald-500" : "bg-red-500"
                      }`}
                    />
                  </span>
                  <span className="text-[11px] font-black tracking-wider uppercase text-white">
                    🚨 PRICE ALERT TRIGGERED
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-300 font-mono">{timeStr}</span>
                  <button
                    onClick={() => dismissTriggerNotification(n.id)}
                    title="Dismiss"
                    className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-white font-mono">{n.symbol}</span>
                    <span
                      className={`flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-extrabold font-mono ${
                        isUp ? "bg-emerald-900 text-emerald-300 border border-emerald-700" : "bg-red-900 text-red-300 border border-red-700"
                      }`}
                    >
                      {isUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                      {n.direction} {n.threshold_percent ? `(${n.threshold_percent}%)` : ""}
                    </span>
                  </div>
                  <div className={`text-sm font-bold font-mono ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                    {diff >= 0 ? "+" : ""}
                    {pct.toFixed(2)}%
                  </div>
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-2 rounded-xl bg-black/40 p-2.5 text-xs font-mono border border-white/5">
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase">Target Price</span>
                    <span className="text-sm font-bold text-gray-200">
                      ₹{n.target_price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase">Triggered Live Price</span>
                    <span className="text-sm font-extrabold text-white underline decoration-cyan-400">
                      ₹{n.trigger_price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 pt-2 border-t border-white/10">
                <Link
                  href={`/analysis?symbol=${n.symbol}`}
                  onClick={() => dismissTriggerNotification(n.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 text-xs font-bold transition-all"
                >
                  <LineChart className="h-3.5 w-3.5" />
                  View Chart
                </Link>
                <Link
                  href="/alerts/history"
                  onClick={() => dismissTriggerNotification(n.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-surface-light/60 hover:bg-surface-light text-gray-200 border border-surface-border text-xs font-semibold transition-all"
                >
                  <Bell className="h-3.5 w-3.5" />
                  History
                </Link>
              </div>
            </div>
          );
        })}

        {/* 3. CREATED ALERT CONFIRMATION TOAST */}
        {createdNotifications.slice(0, 1).map((c) => (
          <div
            key={c.id}
            className="pointer-events-auto relative overflow-hidden rounded-2xl border border-cyan-500/60 bg-gradient-to-br from-cyan-950/95 via-gray-900/95 to-surface p-4 text-cyan-100 shadow-2xl shadow-cyan-950/60 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-cyan-800/30">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase text-cyan-300">
                <CheckCircle className="h-4 w-4 text-cyan-400" />
                <span>Price Alert Armed & Active</span>
              </div>
              <button
                onClick={() => dismissCreatedNotification(c.id)}
                className="p-1 text-gray-400 hover:text-white rounded hover:bg-white/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-2.5">
              <div className="flex items-center justify-between">
                <span className="text-base font-black text-white font-mono">{c.symbol}</span>
                <span className="text-[11px] text-gray-300 font-mono">
                  Ref: ₹{c.reference_price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </MarketSocketContext.Provider>
  );
}

export function useMarketSocket() {
  const context = useContext(MarketSocketContext);
  if (!context) {
    throw new Error("useMarketSocket must be used within a MarketSocketProvider");
  }
  return context;
}
