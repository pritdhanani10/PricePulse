import pytest
import pytest_asyncio
from datetime import datetime, timezone
from app.services.trigger_engine import TriggerEngine
from app.schemas.market import MarketTick
from app.models.instrument import Instrument
from app.models.alert import Alert
from app.models.user import User
from app.models.base import Base
from app.core.database import AsyncSessionLocal, engine


@pytest_asyncio.fixture(autouse=True)
async def init_schema():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


def test_target_price_calculations():
    # Target UP: 25,000 + 3% = 25,750
    up_target = TriggerEngine.calculate_target_price(reference_price=25000.0, direction="UP", threshold_percent=3.0)
    assert up_target == 25750.0

    # Target DOWN: 25,000 - 2% = 24,500
    down_target = TriggerEngine.calculate_target_price(reference_price=25000.0, direction="DOWN", threshold_percent=2.0)
    assert down_target == 24500.0


import uuid

@pytest.mark.asyncio
async def test_trigger_engine_evaluation():
    engine_svc = TriggerEngine()
    test_id = uuid.uuid4().hex[:8].upper()
    test_symbol = f"TEST_NIFTY_{test_id}"

    # 1. Setup instrument, user, and alert in DB
    async with AsyncSessionLocal() as session:
        user = User(
            name="Test Trader",
            email=f"trader_{test_id.lower()}@stockmarket.in",
            password_hash="fakehash",
        )
        session.add(user)
        await session.flush()

        instrument = Instrument(
            symbol=test_symbol,
            name="Test Nifty Index",
            exchange="NSE",
            instrument_type="INDEX",
            base_price=25000.0,
        )
        session.add(instrument)
        await session.flush()

        # Create UP Alert: Target = 25,750
        up_alert = Alert(
            user_id=user.id,
            instrument_id=instrument.id,
            alert_type="PERCENTAGE",
            reference_type="CURRENT_PRICE",
            reference_price=25000.0,
            direction="UP",
            threshold_percent=3.0,
            target_price=25750.0,
            status="ACTIVE",
        )
        session.add(up_alert)
        await session.commit()
        up_alert_id = up_alert.id

    # 2. Tick below target: 25,500 -> Should NOT trigger
    tick_no_trigger = MarketTick(
        symbol=test_symbol,
        price=25500.0,
        open=25000.0,
        high=25500.0,
        low=25000.0,
        close=25500.0,
        change=500.0,
        change_percent=2.0,
        timestamp=datetime.now(timezone.utc),
    )
    result = await engine_svc.evaluate_tick(tick_no_trigger)
    assert len(result) == 0

    # 3. Tick crossing target: 25,760 -> SHOULD trigger exactly once
    tick_trigger = MarketTick(
        symbol=test_symbol,
        price=25760.0,
        open=25000.0,
        high=25760.0,
        low=25000.0,
        close=25760.0,
        change=760.0,
        change_percent=3.04,
        timestamp=datetime.now(timezone.utc),
    )
    triggered = await engine_svc.evaluate_tick(tick_trigger)
    assert len(triggered) == 1
    assert triggered[0].alert_id == up_alert_id
    assert triggered[0].trigger_price == 25760.0
    assert triggered[0].direction == "UP"

    # 4. Subsequent tick at 25,800 -> Should NOT trigger again (idempotent / duplicate prevention)
    subsequent_tick = MarketTick(
        symbol=test_symbol,
        price=25800.0,
        open=25000.0,
        high=25800.0,
        low=25000.0,
        close=25800.0,
        change=800.0,
        change_percent=3.2,
        timestamp=datetime.now(timezone.utc),
    )
    subsequent_res = await engine_svc.evaluate_tick(subsequent_tick)
    assert len(subsequent_res) == 0


@pytest.mark.asyncio
async def test_notification_service_integration():
    from app.services.notification_service import notification_service

    test_alert = Alert(
        user_id="test_user_1",
        instrument_id="inst_1",
        alert_type="PERCENTAGE",
        reference_type="CURRENT_PRICE",
        reference_price=1000.0,
        direction="UP",
        threshold_percent=5.0,
        target_price=1050.0,
        status="ACTIVE",
        triggered_at=datetime.now(timezone.utc),
    )

    success = await notification_service.send_alert_notification(
        alert=test_alert,
        current_price=1052.50,
        channel="IN_APP",
    )
    assert success is True
