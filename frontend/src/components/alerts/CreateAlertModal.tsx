"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, ArrowDown, ArrowUp, CheckCircle2, DollarSign, X } from "lucide-react";
import { Instrument, MarketTick } from "../../types/stock";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useMarketSocket } from "../../context/MarketSocketContext";

interface CreateAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  instrument: Instrument | null;
  tick?: MarketTick;
  onAlertCreated?: () => void;
}

export function CreateAlertModal({
  isOpen,
  onClose,
  instrument,
  tick,
  onAlertCreated,
}: CreateAlertModalProps) {
  const { user } = useAuth();
  const { notifyAlertCreated, requestDesktopNotificationPermission } = useMarketSocket();
  const [referenceType, setReferenceType] = useState<"CURRENT_PRICE" | "MARKET_OPEN" | "CUSTOM">("CURRENT_PRICE");
  const [customPrice, setCustomPrice] = useState<string>("");
  const [upPercent, setUpPercent] = useState<string>("3.0");
  const [downPercent, setDownPercent] = useState<string>("2.0");
  const [enableUp, setEnableUp] = useState<boolean>(true);
  const [enableDown, setEnableDown] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (instrument) {
      setError(null);
      setSuccess(null);
      setCustomPrice(tick ? tick.price.toString() : instrument.base_price.toString());
    }
  }, [instrument, tick]);

  if (!isOpen || !instrument) return null;

  // Resolve base reference price
  const currentPrice = tick ? tick.price : instrument.base_price;
  const openPrice = tick ? tick.open : instrument.base_price;

  let baseRefPrice = currentPrice;
  if (referenceType === "MARKET_OPEN") {
    baseRefPrice = openPrice;
  } else if (referenceType === "CUSTOM") {
    baseRefPrice = parseFloat(customPrice) || 0;
  }

  // Calculate live targets
  const upVal = parseFloat(upPercent) || 0;
  const downVal = parseFloat(downPercent) || 0;

  const upTarget = baseRefPrice > 0 && upVal > 0 ? baseRefPrice * (1 + upVal / 100) : 0;
  const downTarget = baseRefPrice > 0 && downVal > 0 ? baseRefPrice * (1 - downVal / 100) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("Please login to create and manage price alerts.");
      return;
    }

    if (!enableUp && !enableDown) {
      setError("Please enable at least one alert (UP or DOWN).");
      return;
    }

    if (referenceType === "CUSTOM" && baseRefPrice <= 0) {
      setError("Please enter a valid positive custom reference price.");
      return;
    }

    if (enableUp && upVal <= 0) {
      setError("UP percentage must be greater than 0.");
      return;
    }

    if (enableDown && downVal <= 0) {
      setError("DOWN percentage must be greater than 0.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await api.createDualAlerts({
        instrument_id: instrument.id,
        reference_type: referenceType,
        reference_price: referenceType === "CUSTOM" ? baseRefPrice : undefined,
        up_percentage: enableUp ? upVal : undefined,
        down_percentage: enableDown ? downVal : undefined,
      });

      // Dispatch high priority created notification with full details & audio blip
      notifyAlertCreated({
        symbol: instrument.symbol,
        name: instrument.name,
        reference_price: baseRefPrice,
        up_target: enableUp ? upTarget : undefined,
        up_percent: enableUp ? upVal : undefined,
        down_target: enableDown ? downTarget : undefined,
        down_percent: enableDown ? downVal : undefined,
      });

      // Request native desktop permission if not already enabled
      requestDesktopNotificationPermission().catch(() => {});

      setSuccess(`✅ Successfully armed alert triggers for ${instrument.symbol}!`);
      setTimeout(() => {
        if (onAlertCreated) onAlertCreated();
        onClose();
      }, 900);
    } catch (err: any) {
      setError(err.message || "Failed to create alerts.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-fade-in">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-surface-border bg-surface p-4 sm:p-6 shadow-2xl custom-scrollbar">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-surface-light"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Title & Instrument Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400 font-extrabold text-lg">
            {instrument.symbol.substring(0, 3)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-white">{instrument.symbol}</h2>
              <span className="text-xs px-2 py-0.5 rounded bg-surface-light border border-surface-border text-gray-300 font-mono">
                {instrument.exchange}
              </span>
            </div>
            <p className="text-xs text-gray-400">{instrument.name}</p>
          </div>
        </div>

        {/* Live Snapshot Pill */}
        <div className="mt-4 flex items-center justify-between rounded-xl bg-surface-light/80 p-3 border border-surface-border">
          <div>
            <span className="text-[11px] text-gray-400 block">Current Live LTP</span>
            <span className="text-base font-extrabold text-white font-mono">
              ₹{currentPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-gray-400 block">Today's Open</span>
            <span className="text-base font-extrabold text-gray-300 font-mono">
              ₹{openPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-red-950/80 border border-red-800 text-red-200 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Reference Price Selection */}
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-wider">
              1. Select Reference Price
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setReferenceType("CURRENT_PRICE")}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                  referenceType === "CURRENT_PRICE"
                    ? "bg-cyan-600/20 border-cyan-500 text-cyan-300"
                    : "bg-surface-light border-surface-border text-gray-400 hover:text-white"
                }`}
              >
                Live LTP (₹{currentPrice.toFixed(2)})
              </button>
              <button
                type="button"
                onClick={() => setReferenceType("MARKET_OPEN")}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                  referenceType === "MARKET_OPEN"
                    ? "bg-cyan-600/20 border-cyan-500 text-cyan-300"
                    : "bg-surface-light border-surface-border text-gray-400 hover:text-white"
                }`}
              >
                Market Open (₹{openPrice.toFixed(2)})
              </button>
              <button
                type="button"
                onClick={() => setReferenceType("CUSTOM")}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                  referenceType === "CUSTOM"
                    ? "bg-cyan-600/20 border-cyan-500 text-cyan-300"
                    : "bg-surface-light border-surface-border text-gray-400 hover:text-white"
                }`}
              >
                Custom Price
              </button>
            </div>

            {referenceType === "CUSTOM" && (
              <div className="mt-2">
                <input
                  type="number"
                  step="0.05"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder="Enter Custom Reference Price"
                  className="w-full rounded-lg bg-surface-light border border-surface-border px-3 py-2 text-sm text-white font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Trigger Percentage Settings */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider">
              2. Percentage Triggers & Auto-Calculated Targets
            </label>

            {/* UP Trigger Row */}
            <div className="p-3.5 rounded-xl border border-emerald-900/50 bg-emerald-950/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="enableUp"
                    checked={enableUp}
                    onChange={(e) => setEnableUp(e.target.checked)}
                    className="h-4 w-4 accent-emerald-500 rounded"
                  />
                  <label htmlFor="enableUp" className="text-xs font-bold text-emerald-300 flex items-center gap-1 cursor-pointer">
                    <ArrowUp className="h-3.5 w-3.5" />
                    UP Trigger (+%)
                  </label>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="100"
                    disabled={!enableUp}
                    value={upPercent}
                    onChange={(e) => setUpPercent(e.target.value)}
                    className="w-20 rounded-md bg-surface border border-emerald-800 px-2 py-1 text-right text-xs font-mono text-white disabled:opacity-40 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-xs text-gray-400">%</span>
                </div>
              </div>

              {enableUp && (
                <div className="mt-2 pt-2 border-t border-emerald-900/30 flex justify-between items-center text-xs">
                  <span className="text-gray-400">Target Trigger Price:</span>
                  <span className="font-extrabold text-bullish-text font-mono text-sm">
                    ₹{upTarget.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>

            {/* DOWN Trigger Row */}
            <div className="p-3.5 rounded-xl border border-red-900/50 bg-red-950/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="enableDown"
                    checked={enableDown}
                    onChange={(e) => setEnableDown(e.target.checked)}
                    className="h-4 w-4 accent-red-500 rounded"
                  />
                  <label htmlFor="enableDown" className="text-xs font-bold text-red-300 flex items-center gap-1 cursor-pointer">
                    <ArrowDown className="h-3.5 w-3.5" />
                    DOWN Trigger (-%)
                  </label>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="100"
                    disabled={!enableDown}
                    value={downPercent}
                    onChange={(e) => setDownPercent(e.target.value)}
                    className="w-20 rounded-md bg-surface border border-red-800 px-2 py-1 text-right text-xs font-mono text-white disabled:opacity-40 focus:outline-none focus:border-red-500"
                  />
                  <span className="text-xs text-gray-400">%</span>
                </div>
              </div>

              {enableDown && (
                <div className="mt-2 pt-2 border-t border-red-900/30 flex justify-between items-center text-xs">
                  <span className="text-gray-400">Target Trigger Price:</span>
                  <span className="font-extrabold text-bearish-text font-mono text-sm">
                    ₹{downTarget.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Submit Action */}
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-surface-light hover:bg-surface-border text-gray-300 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 transition-all hover:scale-[1.02]"
            >
              {loading ? "Creating Triggers..." : "Set Price Alert"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
