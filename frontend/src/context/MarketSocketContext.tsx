"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { MarketStatus, MarketTick } from "../types/stock";
import { marketSocket } from "../services/websocket";
import { useAuth } from "./AuthContext";
import { api } from "../services/api";

interface TriggerNotification {
  id: string;
  alert_id: string;
  symbol: string;
  direction: "UP" | "DOWN";
  target_price: number;
  trigger_price: number;
  triggered_at: string;
}

interface MarketSocketContextType {
  ticks: Record<string, MarketTick>;
  marketStatus: MarketStatus | null;
  triggeredNotifications: TriggerNotification[];
  dismissNotification: (id: string) => void;
  subscribeSymbols: (symbols: string[]) => void;
  unsubscribeSymbols: (symbols: string[]) => void;
}

const MarketSocketContext = createContext<MarketSocketContextType | undefined>(undefined);

export function MarketSocketProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [ticks, setTicks] = useState<Record<string, MarketTick>>({});
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);
  const [triggeredNotifications, setTriggeredNotifications] = useState<TriggerNotification[]>([]);

  // 1. Initial snapshot fetch
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
  }, []);

  // 2. WebSocket listener setup
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
        id: Math.random().toString(36).substring(2, 9),
        alert_id: alertData.alert_id,
        symbol: alertData.symbol,
        direction: alertData.direction,
        target_price: alertData.target_price,
        trigger_price: alertData.trigger_price,
        triggered_at: alertData.triggered_at,
      };
      setTriggeredNotifications((prev) => [notif, ...prev]);
    });

    return () => {
      unsubscribeTick();
      unsubscribeAlert();
    };
  }, [token]);

  const dismissNotification = (id: string) => {
    setTriggeredNotifications((prev) => prev.filter((n) => n.id !== id));
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
        dismissNotification,
        subscribeSymbols,
        unsubscribeSymbols,
      }}
    >
      {children}

      {/* Global Real-Time Trigger Notification Toast Overlay */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-none">
        {triggeredNotifications.slice(0, 4).map((n) => {
          const isUp = n.direction === "UP";
          return (
            <div
              key={n.id}
              className={`pointer-events-auto flex items-start justify-between p-4 rounded-xl border backdrop-blur-lg shadow-2xl transition-all duration-300 animate-bounce ${
                isUp
                  ? "bg-emerald-950/90 border-bullish text-emerald-100 shadow-emerald-900/40"
                  : "bg-red-950/90 border-bearish text-red-100 shadow-red-900/40"
              }`}
            >
              <div>
                <div className="flex items-center gap-2 font-bold text-sm">
                  <span>{isUp ? "🚀 TARGET HIT (UP)" : "🔻 TARGET HIT (DOWN)"}</span>
                  <span className="px-2 py-0.5 rounded bg-black/40 text-xs text-white">
                    {n.symbol}
                  </span>
                </div>
                <div className="mt-1 text-xs opacity-90">
                  Target: <span className="font-semibold">₹{n.target_price.toLocaleString("en-IN")}</span> |
                  Live Hit: <span className="font-bold underline">₹{n.trigger_price.toLocaleString("en-IN")}</span>
                </div>
              </div>
              <button
                onClick={() => dismissNotification(n.id)}
                className="ml-3 text-xs opacity-70 hover:opacity-100 p-1 hover:bg-black/20 rounded"
              >
                ✕
              </button>
            </div>
          );
        })}
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
