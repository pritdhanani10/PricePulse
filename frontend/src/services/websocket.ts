type TickCallback = (tick: import("../types/stock").MarketTick) => void;
type AlertCallback = (alertData: any) => void;

class MarketWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private tickListeners: Set<TickCallback> = new Set();
  private alertListeners: Set<AlertCallback> = new Set();
  private subscribedSymbols: Set<string> = new Set();
  private reconnectTimeout: any = null;
  private isExplicitDisconnect = false;
  private reconnectDelay = 2000;

  constructor() {
    this.url = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/market";
  }

  public connect(token?: string | null) {
    if (typeof window === "undefined") return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitDisconnect = false;
    let endpoint = this.url;
    if (token) {
      endpoint += `?token=${encodeURIComponent(token)}`;
    }

    try {
      this.ws = new WebSocket(endpoint);

      this.ws.onopen = () => {
        this.reconnectDelay = 2000;
        // Resubscribe existing symbols
        if (this.subscribedSymbols.size > 0) {
          this.sendSubscription(Array.from(this.subscribedSymbols));
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "TICK" && payload.data) {
            this.tickListeners.forEach((cb) => cb(payload.data));
          } else if (payload.type === "ALERT_TRIGGERED" && payload.data) {
            this.alertListeners.forEach((cb) => cb(payload.data));
          }
        } catch (_) {}
      };

      this.ws.onclose = () => {
        this.ws = null;
        if (!this.isExplicitDisconnect) {
          this.scheduleReconnect(token);
        }
      };

      this.ws.onerror = () => {
        if (this.ws) {
          this.ws.close();
        }
      };
    } catch (_) {
      this.scheduleReconnect(token);
    }
  }

  private scheduleReconnect(token?: string | null) {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 15000);
      this.connect(token);
    }, this.reconnectDelay);
  }

  public disconnect() {
    this.isExplicitDisconnect = true;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public subscribe(symbols: string[]) {
    symbols.forEach((s) => this.subscribedSymbols.add(s.toUpperCase()));
    this.sendSubscription(symbols);
  }

  public unsubscribe(symbols: string[]) {
    symbols.forEach((s) => this.subscribedSymbols.delete(s.toUpperCase()));
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          action: "unsubscribe",
          symbols: symbols.map((s) => s.toUpperCase()),
        })
      );
    }
  }

  private sendSubscription(symbols: string[]) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && symbols.length > 0) {
      this.ws.send(
        JSON.stringify({
          action: "subscribe",
          symbols: symbols.map((s) => s.toUpperCase()),
        })
      );
    }
  }

  public onTick(cb: TickCallback) {
    this.tickListeners.add(cb);
    return () => this.tickListeners.delete(cb);
  }

  public onAlert(cb: AlertCallback) {
    this.alertListeners.add(cb);
    return () => this.alertListeners.delete(cb);
  }
}

export const marketSocket = new MarketWebSocketClient();
