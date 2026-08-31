"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Bell, 
  Bookmark, 
  Layers, 
  LineChart, 
  TrendingUp 
} from "lucide-react";
import { useMarketSocket } from "../../context/MarketSocketContext";

export function MobileBottomNav() {
  const pathname = usePathname();
  const { triggeredNotifications, unreadNotificationCount } = useMarketSocket();
  const totalNotifs = triggeredNotifications.length + (unreadNotificationCount || 0);

  const tabs = [
    { name: "Dashboard", href: "/dashboard", icon: TrendingUp },
    { name: "Indexes", href: "/indexes", icon: Layers },
    { name: "Alerts", href: "/alerts", icon: Bell, badge: totalNotifs },
    { name: "Watchlist", href: "/watchlist", icon: Bookmark },
    { name: "Analysis", href: "/analysis", icon: LineChart },
  ];

  return (
    <nav aria-label="Mobile Navigation" className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-surface-border bg-background/95 backdrop-blur-2xl px-2 py-1 shadow-2xl safe-area-pb">
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            pathname === tab.href ||
            (tab.href !== "/dashboard" && pathname.startsWith(tab.href));

          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all active:scale-95 ${
                isActive
                  ? "text-cyan-400 font-extrabold"
                  : "text-gray-400 hover:text-gray-200 font-medium"
              }`}
            >
              {/* Active Pill Indicator */}
              {isActive && (
                <span className="absolute -top-1 h-1 w-6 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400" />
              )}

              <div className="relative">
                <Icon className={`h-5 w-5 ${isActive ? "text-cyan-400" : "text-gray-400"}`} />
                {Boolean(tab.badge && tab.badge > 0) && (
                  <span className="absolute -top-1.5 -right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-black text-white animate-pulse">
                    {tab.badge! > 9 ? "9+" : tab.badge}
                  </span>
                )}
              </div>

              <span className="text-[10px] tracking-tight mt-0.5">{tab.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
