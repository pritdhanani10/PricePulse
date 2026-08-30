"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, History, RefreshCw } from "lucide-react";
import { AlertHistoryEntry } from "../../../types/alert";
import { api } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { AlertHistoryLog } from "../../../components/alerts/AlertHistoryLog";

export default function AlertHistoryPage() {
  const { user } = useAuth();
  const [history, setHistory] = useState<AlertHistoryEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchHistory = () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .getAlertHistory()
      .then((data) => setHistory(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHistory();
  }, [user]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/alerts"
            className="p-2 rounded-xl bg-surface border border-surface-border text-gray-400 hover:text-white hover:bg-surface-light transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <History className="h-6 w-6 text-cyan-400" />
              Alert Trigger History Log
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Chronological ledger of executed price target hits and multi-channel notifications.
            </p>
          </div>
        </div>

        <button
          onClick={fetchHistory}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-surface-border text-xs text-gray-300 hover:text-white transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Log
        </button>
      </div>

      {/* History Table */}
      {!user ? (
        <div className="p-8 text-center rounded-2xl border border-surface-border bg-surface">
          <p className="text-sm text-gray-300">Please sign in to view your alert execution history.</p>
        </div>
      ) : (
        <AlertHistoryLog history={history} />
      )}
    </div>
  );
}
