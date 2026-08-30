import pytest
from app.services.analysis_service import analysis_service
from app.schemas.market import OHLCVBar


def test_technical_indicators_calculation():
    # Build 30 test candle bars with increasing prices
    base_time = 1700000000
    candles = [
        OHLCVBar(
            time=base_time + (i * 86400),
            open=100.0 + i,
            high=102.0 + i,
            low=99.0 + i,
            close=101.0 + i,
            volume=1000.0 * (i + 1),
        )
        for i in range(40)
    ]

    result = analysis_service.compute_all_indicators(
        symbol="NIFTY50",
        candles=candles,
        timeframe="1D",
    )

    assert result.symbol == "NIFTY50"
    assert len(result.candles) == 40
    assert "SMA_20" in result.indicators
    assert "EMA_20" in result.indicators
    assert "RSI_14" in result.indicators
    assert "MACD" in result.indicators
    assert "BB_20_2" in result.indicators
    assert "VWAP" in result.indicators
    assert "ATR_14" in result.indicators

    # With strictly ascending closes, RSI must be high (> 70)
    last_rsi = result.indicators["RSI_14"][-1]["value"]
    assert last_rsi is not None
    assert last_rsi > 70.0

    # Verify Bollinger Bands ordering (Upper >= Middle >= Lower)
    last_bb = result.indicators["BB_20_2"][-1]
    assert last_bb["upper"] >= last_bb["middle"]
    assert last_bb["middle"] >= last_bb["lower"]


@pytest.mark.asyncio
async def test_market_news_and_macro_indicators():
    from httpx import AsyncClient, ASGITransport
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Market news endpoint
        news_res = await client.get("/api/analysis/market/news?limit=3")
        assert news_res.status_code == 200
        news = news_res.json()
        assert len(news) > 0
        assert "title" in news[0]
        assert news[0]["sentiment"] in ("BULLISH", "BEARISH", "NEUTRAL")

        # 2. Stock specific news endpoint
        stock_news_res = await client.get("/api/analysis/RELIANCE/news?limit=2")
        assert stock_news_res.status_code == 200
        assert len(stock_news_res.json()) > 0

        # 3. Macro indicators endpoint
        macro_res = await client.get("/api/analysis/market/macro")
        assert macro_res.status_code == 200
        macro = macro_res.json()
        assert "usdinr" in macro
        assert "crude_oil" in macro
        assert "gold" in macro
        assert macro["usdinr"]["value"] > 0
        assert macro["gold"]["value"] > 0
