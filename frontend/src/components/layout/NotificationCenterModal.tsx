"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  ExternalLink,
  Laptop,
  Smartphone,
  Volume2,
  X,
  Zap,
  AlertTriangle,
  Send,
  Radio,
  Check,
} from "lucide-react";
import { useMarketSocket } from "../../context/MarketSocketContext";
import { useAuth } from "../../context/AuthContext";
import { soundService } from "../../services/sound";

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationCenterModal({ isOpen, onClose }: NotificationCenterModalProps) {
  const { user } = useAuth();
  const {
    hasNotificationPermission,
    permissionState,
    isPushSubscribed,
    userNotifications,
    unreadNotificationCount,
    requestDesktopNotificationPermission,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  } = useMarketSocket();

  if (!isOpen) return null;

  const handleEnablePermission = async () => {
    await requestDesktopNotificationPermission();
  };

  const handleTestSound = () => {
    soundService.playAlertTriggerSound();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-surface-border bg-gradient-to-b from-surface via-[#0d121c] to-surface p-4 sm:p-6 shadow-2xl text-white custom-scrollbar">
        {/* Glow accent */}
        <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-surface-border">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-950 text-cyan-400 border border-cyan-800">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                Cross-Device Notification Center
                {unreadNotificationCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-mono font-bold border border-cyan-500/30">
                    {unreadNotificationCount} New
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-400">
                Receive sub-second market breakout alerts on Windows PC, Android, and iOS devices.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-surface-light transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Device Delivery Status Cards */}
        <div className="my-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Windows / Desktop Status */}
          <div className="rounded-2xl border border-surface-border bg-surface/80 p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-300">
                <Laptop className="h-4 w-4 text-cyan-400" />
                Windows / PC
              </div>
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  hasNotificationPermission ? "bg-emerald-400 shadow-sm shadow-emerald-400" : "bg-amber-400"
                }`}
              />
            </div>
            <div className="mt-2 text-[11px] text-gray-400 font-medium">
              {hasNotificationPermission ? "Action Center Active" : "Permission Needed"}
            </div>
          </div>

          {/* Mobile / Phone Status */}
          <div className="rounded-2xl border border-surface-border bg-surface/80 p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-300">
                <Smartphone className="h-4 w-4 text-cyan-400" />
                Mobile / Phone
              </div>
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  hasNotificationPermission ? "bg-emerald-400 shadow-sm shadow-emerald-400" : "bg-amber-400"
                }`}
              />
            </div>
            <div className="mt-2 text-[11px] text-gray-400 font-medium">
              {hasNotificationPermission ? "Service Worker & Push Ready" : "Prompt to Enable"}
            </div>
          </div>

          {/* Audio Chime Status */}
          <div className="rounded-2xl border border-surface-border bg-surface/80 p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-300">
                <Volume2 className="h-4 w-4 text-emerald-400" />
                Audio Chime
              </div>
              <button
                onClick={handleTestSound}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-semibold"
              >
                Test Sound
              </button>
            </div>
            <div className="mt-2 text-[11px] text-gray-400 font-medium">
              Web Audio Synthesizer Active
            </div>
          </div>
        </div>

        {/* Permission Request Banner (if not granted) */}
        {!hasNotificationPermission && (
          <div className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-950/30 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs text-amber-200">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <span className="font-bold block text-white">Browser Notifications Not Enabled</span>
                <span>Click enable below so Windows Action Center and Mobile Phone receive alerts.</span>
              </div>
            </div>
            <button
              onClick={handleEnablePermission}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs shadow-lg shadow-amber-500/20 shrink-0 transition-transform active:scale-95"
            >
              Enable Notifications
            </button>
          </div>
        )}

        {/* Recent Alerts Feed Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-extrabold text-gray-300 uppercase tracking-wider">
            Recent Alert Notifications
          </span>
          {unreadNotificationCount > 0 && (
            <button
              onClick={() => markAllNotificationsAsRead()}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold"
            >
              Mark All Read
            </button>
          )}
        </div>

        {/* Notifications Scroll List */}
        <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {userNotifications.length === 0 ? (
            <div className="py-8 text-center rounded-2xl border border-surface-border bg-surface/40">
              <p className="text-xs text-gray-400">No recent notifications logged.</p>
              <p className="text-[10px] text-gray-500 mt-1">
                Triggered alerts and 5m breakout strategy signals will appear here.
              </p>
            </div>
          ) : (
            userNotifications.slice(0, 10).map((n) => {
              const isBuy = n.signal_type === "BUY" || n.signal_type === "UP";
              const timeStr = new Date(n.created_at).toLocaleString();

              return (
                <div
                  key={n.id}
                  className={`p-3 rounded-xl border transition-all ${
                    n.is_read
                      ? "border-surface-border bg-surface/40 text-gray-400"
                      : "border-cyan-500/40 bg-cyan-950/20 text-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          isBuy ? "bg-emerald-400" : "bg-rose-400"
                        }`}
                      />
                      <span className="text-xs font-bold text-white font-mono">{n.symbol}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface border border-surface-border font-mono">
                        {n.signal_type || n.notification_type}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500 font-mono">{timeStr}</span>
                  </div>

                  <p className="text-xs text-gray-300 mt-1.5 line-clamp-2">{n.title}</p>

                  <div className="mt-2 flex items-center justify-between pt-1 border-t border-white/5 text-[10px]">
                    <div className="font-mono text-gray-400">
                      {n.market_price && (
                        <span>
                          Price: ₹{n.market_price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {!n.is_read && (
                        <button
                          onClick={() => markNotificationAsRead(n.id)}
                          className="text-cyan-400 hover:text-cyan-300 font-medium"
                        >
                          Mark Read
                        </button>
                      )}
                      <Link
                        href={`/analysis?symbol=${n.symbol}`}
                        onClick={onClose}
                        className="text-gray-400 hover:text-white flex items-center gap-1 font-medium"
                      >
                        Chart <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between pt-3 border-t border-surface-border">
          <Link
            href="/alerts/history"
            onClick={onClose}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1"
          >
            View Complete Trigger History →
          </Link>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-surface border border-surface-border hover:bg-surface-light text-xs font-semibold text-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
