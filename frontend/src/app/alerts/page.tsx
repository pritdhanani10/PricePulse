"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  History,
  Plus,
  RefreshCw,
  ShieldAlert,
  Zap,
  Laptop,
  Smartphone,
  Send,
  Volume2,
  AlertCircle,
} from "lucide-react";
import { Alert } from "../../types/alert";
import { Instrument } from "../../types/stock";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useMarketSocket } from "../../context/MarketSocketContext";
import { ActiveAlertsTable } from "../../components/alerts/ActiveAlertsTable";
import { CreateAlertModal } from "../../components/alerts/CreateAlertModal";

export default function AlertsPage() {
  const { user } = useAuth();
  const {
    ticks,
    hasNotificationPermission,
    requestDesktopNotificationPermission,
  } = useMarketSocket();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedInst, setSelectedInst] = useState<Instrument | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const fetchAlerts = () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .getAlerts(statusFilter === "ALL" ? undefined : statusFilter)
      .then((data) => setAlerts(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAlerts();
    api.getInstruments().then((insts) => {
      setInstruments(insts);
      if (insts.length > 0) setSelectedInst(insts[0]);
    });
  }, [user, statusFilter]);

  const handleDelete = async (id: string) => {
    try {
      await api.deleteAlert(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete alert");
    }
  };

  const activeCount = alerts.filter((a) => a.status === "ACTIVE").length;
  const triggeredCount = alerts.filter((a) => a.status === "TRIGGERED").length;

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Bell className="h-6 w-6 text-cyan-400" />
            Market Alerts & Trigger Rules
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Monitor percentage breakouts and receive instantaneous sub-second execution.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/alerts/history"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface border border-surface-border text-gray-300 hover:text-white text-xs font-semibold hover:bg-surface-light transition-colors"
          >
            <History className="h-4 w-4 text-cyan-400" />
            Trigger History
          </Link>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 transition-all hover:scale-105"
          >
            <Plus className="h-4 w-4" />
            Create Alert
          </button>
        </div>
      </div>

      {/* Cross-Device Notification Readiness & Test Banner */}
      <div className="rounded-2xl border border-surface-border bg-gradient-to-r from-surface via-[#0e1420] to-surface p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Universal Device Notification Delivery</span>
              <span
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  hasNotificationPermission
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                    : "bg-amber-950 text-amber-300 border border-amber-800"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    hasNotificationPermission ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                />
                {hasNotificationPermission ? "Connected & Ready" : "Permission Needed"}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1">
                <Laptop className="h-3 w-3 text-cyan-400" /> Windows Action Center
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Smartphone className="h-3 w-3 text-cyan-400" /> Android / iOS Phone
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Volume2 className="h-3 w-3 text-emerald-400" /> Audio Synthesizer
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {!hasNotificationPermission && (
            <button
              onClick={() => requestDesktopNotificationPermission()}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shrink-0"
            >
              Enable Notifications
            </button>
          )}
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-surface-border bg-surface p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-950 text-cyan-400">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-white font-mono">{activeCount}</div>
            <div className="text-[11px] text-gray-400">Active Live Monitors</div>
          </div>
        </div>

        <div className="rounded-2xl border border-surface-border bg-surface p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-950 text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-white font-mono">{triggeredCount}</div>
            <div className="text-[11px] text-gray-400">Targets Reached</div>
          </div>
        </div>

        <div className="rounded-2xl border border-surface-border bg-surface p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-950 text-indigo-400">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-white font-mono">100%</div>
            <div className="text-[11px] text-gray-400">Concurrency Safety</div>
          </div>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-surface border border-surface-border">
          {(["ALL", "ACTIVE", "TRIGGERED"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-4 py-1 rounded-lg text-xs font-bold transition-all ${
                statusFilter === tab
                  ? "bg-cyan-600/20 text-cyan-300 border border-cyan-500/30"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {tab === "ALL" ? "All Alerts" : tab === "ACTIVE" ? "Active Only" : "Triggered"}
            </button>
          ))}
        </div>

        <button
          onClick={fetchAlerts}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-cyan-400 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Alerts Table */}
      {!user ? (
        <div className="p-8 text-center rounded-2xl border border-surface-border bg-surface">
          <p className="text-sm text-gray-300">Please sign in to view and configure your price alerts.</p>
          <Link
            href="/login"
            className="mt-4 inline-block px-4 py-2 rounded-xl bg-cyan-600 text-white text-xs font-bold"
          >
            Sign In Now
          </Link>
        </div>
      ) : (
        <ActiveAlertsTable
          alerts={alerts}
          ticks={ticks}
          onDeleteAlert={handleDelete}
        />
      )}

      {/* Create Alert Modal */}
      {selectedInst && (
        <CreateAlertModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          instrument={selectedInst}
          tick={ticks[selectedInst.symbol.toUpperCase()]}
          onAlertCreated={fetchAlerts}
        />
      )}
    </div>
  );
}
