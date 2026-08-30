export interface User {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface WatchlistItem {
  id: string;
  watchlist_id: string;
  instrument_id: string;
  instrument: import("./stock").Instrument;
  auto_monitor: boolean;
  strategy_code: string;
  buy_percent: number;
  sell_percent: number;
  created_at: string;
}

export interface Watchlist {
  id: string;
  user_id: string;
  name: string;
  items: WatchlistItem[];
  created_at: string;
}

export interface UserNotification {
  id: string;
  user_id: string;
  watchlist_id?: string | null;
  instrument_id?: string | null;
  symbol: string;
  signal_id?: string | null;
  notification_type: string;
  title: string;
  message: string;
  signal_type?: "BUY" | "SELL" | null;
  trigger_price?: number | null;
  market_price?: number | null;
  reference_price?: number | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface NotificationListResponse {
  total: number;
  unread_count: number;
  notifications: UserNotification[];
}
