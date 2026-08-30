export interface Instrument {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  instrument_type: "INDEX" | "EQUITY";
  base_price: number;
  tick_size: number;
  lot_size: number;
  is_active: boolean;
  created_at: string;
}

export interface MarketTick {
  symbol: string;
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  change_percent: number;
  volume?: number;
  timestamp: string;
  source?: string;
}

export interface MarketStatus {
  is_open: boolean;
  status_text: string;
  market_time: string;
  session: "REGULAR" | "PRE_OPEN" | "CLOSED";
  next_open?: string;
  next_close?: string;
}

export interface OHLCVBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalAnalysisData {
  symbol: string;
  timeframe: string;
  candles: OHLCVBar[];
  indicators: {
    SMA_20?: { time: number; value: number | null }[];
    SMA_50?: { time: number; value: number | null }[];
    EMA_20?: { time: number; value: number | null }[];
    RSI_14?: { time: number; value: number | null }[];
    MACD?: { time: number; macd: number | null; signal: number | null; hist: number | null }[];
    BB_20_2?: { time: number; upper: number | null; middle: number | null; lower: number | null }[];
    VWAP?: { time: number; value: number | null }[];
    ATR_14?: { time: number; value: number | null }[];
  };
  disclaimer: string;
}
