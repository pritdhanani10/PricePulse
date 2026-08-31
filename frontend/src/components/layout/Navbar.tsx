"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Activity, 
  Bell, 
  Bookmark, 
  Layers, 
  LineChart, 
  LogIn, 
  LogOut, 
  Menu, 
  TrendingUp, 
  X, 
  User as UserIcon, 
  ShieldCheck, 
  Radio, 
  ChevronRight 
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useMarketSocket } from "../../context/MarketSocketContext";
import { NotificationCenterModal } from "./NotificationCenterModal";

export function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { 
    marketStatus, 
    triggeredNotifications, 
    unreadNotificationCount, 
    hasNotificationPermission,
  } = useMarketSocket();

  const [isNotifCenterOpen, setIsNotifCenterOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const totalNotifs = triggeredNotifications.length + (unreadNotificationCount || 0);

  const navLinks = [
    { name: "Dashboard", href: "/dashboard", icon: TrendingUp },
    { name: "Index Explorer", href: "/indexes", icon: Layers },
    { name: "Alerts & Triggers", href: "/alerts", icon: Bell },
    { name: "Watchlist", href: "/watchlist", icon: Bookmark },
    { name: "Technical Analysis", href: "/analysis", icon: LineChart },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-surface-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3">
          {/* Brand */}
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="/dashboard" className="flex items-center gap-2 group">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 via-emerald-500 to-indigo-600 shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform shrink-0">
                <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <div>
                <div className="font-extrabold text-sm sm:text-base tracking-tight text-white flex items-center gap-1.5">
                  PULSE<span className="text-cyan-400">TRADER</span>
                  <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono font-bold">
                    NSE
                  </span>
                </div>
                <p className="text-[9px] sm:text-[10px] text-gray-400 font-medium hidden xs:block sm:block">
                  Live Indian Market Alerts
                </p>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
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

          {/* Right Section: Market Status, Notification Bell, User & Mobile Menu */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Market Status Pill */}
            {marketStatus && (
              <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-surface border border-surface-border text-[11px] sm:text-xs">
                <span
                  className={`h-2 w-2 rounded-full ${
                    marketStatus.is_open
                      ? "bg-bullish animate-pulse"
                      : marketStatus.session === "PRE_OPEN"
                      ? "bg-amber-400 animate-ping"
                      : "bg-gray-500"
                  }`}
                />
                <span className="font-medium text-gray-300 hidden sm:inline">
                  {marketStatus.status_text}
                </span>
                <span className="font-medium text-gray-300 sm:hidden">
                  {marketStatus.is_open ? "LIVE" : "CLOSED"}
                </span>
              </div>
            )}

            {/* Cross-Device Notification Bell */}
            <button
              onClick={() => setIsNotifCenterOpen(true)}
              className="relative flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-surface border border-surface-border text-gray-300 hover:text-white hover:bg-surface-light transition-colors group cursor-pointer"
              title="Notification Center & Device Settings"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4 group-hover:scale-110 transition-transform" />
              {totalNotifs > 0 ? (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-extrabold text-white animate-pulse">
                  {totalNotifs > 9 ? "9+" : totalNotifs}
                </span>
              ) : hasNotificationPermission ? (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
              ) : null}
            </button>

            {/* Desktop User Auth Info */}
            <div className="hidden md:flex items-center gap-2">
              {user ? (
                <div className="flex items-center gap-2 pl-2 border-l border-surface-border">
                  <div className="text-right">
                    <div className="text-xs font-bold text-gray-200">{user.name}</div>
                    <div className="text-[10px] text-gray-400 font-mono">{user.email}</div>
                  </div>
                  <button
                    onClick={logout}
                    title="Logout"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface hover:bg-red-950/40 text-gray-400 hover:text-red-400 border border-surface-border text-xs font-medium transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Logout</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 pl-2 border-l border-surface-border">
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

            {/* Mobile Hamburger Toggle Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden flex items-center justify-center h-8 w-8 rounded-xl bg-surface border border-surface-border text-gray-300 hover:text-white transition-colors"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Slide-Over Drawer Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-surface-border bg-[#0a0e17]/98 backdrop-blur-2xl animate-in slide-in-from-top-2 duration-200">
            <div className="px-4 py-4 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* User Profile Card on Mobile */}
              {user ? (
                <div className="p-3.5 rounded-2xl bg-surface border border-surface-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400 flex items-center justify-center font-bold text-xs">
                      {user.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{user.name}</div>
                      <div className="text-[10px] text-gray-400 font-mono truncate max-w-[180px]">
                        {user.email}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="p-2 rounded-lg bg-red-950/40 text-red-400 hover:bg-red-950 border border-red-800/40"
                    title="Logout"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-surface border border-surface-border text-gray-200 text-xs font-bold text-center"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold text-center shadow-lg shadow-cyan-600/30"
                  >
                    Register
                  </Link>
                </div>
              )}

              {/* Mobile Navigation List */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-1">
                  Menu Navigation
                </div>
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive =
                    pathname === link.href ||
                    (link.href !== "/dashboard" && pathname.startsWith(link.href));

                  return (
                    <Link
                      key={link.name}
                      href={link.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? "bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 font-bold"
                          : "text-gray-300 hover:bg-surface"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4" />
                        <span>{link.name}</span>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
                    </Link>
                  );
                })}
              </div>

              {/* Quick Actions in Mobile Drawer */}
              <div className="pt-2 border-t border-surface-border space-y-2">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsNotifCenterOpen(true);
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-surface border border-surface-border text-xs text-gray-300 hover:text-white"
                >
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-cyan-400" />
                    <span>Notification Center & Alerts</span>
                  </div>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      hasNotificationPermission ? "bg-emerald-400" : "bg-amber-400"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Cross-Device Notification Center Modal */}
      <NotificationCenterModal
        isOpen={isNotifCenterOpen}
        onClose={() => setIsNotifCenterOpen(false)}
      />
    </>
  );
}
