"use client";

import React from "react";
import { ArrowDownRight, ArrowUpRight, CheckCircle, Clock, Trash2, XCircle } from "lucide-react";
import { Alert } from "../../types/alert";
import { MarketTick } from "../../types/stock";

interface ActiveAlertsTableProps {
  alerts: Alert[];
  ticks: Record<string, MarketTick>;
  onDeleteAlert: (alertId: string) => void;
}

export function ActiveAlertsTable({
  alerts,
  ticks,
  onDeleteAlert,
}: ActiveAlertsTableProps) {
  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-surface-border bg-surface">
        <Clock className="h-10 w-10 text-gray-500 mb-3" />
        <h3 className="text-base font-bold text-gray-200">No Active Alerts Found</h3>
        <p className="text-xs text-gray-400 max-w-sm mt-1">
          Select any stock or index on your dashboard to set percentage-based UP or DOWN price triggers.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-surface-border bg-surface shadow-xl">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-surface-border bg-surface-light/60 text-gray-400 font-semibold uppercase tracking-wider">
          <tr>
            <th className="py-3.5 px-4">Instrument</th>
            <th className="py-3.5 px-4">Direction</th>
            <th className="py-3.5 px-4">Reference Price</th>
            <th className="py-3.5 px-4">Target Price</th>
            <th className="py-3.5 px-4">Current Live LTP</th>
            <th className="py-3.5 px-4">Distance to Target</th>
            <th className="py-3.5 px-4">Status</th>
            <th className="py-3.5 px-4 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border/50 font-mono">
          {alerts.map((alert) => {
            const sym = alert.instrument?.symbol || "---";
            const tick = ticks[sym.toUpperCase()];
            const livePrice = tick?.price ?? alert.reference_price;
            const isUp = alert.direction === "UP";

            // Distance to target in %
            const distance = ((alert.target_price - livePrice) / livePrice) * 100;
            const isTriggered = alert.status === "TRIGGERED";

            return (
              <tr key={alert.id} className="hover:bg-surface-light/40 transition-colors">
                <td className="py-3 px-4 font-bold text-white font-sans flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                  <div>
                    <div>{sym}</div>
                    <div className="text-[10px] text-gray-400 font-normal">{alert.instrument?.name}</div>
                  </div>
                </td>

                <td className="py-3 px-4">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                      isUp
                        ? "bg-emerald-950 text-bullish-text border border-emerald-800"
                        : "bg-red-950 text-bearish-text border border-red-800"
                    }`}
                  >
                    {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {alert.direction} ({alert.threshold_percent}%)
                  </span>
                </td>

                <td className="py-3 px-4 text-gray-300">
                  ₹{alert.reference_price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>

                <td className="py-3 px-4 font-bold text-white">
                  ₹{alert.target_price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>

                <td className="py-3 px-4 text-cyan-300 font-bold">
                  ₹{livePrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>

                <td className="py-3 px-4">
                  <span className={`text-xs ${Math.abs(distance) < 0.5 ? "text-amber-400 font-bold animate-pulse" : "text-gray-400"}`}>
                    {distance > 0 ? "+" : ""}
                    {distance.toFixed(2)}% away
                  </span>
                </td>

                <td className="py-3 px-4">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-sans ${
                      isTriggered
                        ? "bg-amber-950 text-amber-300 border border-amber-800"
                        : alert.status === "ACTIVE"
                        ? "bg-cyan-950 text-cyan-300 border border-cyan-800"
                        : "bg-gray-800 text-gray-400"
                    }`}
                  >
                    {isTriggered ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                    {alert.status}
                  </span>
                </td>

                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => onDeleteAlert(alert.id)}
                    title="Delete Alert"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
