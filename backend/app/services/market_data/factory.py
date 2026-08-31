from app.services.market_data.base import MarketDataProvider
from app.services.market_data.live_provider import LiveMarketDataProvider

_provider_instance: MarketDataProvider = None


def get_market_data_provider() -> MarketDataProvider:
    """Singleton factory returning the live MarketDataProvider."""
    global _provider_instance
    if _provider_instance is None:
        _provider_instance = LiveMarketDataProvider()
    return _provider_instance

