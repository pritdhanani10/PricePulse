import asyncio
from datetime import datetime, timezone
import logging
from typing import AsyncGenerator, Dict, List, Optional
import httpx
from app.core.config import settings
from app.schemas.market import MarketStatus, MarketTick, OHLCVBar
from app.services.market_data.base import MarketDataProvider
from app.services.market_data.market_hours import get_indian_market_status

logger = logging.getLogger(__name__)

# Symbol mapping from platform symbol to Yahoo Finance ticker
INDIAN_TICKER_MAP = {
    "NIFTY50": "^NSEI",
    "BANKNIFTY": "^NSEBANK",
    "FINNIFTY": "NIFTY_FIN_SERVICE.NS",
}


def to_live_ticker(symbol: str) -> str:
    sym = symbol.upper().strip()
    if sym in INDIAN_TICKER_MAP:
        return INDIAN_TICKER_MAP[sym]
    if sym.endswith(".NS") or sym.endswith(".BO") or sym.startswith("^"):
        return sym
    return f"{sym}.NS"


class LiveMarketDataProvider(MarketDataProvider):
    """Real-Time Live Indian Market Data Provider using high-frequency live market quote feeds."""

    def __init__(self):
        self._subscribed_symbols: set = {
            "NIFTY50", "BANKNIFTY", "FINNIFTY",
            "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK",
            "TATAMOTORS", "SBIN", "BHARTIARTL", "ITC"
        }
        self._cache: Dict[str, MarketTick] = {}
        self._running: bool = False
        self._streaming_active: bool = True
        self._http_client: Optional[httpx.AsyncClient] = None

    def is_simulation_enabled(self) -> bool:
        return self._streaming_active

    def set_simulation_state(self, enabled: bool) -> bool:
        self._streaming_active = enabled
        return self._streaming_active

    async def connect(self) -> None:
        self._running = True
        if not self._http_client or self._http_client.is_closed:
            limits = httpx.Limits(max_keepalive_connections=20, max_connections=50)
            self._http_client = httpx.AsyncClient(
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
                timeout=8.0,
                limits=limits,
            )
        logger.info("Connected to Live Market Data Provider with high-concurrency pooling.")

    async def disconnect(self) -> None:
        self._running = False
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()
        logger.info("Disconnected from Live Market Data Provider.")

    async def subscribe(self, symbols: List[str]) -> None:
        for s in symbols:
            self._subscribed_symbols.add(s.upper().strip())

    async def unsubscribe(self, symbols: List[str]) -> None:
        for s in symbols:
            self._subscribed_symbols.discard(s.upper().strip())

    async def get_latest_price(self, symbol: str) -> Optional[float]:
        quote = await self.get_quote(symbol)
        return quote.price if quote else None

    async def _fetch_live_ticker_data(self, symbol: str) -> Optional[MarketTick]:
        ticker = to_live_ticker(symbol)
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1m&range=1d"
        try:
            if not self._http_client or self._http_client.is_closed:
                limits = httpx.Limits(max_keepalive_connections=20, max_connections=50)
                self._http_client = httpx.AsyncClient(
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
                    timeout=8.0,
                    limits=limits,
                )
            res = await self._http_client.get(url)
            if res.status_code == 200:
                data = res.json()
                result = data.get("chart", {}).get("result")
                if result and len(result) > 0:
                    meta = result[0].get("meta", {})
                    current_price = meta.get("regularMarketPrice")
                    if current_price is None:
                        return None
                    prev_close = meta.get("chartPreviousClose") or meta.get("previousClose") or current_price
                    day_high = meta.get("regularMarketDayHigh") or current_price
                    day_low = meta.get("regularMarketDayLow") or current_price
                    day_open = meta.get("regularMarketOpen") or prev_close
                    volume = meta.get("regularMarketVolume", 0)

                    change = round(current_price - prev_close, 2)
                    change_pct = round((change / prev_close) * 100, 2) if prev_close else 0.0

                    tick = MarketTick(
                        symbol=symbol.upper().strip(),
                        price=round(float(current_price), 2),
                        open=round(float(day_open), 2),
                        high=round(float(day_high), 2),
                        low=round(float(day_low), 2),
                        close=round(float(prev_close), 2),
                        change=change,
                        change_percent=change_pct,
                        volume=int(volume) if volume else 0,
                        timestamp=datetime.now(timezone.utc),
                        source="LIVE",
                    )
                    self._cache[symbol.upper().strip()] = tick
                    return tick
        except Exception as e:
            logger.debug(f"Error fetching live quote for {symbol} ({ticker}): {e}")
        return self._cache.get(symbol.upper().strip())

    async def get_quote(self, symbol: str) -> Optional[MarketTick]:
        sym = symbol.upper().strip()
        cached = self._cache.get(sym)
        # Refresh if not present or older than 3 seconds
        if not cached or (datetime.now(timezone.utc) - cached.timestamp).total_seconds() > 3:
            tick = await self._fetch_live_ticker_data(sym)
            if tick:
                return tick
        return cached

    async def stream_ticks(self) -> AsyncGenerator[MarketTick, None]:
        """Stream real-time ticks concurrently from live market feed."""
        while self._running:
            symbols = list(self._subscribed_symbols)
            if symbols:
                # Concurrent parallel asynchronous fetch for all subscribed symbols
                tasks = [self._fetch_live_ticker_data(sym) for sym in symbols]
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for tick in results:
                    if isinstance(tick, MarketTick):
                        yield tick
            await asyncio.sleep(max(1.0, settings.TICK_INTERVAL_SECONDS))

    async def get_historical_ohlcv(
        self,
        symbol: str,
        timeframe: str = "1D",
        limit: int = 100,
    ) -> List[OHLCVBar]:
        ticker = to_live_ticker(symbol)
        tf = (timeframe or "1D").upper().strip()
        
        # Determine interval and range
        if tf in ("1D", "D", "DAILY"):
            interval = "1d"
            y_range = f"{max(30, limit * 2)}d"
        elif tf in ("1H", "H", "60M", "HOURLY"):
            interval = "1h"
            y_range = "1mo"
        elif tf in ("15M", "15", "15MIN"):
            interval = "15m"
            y_range = "5d"
        elif tf in ("5M", "5", "5MIN"):
            interval = "5m"
            y_range = "5d"
        else:
            interval = "1d"
            y_range = "3mo"

        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval={interval}&range={y_range}"
        bars: List[OHLCVBar] = []
        try:
            if not self._http_client or self._http_client.is_closed:
                self._http_client = httpx.AsyncClient(
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
                    timeout=10.0,
                )
            res = await self._http_client.get(url)
            if res.status_code == 200:
                result = res.json().get("chart", {}).get("result", [{}])[0]
                timestamps = result.get("timestamp", [])
                indicators = result.get("indicators", {}).get("quote", [{}])[0]
                opens = indicators.get("open", [])
                highs = indicators.get("high", [])
                lows = indicators.get("low", [])
                closes = indicators.get("close", [])
                volumes = indicators.get("volume", [])

                for i in range(len(timestamps)):
                    if closes[i] is not None and opens[i] is not None:
                        bars.append(
                            OHLCVBar(
                                time=int(timestamps[i]),
                                open=round(float(opens[i]), 2),
                                high=round(float(highs[i] or opens[i]), 2),
                                low=round(float(lows[i] or opens[i]), 2),
                                close=round(float(closes[i]), 2),
                                volume=float(volumes[i] or 0),
                            )
                        )
                if len(bars) > limit:
                    bars = bars[-limit:]
        except Exception as e:
            logger.warning(f"Error fetching live historical data for {symbol}: {e}")

        return bars

    def get_market_status(self) -> MarketStatus:
        return get_indian_market_status()
