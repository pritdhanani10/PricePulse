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

  async getSimulationStatus() {
    return this.request<{
      simulation_enabled: boolean;
      market_is_open: boolean;
      session: string;
      status_text: string;
    }>("/instruments/simulation/status");
  }

  async toggleSimulation(enabled?: boolean) {
    const url = enabled !== undefined ? `/instruments/simulation/toggle?enabled=${enabled}` : "/instruments/simulation/toggle";
    return this.request<{ simulation_enabled: boolean; message: string }>(url, {
      method: "POST",
    });
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

  async addWatchlistItem(watchlistId: string, instrumentId: string) {
    return this.request<import("../types/auth").Watchlist>(`/watchlists/${watchlistId}/items`, {
      method: "POST",
      body: JSON.stringify({ instrument_id: instrumentId }),
    });
  }

  async removeWatchlistItem(watchlistId: string, instrumentId: string) {
    return this.request<import("../types/auth").Watchlist>(
      `/watchlists/${watchlistId}/items/${instrumentId}`,
      {
        method: "DELETE",
      }
    );
  }

  // Technical Analysis
  async getTechnicalAnalysis(symbol: string, timeframe: string = "1D", limit: number = 120) {
    return this.request<import("../types/stock").TechnicalAnalysisData>(
      `/analysis/${symbol}?timeframe=${timeframe}&limit=${limit}`
    );
  }
}

export const api = new ApiClient();
