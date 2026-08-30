"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bell, Bookmark, Layers, LineChart, LogIn, LogOut, TrendingUp, User as UserIcon } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useMarketSocket } from "../../context/MarketSocketContext";

export function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { marketStatus, triggeredNotifications } = useMarketSocket();

  const navLinks = [
    { name: "Dashboard", href: "/dashboard", icon: TrendingUp },
    { name: "Index Explorer", href: "/indexes", icon: Layers },
    { name: "Alerts & Triggers", href: "/alerts", icon: Bell },
    { name: "Watchlist", href: "/watchlist", icon: Bookmark },
    { name: "Technical Analysis", href: "/analysis", icon: LineChart },
  ];


  return (
    <header className="sticky top-0 z-40 border-b border-surface-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 via-emerald-500 to-indigo-600 shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
                PULSE<span className="text-cyan-400">TRADER</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">
                  NSE
                </span>
              </div>
              <p className="text-[10px] text-gray-400 font-medium">Real-Time Market Alert Engine</p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-surface-light text-cyan-400 border border-surface-border shadow-inner"
                      : "text-gray-400 hover:text-white hover:bg-surface"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {link.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Section: Market Status, Notification Bell & User Profile */}
        <div className="flex items-center gap-3">
          {/* Market Status Pill */}
          {marketStatus && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-surface-border text-xs">
              <span
                className={`h-2 w-2 rounded-full ${
                  marketStatus.is_open
                    ? "bg-bullish animate-pulse"
                    : marketStatus.session === "PRE_OPEN"
                    ? "bg-amber-400 animate-ping"
                    : "bg-gray-500"
                }`}
              />
              <span className="font-medium text-gray-300">
                {marketStatus.status_text}
              </span>
            </div>
          )}

          {/* Quick Notification Bell */}
          <Link
            href="/alerts/history"
            className="relative flex items-center justify-center h-8 w-8 rounded-lg bg-surface border border-surface-border text-gray-300 hover:text-white hover:bg-surface-light transition-colors"
            title="Alert Notifications & Trigger History"
          >
            <Bell className="h-4 w-4" />
            {triggeredNotifications.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-extrabold text-white animate-pulse">
                {triggeredNotifications.length}
              </span>
            )}
          </Link>

          {/* User Auth Info */}
          {user ? (
            <div className="flex items-center gap-2 pl-2 border-l border-surface-border">
              <div className="hidden lg:block text-right">
                <div className="text-xs font-bold text-gray-200">{user.name}</div>
                <div className="text-[10px] text-gray-400 font-mono">{user.email}</div>
              </div>
              <button
                onClick={logout}
                title="Logout"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface hover:bg-red-950/40 text-gray-400 hover:text-red-400 border border-surface-border text-xs font-medium transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-light border border-surface-border text-gray-300 text-xs font-semibold transition-colors"
              >
                <LogIn className="h-3.5 w-3.5" />
                Login
              </Link>
              <Link
                href="/register"
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/30 transition-all"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
