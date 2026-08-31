const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

class ApiClient {
  private getToken(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem("access_token");
    }
    return null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errorDetail = `Request failed with status ${res.status}`;
      try {
        const errorJson = await res.json();
        errorDetail = errorJson.detail || errorDetail;
      } catch (_) {}
      throw new Error(errorDetail);
    }

    if (res.status === 204) {
      return null as unknown as T;
    }

    return res.json();
  }

  // Auth Endpoints
  async register(data: { name: string; email: string; password: string }) {
    return this.request<import("../types/auth").AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async login(data: { email: string; password: string }) {
    return this.request<import("../types/auth").AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getMe() {
    return this.request<import("../types/auth").User>("/auth/me");
  }

  // Instruments & Market Endpoints
  async getInstruments(type?: string, search?: string) {
    let url = "/instruments";
    const params = new URLSearchParams();
    if (type) params.append("instrument_type", type);
    if (search) params.append("search", search);
    if (params.toString()) url += `?${params.toString()}`;
    return this.request<import("../types/stock").Instrument[]>(url);
  }

  async getMarketStatus() {
    return this.request<import("../types/stock").MarketStatus>("/instruments/market/status");
  }

  async getAllQuotes() {
    return this.request<import("../types/stock").MarketTick[]>("/instruments/quotes");
  }

  async getInstrumentPrice(symbol: string) {
    return this.request<import("../types/stock").MarketTick>(`/instruments/${symbol}/price`);
  }

  async getInstrumentHistory(symbol: string, timeframe: string = "1D", limit: number = 100) {
    return this.request<import("../types/stock").OHLCVBar[]>(
      `/instruments/${symbol}/history?timeframe=${timeframe}&limit=${limit}`
    );
  }

  // Alerts Endpoints
  async getAlerts(status?: string) {
    const url = status ? `/alerts?status=${status}` : "/alerts";
    return this.request<import("../types/alert").Alert[]>(url);
  }

  async createAlert(payload: import("../types/alert").CreateAlertPayload) {
    return this.request<import("../types/alert").Alert>("/alerts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async createDualAlerts(payload: import("../types/alert").CreateDualAlertPayload) {
    return this.request<import("../types/alert").Alert[]>("/alerts/dual", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateAlert(alertId: string, payload: { status?: string; threshold_percent?: number }) {
    return this.request<import("../types/alert").Alert>(`/alerts/${alertId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async deleteAlert(alertId: string) {
    return this.request<void>(`/alerts/${alertId}`, {
      method: "DELETE",
    });
  }

  async getAlertHistory() {
    return this.request<import("../types/alert").AlertHistoryEntry[]>("/alerts/history");
  }

  // Watchlists Endpoints
  async getWatchlists() {
    return this.request<import("../types/auth").Watchlist[]>("/watchlists");
  }

  async createWatchlist(name: string) {
    return this.request<import("../types/auth").Watchlist>("/watchlists", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  async deleteWatchlist(watchlistId: string) {
    return this.request<void>(`/watchlists/${watchlistId}`, {
      method: "DELETE",
    });
  }

  async addWatchlistItem(
    watchlistId: string,
    instrumentId: string,
    options?: {
      auto_monitor?: boolean;
      strategy_code?: string;
      buy_percent?: number;
      sell_percent?: number;
    }
  ) {
    return this.request<import("../types/auth").Watchlist>(`/watchlists/${watchlistId}/items`, {
      method: "POST",
      body: JSON.stringify({
        instrument_id: instrumentId,
        auto_monitor: options?.auto_monitor ?? true,
        strategy_code: options?.strategy_code ?? "CANDLE_3_PERCENT_5M",
        buy_percent: options?.buy_percent ?? 3.0,
        sell_percent: options?.sell_percent ?? 3.0,
      }),
    });
  }

  async updateWatchlistItem(
    watchlistId: string,
    itemId: string,
    payload: {
      auto_monitor?: boolean;
      strategy_code?: string;
      buy_percent?: number;
      sell_percent?: number;
    }
  ) {
    return this.request<import("../types/auth").Watchlist>(
      `/watchlists/${watchlistId}/items/${itemId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    );
  }

  async removeWatchlistItem(watchlistId: string, instrumentId: string) {
    return this.request<import("../types/auth").Watchlist>(
      `/watchlists/${watchlistId}/items/${instrumentId}`,
      {
        method: "DELETE",
      }
    );
  }

  async getWatchlistAutoMonitorSummary() {
    return this.request<import("../types/stock").AutoMonitorItemSummary[]>("/watchlists/auto-monitor/summary");
  }

  // Notification Center & Web Push Management
  async getVapidPublicKey() {
    return this.request<{ public_key: string }>("/notifications/vapid-public-key");
  }

  async savePushSubscription(payload: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    user_agent?: string;
  }) {
    return this.request<any>("/notifications/push-subscription", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async deletePushSubscription(endpoint: string) {
    return this.request<{ status: string; unregistered: boolean }>(
      `/notifications/push-subscription?endpoint=${encodeURIComponent(endpoint)}`,
      {
        method: "DELETE",
      }
    );
  }

  async getWatchlistNotifications(unreadOnly?: boolean, limit: number = 50) {
    const params = new URLSearchParams();
    if (unreadOnly) params.append("unread_only", "true");
    params.append("limit", limit.toString());
    return this.request<import("../types/auth").NotificationListResponse>(
      `/notifications?${params.toString()}`
    );
  }

  async markNotificationRead(notificationId: string) {
    return this.request<{ status: string; message: string }>(
      `/notifications/${notificationId}/read`,
      {
        method: "PUT",
      }
    );
  }

  async markAllNotificationsRead() {
    return this.request<{ status: string; count: number; message: string }>(
      "/notifications/read-all",
      {
        method: "POST",
      }
    );
  }

  // Technical Analysis
  async getTechnicalAnalysis(symbol: string, timeframe: string = "1D", limit: number = 120) {
    return this.request<import("../types/stock").TechnicalAnalysisData>(
      `/analysis/${symbol}?timeframe=${timeframe}&limit=${limit}`
    );
  }

  // Index Explorer
  async getIndexes() {
    return this.request<import("../types/stock").IndexInfo[]>("/indexes");
  }

  async getIndexByCategory(category: string) {
    return this.request<import("../types/stock").IndexCategoryResponse>(`/indexes/category/${category}`);
  }

  // 5-Minute Candles & Strategy
  async get5mCandles(symbol: string, limit: number = 60) {
    return this.request<import("../types/stock").CandleResponse>(`/strategy/candles/${symbol}?limit=${limit}`);
  }

  async getStrategyConfig() {
    return this.request<{
      strategy_name: string;
      strategy_code: string;
      description: string;
      config: import("../types/stock").StrategyConfig;
    }>("/strategy/config");
  }

  async updateStrategyConfig(config: Partial<import("../types/stock").StrategyConfig>) {
    return this.request<{
      status: string;
      message: string;
      config: import("../types/stock").StrategyConfig;
    }>("/strategy/config", {
      method: "POST",
      body: JSON.stringify(config),
    });
  }

  async getActiveTriggers(symbol?: string) {
    const query = symbol ? `?symbol=${symbol}` : "";
    return this.request<import("../types/stock").StrategyTrigger[]>(`/strategy/triggers/active${query}`);
  }

  async getStrategySignals(params?: {
    symbol?: string;
    signal_type?: string;
    index_id?: string;
    limit?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.symbol) searchParams.append("symbol", params.symbol);
    if (params?.signal_type) searchParams.append("signal_type", params.signal_type);
    if (params?.index_id) searchParams.append("index_id", params.index_id);
    if (params?.limit) searchParams.append("limit", params.limit.toString());

    const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return this.request<import("../types/stock").StrategySignal[]>(`/strategy/signals${qs}`);
  }

  async runBacktest(data: {
    symbol: string;
    timeframe?: string;
    buy_percent?: number;
    sell_percent?: number;
    buy_from?: string;
    sell_from?: string;
    candle_limit?: number;
    lifecycle_policy?: string;
  }) {
    return this.request<import("../types/stock").BacktestResult>("/strategy/backtest", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient();

