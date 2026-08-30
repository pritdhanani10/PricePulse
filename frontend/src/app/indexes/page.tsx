import React, { Suspense } from "react";
import { IndexExplorer } from "../../components/indexes/IndexExplorer";

export const metadata = {
  title: "Index Explorer | NIFTY Midcap, Smallcap & Microcap | PulseTrader",
  description: "Explore NIFTY Midcap, Smallcap, and Microcap constituent stocks and run automated 5-minute 3% candle strategies.",
};

export default function IndexesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Suspense
        fallback={
          <div className="flex h-96 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
          </div>
        }
      >
        <IndexExplorer />
      </Suspense>
    </div>
  );
}
