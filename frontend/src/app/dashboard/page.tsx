"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Filter, RefreshCw, Search, Sparkles } from "lucide-react";
import { Instrument } from "../../types/stock";
import { api } from "../../services/api";
import { useMarketSocket } from "../../context/MarketSocketContext";
import { IndexTicker } from "../../components/dashboard/IndexTicker";
import { StockCard } from "../../components/dashboard/StockCard";
import { CreateAlertModal } from "../../components/alerts/CreateAlertModal";

export default function DashboardPage() {
  const router = useRouter();
  const { ticks, subscribeSymbols } = useMarketSocket();
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [search, setSearch] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"ALL" | "INDEX" | "EQUITY">("ALL");
  const [selectedInstrumentForAlert, setSelectedInstrumentForAlert] = useState<Instrument | null>(null);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchInstruments = () => {
    setLoading(true);
    api
      .getInstruments()
      .then((data) => {
        setInstruments(data);
        const symbols = data.map((d) => d.symbol);
        subscribeSymbols(symbols);
      })
      .catch((err) => console.error("Failed to load instruments", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchInstruments();
  }, []);

  const handleOpenAlertModal = (inst: Instrument) => {
    setSelectedInstrumentForAlert(inst);
    setIsAlertModalOpen(true);
  };

  const handleOpenAnalysis = (symbol: string) => {
    router.push(`/analysis?symbol=${symbol}`);
  };

  const filteredInstruments = instruments.filter((inst) => {
    const matchesTab =
      activeTab === "ALL" ? true : inst.instrument_type === activeTab;
    const matchesSearch =
      inst.symbol.toLowerCase().includes(search.toLowerCase()) ||
      inst.name.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Index Tickers */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            Key Indian Benchmark Indices
          </h2>
          <button
            onClick={fetchInstruments}
            title="Refresh Data"
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-cyan-400 transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <IndexTicker
          ticks={ticks}
          onSelectSymbol={(sym) => {
            const inst = instruments.find((i) => i.symbol === sym);
            if (inst) handleOpenAlertModal(inst);
          }}
        />
      </section>

      {/* Controls Bar: Search & Category Tabs */}
      <section className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-surface-border">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-surface border border-surface-border w-full sm:w-auto">
          {(["ALL", "INDEX", "EQUITY"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === tab
                  ? "bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 shadow-inner"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {tab === "ALL" ? "All Assets" : tab === "INDEX" ? "Indices" : "NSE Equities"}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search symbol (e.g. RELIANCE, NIFTY)"
            className="w-full rounded-xl bg-surface border border-surface-border pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </section>

      {/* Stock Cards Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredInstruments.map((instrument) => {
          const tick = ticks[instrument.symbol.toUpperCase()];
          return (
            <StockCard
              key={instrument.id}
              instrument={instrument}
              tick={tick}
              onCreateAlert={handleOpenAlertModal}
              onOpenAnalysis={handleOpenAnalysis}
            />
          );
        })}
      </section>

      {/* Alert Creator Modal */}
      <CreateAlertModal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        instrument={selectedInstrumentForAlert}
        tick={selectedInstrumentForAlert ? ticks[selectedInstrumentForAlert.symbol.toUpperCase()] : undefined}
      />
    </div>
  );
}
