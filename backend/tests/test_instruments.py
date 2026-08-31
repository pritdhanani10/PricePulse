import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.config import Settings


def test_config_cors_origins_parsing():
    # Test list input
    s1 = Settings(BACKEND_CORS_ORIGINS=["http://localhost:3000", "http://example.com"])
    assert "http://localhost:3000" in s1.BACKEND_CORS_ORIGINS

    # Test comma-separated string input
    s2 = Settings(BACKEND_CORS_ORIGINS="http://localhost:3000, http://127.0.0.1:3000")
    assert len(s2.BACKEND_CORS_ORIGINS) == 2
    assert "http://127.0.0.1:3000" in s2.BACKEND_CORS_ORIGINS


@pytest.mark.asyncio
async def test_live_provider_and_market_hours():
    from app.services.market_data.live_provider import LiveMarketDataProvider
    from app.services.market_data.market_hours import get_indian_market_status

    status = get_indian_market_status()
    assert status.session in ("REGULAR", "PRE_OPEN", "CLOSED")
    assert "IST" in status.market_time

    live_prov = LiveMarketDataProvider()
    await live_prov.connect()
    quote = await live_prov.get_quote("NIFTY50")
    if quote:
        assert quote.symbol == "NIFTY50"
        assert quote.price > 0
    await live_prov.disconnect()


@pytest.mark.asyncio
async def test_instruments_api_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Seed instruments
        seed_res = await client.post("/api/instruments/seed")
        assert seed_res.status_code == 200

        # 2. List instruments
        list_res = await client.get("/api/instruments")
        assert list_res.status_code == 200
        instruments = list_res.json()
        assert len(instruments) >= 12

        # 3. Filter by type
        index_res = await client.get("/api/instruments?instrument_type=INDEX")
        assert index_res.status_code == 200
        assert all(i["instrument_type"] == "INDEX" for i in index_res.json())

        # 4. Search
        search_res = await client.get("/api/instruments?search=tata")
        assert search_res.status_code == 200
        symbols = [i["symbol"] for i in search_res.json()]
        assert "TCS" in symbols or "TATAMOTORS" in symbols

        # 5. Create new instrument
        import uuid
        test_sym = f"STOCK_{uuid.uuid4().hex[:6].upper()}"
        create_res = await client.post(
            "/api/instruments",
            json={
                "symbol": test_sym,
                "name": "Test Production Stock Ltd",
                "exchange": "NSE",
                "instrument_type": "EQUITY",
                "base_price": 250.0,
                "tick_size": 0.05,
                "lot_size": 1,
            },
        )
        assert create_res.status_code == 201
        assert create_res.json()["symbol"] == test_sym

        # 6. Fetch live quote for new instrument
        price_res = await client.get(f"/api/instruments/{test_sym}/price")
        assert price_res.status_code == 200
        assert price_res.json()["symbol"] == test_sym
        assert price_res.json()["price"] > 0

        # 7. Fetch quotes for all instruments
        quotes_res = await client.get("/api/instruments/quotes")
        assert quotes_res.status_code == 200
        assert len(quotes_res.json()) >= len(instruments) + 1

        # 8. Check market status
        m_status_res = await client.get("/api/instruments/market/status")
        assert m_status_res.status_code == 200

