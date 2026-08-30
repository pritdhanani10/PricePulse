from datetime import datetime, timezone, timedelta
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.schemas.market import MarketTick
from app.strategies.candle_three_percent_strategy import CandleThreePercentStrategy
from app.strategies.models import CandleModel, StrategyConfig
from app.services.strategy_service import strategy_service
from app.services.backtest_engine import backtest_engine, BacktestRequest


def test_strategy_calculations():
    strategy = CandleThreePercentStrategy(
        config=StrategyConfig(
            timeframe="5m",
            buy_from="LOW",
            buy_percent=3.0,
            sell_from="HIGH",
            sell_percent=3.0,
        )
    )

    # 1. Buy Trigger: Low = ₹100 -> Buy Trigger = ₹103.00
    buy_trigger = strategy.calculate_buy_trigger(100.0)
    assert buy_trigger == 103.00

    # 2. Sell Trigger: High = ₹100 -> Sell Trigger = ₹97.00
    sell_trigger = strategy.calculate_sell_trigger(100.0)
    assert sell_trigger == 97.00

    # 3. Tejas Networks test: Low = ₹1000, High = ₹1050
    # Buy Trigger = 1000 * 1.03 = 1030
    # Sell Trigger = 1050 * 0.97 = 1018.50
    assert strategy.calculate_buy_trigger(1000.0) == 1030.00
    assert strategy.calculate_sell_trigger(1050.0) == 1018.50


def test_candle_evaluation_trigger_creation():
    strategy = CandleThreePercentStrategy()
    start = datetime.now(timezone.utc)
    end = start + timedelta(minutes=5)

    # Completed candle
    candle = CandleModel(
        symbol="TEJASNET",
        timeframe="5m",
        open=1000.0,
        high=1050.0,
        low=1000.0,
        close=1035.0,
        volume=50000.0,
        candle_start_time=start,
        candle_end_time=end,
        is_finalized=True,
    )

    triggers = strategy.evaluate_candle(candle)
    assert len(triggers) == 2

    buy_trig = next(t for t in triggers if t.signal_type == "BUY")
    sell_trig = next(t for t in triggers if t.signal_type == "SELL")

    assert buy_trig.symbol == "TEJASNET"
    assert buy_trig.reference_price == 1000.0
    assert buy_trig.trigger_price == 1030.00

    assert sell_trig.symbol == "TEJASNET"
    assert sell_trig.reference_price == 1050.0
    assert sell_trig.trigger_price == 1018.50


def test_unfinalized_candle_ignored():
    strategy = CandleThreePercentStrategy()
    start = datetime.now(timezone.utc)
    end = start + timedelta(minutes=5)

    unfinalized = CandleModel(
        symbol="TEJASNET",
        timeframe="5m",
        open=1000.0,
        high=1050.0,
        low=1000.0,
        close=1035.0,
        candle_start_time=start,
        candle_end_time=end,
        is_finalized=False,
    )
    assert len(strategy.evaluate_candle(unfinalized)) == 0


@pytest.mark.asyncio
async def test_indexes_api():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/indexes")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 3
        categories = [idx["category"] for idx in data]
        assert "MIDCAP" in categories
        assert "SMALLCAP" in categories
        assert "MICROCAP" in categories

        # Check category endpoint
        smallcap_res = await client.get("/api/indexes/category/SMALLCAP")
        assert smallcap_res.status_code == 200
        sc_data = smallcap_res.json()
        assert sc_data["category"] == "SMALLCAP"
        symbols = [c["symbol"] for c in sc_data["constituents"]]
        assert "TEJASNET" in symbols


@pytest.mark.asyncio
async def test_strategy_endpoints_and_backtest():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Check config
        config_res = await client.get("/api/strategy/config")
        assert config_res.status_code == 200
        assert config_res.json()["config"]["buy_percent"] == 3.0

        # 2. Check 5m candles endpoint
        candles_res = await client.get("/api/strategy/candles/TEJASNET?limit=20")
        assert candles_res.status_code == 200
        c_data = candles_res.json()
        assert c_data["symbol"] == "TEJASNET"
        assert c_data["timeframe"] == "5m"

        # 3. Check backtest endpoint
        backtest_req = {
            "symbol": "TEJASNET",
            "timeframe": "5m",
            "buy_percent": 3.0,
            "sell_percent": 3.0,
            "candle_limit": 50,
        }
        bt_res = await client.post("/api/strategy/backtest", json=backtest_req)
        assert bt_res.status_code == 200
        bt_data = bt_res.json()
        assert bt_data["symbol"] == "TEJASNET"
        assert "disclaimer" in bt_data
        assert "total_signals" in bt_data
