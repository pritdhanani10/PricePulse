"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, Plus, Trash2, Bell, LineChart, Search, Sparkles } from "lucide-react";
import { Instrument } from "../../types/stock";
import { Watchlist } from "../../types/auth";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useMarketSocket } from "../../context/MarketSocketContext";
import { CreateAlertModal } from "../../components/alerts/CreateAlertModal";
import { useRouter } from "next/navigation";

export default function WatchlistPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { ticks } = useMarketSocket();
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [activeWatchlistId, setActiveWatchlistId] = useState<string | null>(null);
  const [allInstruments, setAllInstruments] = useState<Instrument[]>([]);
  const [newWatchlistName, setNewWatchlistName] = useState<string>("");
  const [selectedInstIdToAdd, setSelectedInstIdToAdd] = useState<string>("");
  const [selectedInstForAlert, setSelectedInstForAlert] = useState<Instrument | null>(null);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchWatchlists = () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .getWatchlists()
      .then((data) => {
        setWatchlists(data);
        if (data.length > 0 && !activeWatchlistId) {
          setActiveWatchlistId(data[0].id);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchWatchlists();
    api.getInstruments().then((insts) => {
      setAllInstruments(insts);
      if (insts.length > 0) setSelectedInstIdToAdd(insts[0].id);
    });
  }, [user]);

  const handleCreateWatchlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWatchlistName.trim()) return;
    try {
      const created = await api.createWatchlist(newWatchlistName.trim());
      setWatchlists((prev) => [...prev, created]);
      setActiveWatchlistId(created.id);
      setNewWatchlistName("");
    } catch (err: any) {
      alert(err.message || "Failed to create watchlist");
    }
  };

  const handleAddItem = async () => {
    if (!activeWatchlistId || !selectedInstIdToAdd) return;
    try {
      const updated = await api.addWatchlistItem(activeWatchlistId, selectedInstIdToAdd);
      setWatchlists((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    } catch (err: any) {
      alert(err.message || "Failed to add instrument");
    }
  };

  const handleRemoveItem = async (instrumentId: string) => {
    if (!activeWatchlistId) return;
    try {
      const updated = await api.removeWatchlistItem(activeWatchlistId, instrumentId);
      setWatchlists((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    } catch (err: any) {
      alert(err.message || "Failed to remove instrument");
    }
  };

  const activeWatchlist = watchlists.find((w) => w.id === activeWatchlistId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Bookmark className="h-6 w-6 text-cyan-400" />
            Custom Watchlists
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Organize and monitor specific baskets of Indian indices and high-conviction equities.
          </p>
        </div>

        {/* Create Watchlist Form */}
        <form onSubmit={handleCreateWatchlist} className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            value={newWatchlistName}
            onChange={(e) => setNewWatchlistName(e.target.value)}
            placeholder="New Watchlist Name..."
            className="rounded-xl bg-surface border border-surface-border px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
          />
          <button
            type="submit"
            className="flex items-center gap-1 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-lg shadow-cyan-600/20"
          >
            <Plus className="h-4 w-4" />
            Create
          </button>
        </form>
      </div>

      {!user ? (
        <div className="p-8 text-center rounded-2xl border border-surface-border bg-surface">
          <p className="text-sm text-gray-300">Please sign in to view and curate your custom watchlists.</p>
          <Link
            href="/login"
            className="mt-4 inline-block px-4 py-2 rounded-xl bg-cyan-600 text-white text-xs font-bold"
          >
            Sign In Now
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Watchlist Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {watchlists.map((wl) => (
              <button
                key={wl.id}
                onClick={() => setActiveWatchlistId(wl.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeWatchlistId === wl.id
                    ? "bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 shadow-inner"
                    : "bg-surface border border-surface-border text-gray-400 hover:text-white"
                }`}
              >
                {wl.name} ({wl.items.length})
              </button>
            ))}
          </div>

          {/* Add Item Bar */}
          {activeWatchlist && (
            <div className="flex items-center gap-3 p-3 rounded-2xl border border-surface-border bg-surface">
              <span className="text-xs font-bold text-gray-300 whitespace-nowrap">Add Instrument:</span>
              <select
                value={selectedInstIdToAdd}
                onChange={(e) => setSelectedInstIdToAdd(e.target.value)}
                className="flex-1 rounded-xl bg-surface-light border border-surface-border px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
              >
                {allInstruments.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.symbol} — {inst.name} ({inst.instrument_type})
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddItem}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors shadow-lg shadow-cyan-600/20"
              >
                Add
              </button>
            </div>
          )}

          {/* Watchlist Items Grid */}
          {activeWatchlist && activeWatchlist.items.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-surface-border bg-surface">
              <p className="text-xs text-gray-400">No instruments added to this watchlist yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeWatchlist?.items.map((item) => {
                const inst = item.instrument;
                const tick = ticks[inst.symbol.toUpperCase()];
                const price = tick?.price ?? inst.base_price;
                const change = tick?.change ?? 0;
                const changePct = tick?.change_percent ?? 0;
                const isUp = change >= 0;

                return (
                  <div
                    key={item.id}
                    className="relative flex flex-col justify-between rounded-xl border border-surface-border bg-surface p-4 hover:border-cyan-500/40 transition-all shadow-lg"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-white text-base">
                            {inst.symbol}
                            <span className="text-[10px] px-1 py-0.5 rounded bg-surface-light text-gray-400 font-mono">
                              {inst.exchange}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 truncate max-w-[180px]">{inst.name}</p>
                        </div>
                        <div
                          className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                            isUp
                              ? "bg-emerald-950 text-bullish-text border border-emerald-800"
                              : "bg-red-950 text-bearish-text border border-red-800"
                          }`}
                        >
                          {isUp ? "+" : ""}
                          {changePct.toFixed(2)}%
                        </div>
                      </div>

                      <div className="mt-3 flex items-baseline justify-between font-mono">
                        <span className="text-xl font-extrabold text-white">
                          ₹{price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                        <span className={`text-xs ${isUp ? "text-bullish-text" : "text-bearish-text"}`}>
                          {isUp ? "+" : ""}
                          {change.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-surface-border/70 flex items-center justify-between gap-2">
                      <button
                        onClick={() => {
                          setSelectedInstForAlert(inst);
                          setIsAlertModalOpen(true);
                        }}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 text-xs font-semibold border border-cyan-500/30"
                      >
                        <Bell className="h-3.5 w-3.5" />
                        Set Alert
                      </button>

                      <button
                        onClick={() => router.push(`/analysis?symbol=${inst.symbol}`)}
                        className="p-1.5 rounded-lg bg-surface-light hover:bg-surface-border text-gray-300 text-xs"
                      >
                        <LineChart className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => handleRemoveItem(inst.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-950/40 text-xs transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Alert Creator Modal */}
      {selectedInstForAlert && (
        <CreateAlertModal
          isOpen={isAlertModalOpen}
          onClose={() => setIsAlertModalOpen(false)}
          instrument={selectedInstForAlert}
          tick={ticks[selectedInstForAlert.symbol.toUpperCase()]}
        />
      )}
    </div>
  );
}
