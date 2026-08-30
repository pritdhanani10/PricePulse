"use client";

import React from "react";
import { ArrowDownRight, ArrowUpRight, CheckCheck, History } from "lucide-react";
import { AlertHistoryEntry } from "../../types/alert";

interface AlertHistoryLogProps {
  history: AlertHistoryEntry[];
}

export function AlertHistoryLog({ history }: AlertHistoryLogProps) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-surface-border bg-surface">
        <History className="h-10 w-10 text-gray-500 mb-3" />
        <h3 className="text-base font-bold text-gray-200">No Trigger History Yet</h3>
        <p className="text-xs text-gray-400 max-w-sm mt-1">
          When live market prices cross your defined UP or DOWN targets, triggered records will be archived here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-surface-border bg-surface shadow-xl">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-surface-border bg-surface-light/60 text-gray-400 font-semibold uppercase tracking-wider">
          <tr>
            <th className="py-3.5 px-4">Triggered Time (IST)</th>
            <th className="py-3.5 px-4">Instrument</th>
            <th className="py-3.5 px-4">Direction</th>
            <th className="py-3.5 px-4">Reference Price</th>
            <th className="py-3.5 px-4">Target Price</th>
            <th className="py-3.5 px-4">Trigger Execution Price</th>
            <th className="py-3.5 px-4">Notification Channel</th>
            <th className="py-3.5 px-4 text-right">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border/50 font-mono">
          {history.map((entry) => {
            const sym = entry.instrument?.symbol || "---";
            const isUp = entry.direction === "UP";
            const dateStr = new Date(entry.triggered_at).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
              dateStyle: "medium",
              timeStyle: "medium",
            });

            return (
              <tr key={entry.id} className="hover:bg-surface-light/40 transition-colors">
                <td className="py-3 px-4 text-gray-300 font-sans">{dateStr}</td>

                <td className="py-3 px-4 font-bold text-white font-sans flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <div>
                    <div>{sym}</div>
                    <div className="text-[10px] text-gray-400 font-normal">{entry.instrument?.name}</div>
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
                    {entry.direction}
                  </span>
                </td>

                <td className="py-3 px-4 text-gray-300">
                  ₹{entry.reference_price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>

                <td className="py-3 px-4 text-gray-300">
                  ₹{entry.target_price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>

                <td className="py-3 px-4 font-bold text-white">
                  ₹{entry.trigger_price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>

                <td className="py-3 px-4 text-cyan-300 font-sans font-medium">
                  {entry.notification_channel}
                </td>

                <td className="py-3 px-4 text-right">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                    <CheckCheck className="h-3 w-3" />
                    TRIGGERED
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
