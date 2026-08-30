import { Instrument } from "./stock";

export interface Alert {
  id: string;
  user_id: string;
  instrument_id: string;
  alert_type: "PERCENTAGE" | "ABSOLUTE";
  reference_type: "CURRENT_PRICE" | "MARKET_OPEN" | "CUSTOM";
  reference_price: number;
  direction: "UP" | "DOWN";
  threshold_percent: number;
  target_price: number;
  status: "ACTIVE" | "TRIGGERED" | "DISABLED" | "CANCELLED";
  triggered_at?: string | null;
  created_at: string;
  updated_at: string;
  instrument?: Instrument;
}

export interface AlertHistoryEntry {
  id: string;
  alert_id: string;
  user_id: string;
  instrument_id: string;
  direction: "UP" | "DOWN";
  trigger_price: number;
  target_price: number;
  reference_price: number;
  notification_channel: string;
  notification_status: string;
  triggered_at: string;
  instrument?: Instrument;
}

export interface CreateAlertPayload {
  instrument_id: string;
  direction: "UP" | "DOWN";
  reference_type: "CURRENT_PRICE" | "MARKET_OPEN" | "CUSTOM";
  reference_price?: number;
  threshold_percent: number;
}

export interface CreateDualAlertPayload {
  instrument_id: string;
  reference_type: "CURRENT_PRICE" | "MARKET_OPEN" | "CUSTOM";
  reference_price?: number;
  up_percentage?: number;
  down_percentage?: number;
}
