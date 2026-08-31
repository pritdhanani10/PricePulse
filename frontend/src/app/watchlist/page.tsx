"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Activity, 
  Bell, 
  Bookmark, 
  CheckCheck, 
  CheckCircle2, 
  ChevronRight, 
  Filter, 
  Layers, 
  LineChart, 
  Plus, 
  Radio, 
  RefreshCw, 
  Search, 
  ShieldCheck, 
  Sparkles, 
  Trash2, 
  Volume2, 
  Zap 
} from "lucide-react";
import { AutoMonitorItemSummary, Instrument } from "../../types/stock";
import { Watchlist, WatchlistItem } from "../../types/auth";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useMarketSocket } from "../../context/MarketSocketContext";
import { CreateAlertModal } from "../../components/alerts/CreateAlertModal";
import { WatchlistAutoMonitorCard } from "../../components/watchlist/WatchlistAutoMonitorCard";
import { WatchlistNotificationsPanel } from "../../components/watchlist/WatchlistNotificationsPanel";
import { WatchlistTriggersOverview } from "../../components/watchlist/WatchlistTriggersOverview";

export default function WatchlistPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { 
    ticks, 
    userNotifications, 
    unreadNotificationCount, 
    fetchUserNotifications, 
    markNotificationAsRead, 
    markAllNotificationsAsRead,
    hasNotificationPermission,
    requestDesktopNotificationPermission,
  } = useMarketSocket();

  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [activeWatchlistId, setActiveWatchlistId] = useState<string | null>(null);
  const [allInstruments, setAllInstruments] = useState<Instrument[]>([]);
  const [searchInstrument, setSearchInstrument] = useState<string>("");
  const [newWatchlistName, setNewWatchlistName] = useState<string>("");
  const [selectedInstIdToAdd, setSelectedInstIdToAdd] = useState<string>("");
  const [selectedInstForAlert, setSelectedInstForAlert] = useState<Instrument | null>(null);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [autoMonitorSummaries, setAutoMonitorSummaries] = useState<AutoMonitorItemSummary[]>([]);
  const [activeTab, setActiveTab] = useState<"grid" | "radar" | "notifications">("grid");
  const [hasDesktopPerm, setHasDesktopPerm] = useState<boolean>(false);

  const fetchWatchlistsAndSummary = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [wlData, summaryData] = await Promise.all([
        api.getWatchlists(),
        api.getWatchlistAutoMonitorSummary().catch(() => []),
      ]);
      setWatchlists(wlData);
      setAutoMonitorSummaries(summaryData);
      if (wlData.length > 0 && !activeWatchlistId) {
        setActiveWatchlistId(wlData[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlistsAndSummary();
    api.getInstruments().then((insts) => {
      setAllInstruments(insts);
      if (insts.length > 0) setSelectedInstIdToAdd(insts[0].id);
    });

    if (typeof window !== "undefined" && "Notification" in window) {
      setHasDesktopPerm(Notification.permission === "granted");
    }
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

  const handleAddItem = async (instId?: string) => {
    const targetId = instId || selectedInstIdToAdd;
    if (!activeWatchlistId || !targetId) return;
    try {
      const updated = await api.addWatchlistItem(activeWatchlistId, targetId, {
        auto_monitor: true,
        buy_percent: 3.0,
        sell_percent: 3.0,
      });
      setWatchlists((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      setSearchInstrument("");
      // Refresh summary
      api.getWatchlistAutoMonitorSummary().then((s) => setAutoMonitorSummaries(s)).catch(() => {});
    } catch (err: any) {
      alert(err.message || "Failed to add instrument to watchlist");
    }
  };

  const handleItemUpdated = (updatedItem: WatchlistItem) => {
    setWatchlists((prev) =>
      prev.map((wl) => {
        if (wl.id === updatedItem.watchlist_id) {
          return {
            ...wl,
            items: wl.items.map((i) => (i.id === updatedItem.id ? updatedItem : i)),
          };
        }
        return wl;
      })
    );
    api.getWatchlistAutoMonitorSummary().then((s) => setAutoMonitorSummaries(s)).catch(() => {});
  };

  const handleRemoveItem = async (instrumentId: string) => {
    if (!activeWatchlistId) return;
    try {
      const updated = await api.removeWatchlistItem(activeWatchlistId, instrumentId);
      setWatchlists((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      api.getWatchlistAutoMonitorSummary().then((s) => setAutoMonitorSummaries(s)).catch(() => {});
    } catch (err: any) {
      alert(err.message || "Failed to remove instrument");
    }
  };

  const handleRequestDesktopPermission = async () => {
    const granted = await requestDesktopNotificationPermission();
    setHasDesktopPerm(granted);
  };

  const activeWatchlist = watchlists.find((w) => w.id === activeWatchlistId);

  // Filter instruments for quick search
  const filteredInstruments = allInstruments.filter(
    (i) =>
      i.symbol.toLowerCase().includes(searchInstrument.toLowerCase()) ||
      i.name.toLowerCase().includes(searchInstrument.toLowerCase())
  );

  const totalMonitoredCount = autoMonitorSummaries.length;
  const activeItemsCount = activeWatchlist?.items.length || 0;

  return (
    <div className="space-y-6">
      {/* Header & Create Watchlist */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <Bookmark className="h-6 w-6 text-cyan-400" />
              Watchlists & Auto Monitoring
            </h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono font-bold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              24/7 BACKGROUND ENGINE
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Automatic 5-minute candle analysis, BUY/SELL trigger calculation, and background signal generation for all your stocks.
          </p>
        </div>

        {/* Create Watchlist Form */}
        <form onSubmit={handleCreateWatchlist} className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            value={newWatchlistName}
            onChange={(e) => setNewWatchlistName(e.target.value)}
            placeholder="New Basket Name..."
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

      {/* Cross-Device Notification Readiness & Test Banner */}
      <div className="rounded-2xl border border-surface-border bg-gradient-to-r from-surface via-[#0e1420] to-surface p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Cross-Device Watchlist Signal Notifications</span>
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
                {hasNotificationPermission ? "Windows & Phone Ready" : "Permission Needed"}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Automated 5-minute BUY/SELL strategy breakouts are pushed to your Windows Action Center, Android, and iOS device.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {!hasNotificationPermission && (
            <button
              onClick={handleRequestDesktopPermission}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shrink-0"
            >
              Enable Notifications
            </button>
          )}
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-surface-border bg-surface p-4 flex items-center gap-3 shadow-lg">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800/50">
            <Bookmark className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-white font-mono">{activeItemsCount}</div>
            <div className="text-[11px] text-gray-400">Basket Instruments</div>
          </div>
        </div>

        <div className="rounded-2xl border border-surface-border bg-surface p-4 flex items-center gap-3 shadow-lg">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800/50">
            <Radio className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-emerald-400 font-mono">{totalMonitoredCount}</div>
            <div className="text-[11px] text-gray-400">Live Auto-Monitored 24/7</div>
          </div>
        </div>

        <div className="rounded-2xl border border-surface-border bg-surface p-4 flex items-center gap-3 shadow-lg">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-950 text-indigo-400 border border-indigo-800/50">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-white font-mono">5m 3%</div>
            <div className="text-[11px] text-gray-400">Continuous Strategy</div>
          </div>
        </div>

        <div className="rounded-2xl border border-surface-border bg-surface p-4 flex items-center gap-3 shadow-lg">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-950 text-rose-400 border border-rose-800/50">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-white font-mono">{unreadNotificationCount}</div>
            <div className="text-[11px] text-gray-400">Unread Strategy Signals</div>
          </div>
        </div>
      </div>

      {!user ? (
        <div className="p-12 text-center rounded-2xl border border-surface-border bg-surface">
          <p className="text-sm text-gray-300">Please sign in to view and curate your auto-monitored watchlists.</p>
          <Link
            href="/login"
            className="mt-4 inline-block px-5 py-2.5 rounded-xl bg-cyan-600 text-white text-xs font-bold shadow-lg shadow-cyan-600/30"
          >
            Sign In Now
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Watchlist Tabs Bar & View Switcher */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            {/* Watchlist Baskets */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
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

            {/* View Switcher Tabs */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-surface border border-surface-border text-xs font-mono">
              <button
                onClick={() => setActiveTab("grid")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  activeTab === "grid"
                    ? "bg-cyan-600/20 text-cyan-300 border border-cyan-500/30"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Cards View
              </button>
              <button
                onClick={() => setActiveTab("radar")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  activeTab === "radar"
                    ? "bg-cyan-600/20 text-cyan-300 border border-cyan-500/30"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Trigger Radar
              </button>
              <button
                onClick={() => setActiveTab("notifications")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold transition-all ${
                  activeTab === "notifications"
                    ? "bg-cyan-600/20 text-cyan-300 border border-cyan-500/30"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <span>Signals Ledger</span>
                {unreadNotificationCount > 0 && (
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                )}
              </button>
            </div>
          </div>

          {/* Quick Add Stock Search Bar */}
          {activeWatchlist && (
            <div className="relative p-3 rounded-2xl border border-surface-border bg-surface flex flex-col sm:flex-row items-center gap-3">
              <span className="text-xs font-black text-gray-300 uppercase whitespace-nowrap flex items-center gap-1.5">
                <Plus className="h-4 w-4 text-cyan-400" />
                Add Stock:
              </span>

              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-500" />
                <input
                  type="text"
                  value={searchInstrument}
                  onChange={(e) => setSearchInstrument(e.target.value)}
                  placeholder="Search and add any NSE stock or index (e.g. RELIANCE, TCS, TEJASNET)..."
                  className="w-full rounded-xl bg-surface-light border border-surface-border pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none font-mono"
                />

                {/* Instant Suggestion Dropdown */}
                {searchInstrument.trim().length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-30 max-h-48 overflow-y-auto rounded-xl bg-surface border border-surface-border shadow-2xl p-1">
                    {filteredInstruments.slice(0, 6).map((inst) => (
                      <button
                        key={inst.id}
                        onClick={() => handleAddItem(inst.id)}
                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-cyan-950/40 text-left transition-colors font-mono text-xs text-gray-200"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-black text-white">{inst.symbol}</span>
                          <span className="text-[10px] text-gray-400 truncate max-w-[200px]">
                            {inst.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-light text-cyan-400">
                            {inst.instrument_type}
                          </span>
                          <span className="text-xs font-bold text-cyan-400">+ Add</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Or Select from Dropdown */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={selectedInstIdToAdd}
                  onChange={(e) => setSelectedInstIdToAdd(e.target.value)}
                  className="rounded-xl bg-surface-light border border-surface-border px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono w-full sm:w-60 truncate"
                >
                  {allInstruments.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.symbol} — {inst.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleAddItem()}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold whitespace-nowrap transition-colors shadow-lg shadow-cyan-600/20"
                >
                  Add Stock
                </button>
              </div>
            </div>
          )}

          {/* TAB 1: Grid Cards View */}
          {activeTab === "grid" && (
            <>
              {activeWatchlist && activeWatchlist.items.length === 0 ? (
                <div className="p-16 text-center rounded-2xl border border-surface-border bg-surface">
                  <Bookmark className="h-10 w-10 text-gray-500 mx-auto mb-2 opacity-50" />
                  <h3 className="text-sm font-bold text-white">Watchlist is Empty</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Add stocks above to automatically prime 5-minute candle strategy monitoring and background trigger alerts.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeWatchlist?.items.map((item) => (
                    <WatchlistAutoMonitorCard
                      key={item.id}
                      item={item}
                      tick={ticks[item.instrument.symbol.toUpperCase()]}
                      onItemUpdated={handleItemUpdated}
                      onRemoveItem={handleRemoveItem}
                      onSetAlert={(inst) => {
                        setSelectedInstForAlert(inst);
                        setIsAlertModalOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* TAB 2: Live 5m Strategy Trigger Radar */}
          {activeTab === "radar" && (
            <WatchlistTriggersOverview
              summaries={autoMonitorSummaries}
              ticks={ticks}
              loading={loading}
              onRefresh={fetchWatchlistsAndSummary}
            />
          )}

          {/* TAB 3: Strategy Signal Notifications Ledger */}
          {activeTab === "notifications" && (
            <WatchlistNotificationsPanel
              notifications={userNotifications}
              unreadCount={unreadNotificationCount}
              loading={loading}
              onRefresh={fetchUserNotifications}
              onMarkRead={markNotificationAsRead}
              onMarkAllRead={markAllNotificationsAsRead}
            />
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
