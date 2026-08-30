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

export interface IndexInfo {
  id: string;
  symbol: string;
  name: string;
  category: "MIDCAP" | "SMALLCAP" | "MICROCAP";
  exchange: string;
  description?: string;
  constituents_count: number;
  created_at?: string;
}

export interface IndexConstituent {
  id: string;
  instrument_id: string;
  symbol: string;
  name: string;
  exchange: string;
  instrument_type: string;
  current_price: number;
  change: number;
  change_percent: number;
  weightage?: number;
  lot_size?: number;
  tick_size?: number;
}

export interface IndexCategoryResponse {
  id: string;
  symbol: string;
  name: string;
  category: "MIDCAP" | "SMALLCAP" | "MICROCAP";
  exchange: string;
  description?: string;
  total_constituents: number;
  constituents: IndexConstituent[];
}

export interface Candle5m {
  symbol: string;
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  candle_start_time: string;
  candle_end_time: string;
  is_finalized: boolean;
}

export interface CandleResponse {
  symbol: string;
  timeframe: string;
  current_price: number | null;
  total_candles: number;
  latest_completed_candle: Candle5m | null;
  candles: Candle5m[];
}

export interface StrategyConfig {
  timeframe: string;
  buy_from: "LOW" | "OPEN" | "CLOSE";
  buy_percent: number;
  sell_from: "HIGH" | "OPEN" | "CLOSE";
  sell_percent: number;
  lifecycle_policy: "REPLACE_ON_NEW_CANDLE" | "EXPIRE_ON_NEW_CANDLE" | "ACTIVE_UNTIL_HIT";
}

export interface StrategyTrigger {
  id: string;
  symbol: string;
  signal_type: "BUY" | "SELL";
  reference_price: number;
  trigger_price: number;
  percentage: number;
  status: "ACTIVE" | "TRIGGERED" | "EXPIRED" | "REPLACED" | "CANCELLED";
  reference_candle_time?: string;
  created_at?: string;
  index_name?: string;
  index_category?: string;
}

export interface StrategySignal {
  id: string;
  symbol: string;
  strategy_name: string;
  signal_type: "BUY" | "SELL";
  trigger_price: number;
  actual_market_price: number;
  reference_price?: number;
  trigger_percent: number;
  signal_time: string;
  reference_candle_time?: string;
  index_name?: string;
  index_category?: string;
}

export interface BacktestSignal {
  signal_type: "BUY" | "SELL";
  symbol: string;
  reference_candle_time: string;
  reference_price: number;
  trigger_price: number;
  actual_triggered_price: number;
  triggered_candle_time: string;
  price_change_from_trigger?: number;
  metadata?: Record<string, any>;
}

export interface BacktestResult {
  symbol: string;
  timeframe: string;
  total_candles_analyzed: number;
  total_signals: number;
  buy_signals: number;
  sell_signals: number;
  signals: BacktestSignal[];
  summary: {
    strategy?: string;
    buy_rule?: string;
    sell_rule?: string;
    candle_count?: number;
    trigger_frequency_pct?: number;
    message?: string;
  };
  disclaimer: string;
}

