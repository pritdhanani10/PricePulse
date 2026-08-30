from abc import ABC, abstractmethod
from datetime import datetime
from typing import AsyncGenerator, Dict, List, Optional
from app.schemas.market import MarketTick, OHLCVBar, MarketStatus


class MarketDataProvider(ABC):
    """Abstract interface for all Market Data Providers (Mock, Zerodha Kite, Angel One, Upstox, Dhan)."""

    @abstractmethod
    async def connect(self) -> None:
        """Initialize connection or websocket session with market data provider."""
        pass

    @abstractmethod
    async def disconnect(self) -> None:
        """Safely terminate provider connection."""
        pass

    @abstractmethod
    async def subscribe(self, symbols: List[str]) -> None:
        """Subscribe to live tick stream for the given list of symbols."""
        pass

    @abstractmethod
    async def unsubscribe(self, symbols: List[str]) -> None:
        """Unsubscribe from the given list of symbols."""
        pass

    @abstractmethod
    async def get_latest_price(self, symbol: str) -> Optional[float]:
        """Fetch the most recent traded price for a symbol."""
        pass

    @abstractmethod
    async def get_quote(self, symbol: str) -> Optional[MarketTick]:
        """Fetch full snapshot quote (OHLC, LTP, change, volume) for a symbol."""
        pass

    @abstractmethod
    async def get_historical_ohlcv(
        self,
        symbol: str,
        timeframe: str = "1D",
        limit: int = 100,
    ) -> List[OHLCVBar]:
        """Fetch historical candlestick bars for technical analysis."""
        pass

    @abstractmethod
    def stream_ticks(self) -> AsyncGenerator[MarketTick, None]:
        """Asynchronous stream of normalized MarketTick events."""
        pass

    @abstractmethod
    def get_market_status(self) -> MarketStatus:
        """Check whether the Indian Stock Market (NSE/BSE) is currently in open trading hours."""
        pass
