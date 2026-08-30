from app.core.config import settings
from app.services.market_data.base import MarketDataProvider
from app.services.market_data.mock_provider import MockMarketDataProvider
from app.services.market_data.live_provider import LiveMarketDataProvider

_provider_instance: MarketDataProvider = None


def get_market_data_provider() -> MarketDataProvider:
    """Singleton factory returning the configured MarketDataProvider."""
    global _provider_instance
    if _provider_instance is None:
        provider_name = settings.MARKET_DATA_PROVIDER.lower().strip()
        if provider_name in ("live", "yfinance", "yahoo", "real"):
            _provider_instance = LiveMarketDataProvider()
        else:
            _provider_instance = MockMarketDataProvider()
    return _provider_instance
