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
  created_at: string;
}

export interface Watchlist {
  id: string;
  user_id: string;
  name: string;
  items: WatchlistItem[];
  created_at: string;
}
