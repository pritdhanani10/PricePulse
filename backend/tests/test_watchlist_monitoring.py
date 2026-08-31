from datetime import datetime, timezone
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.schemas.market import MarketTick
from app.strategies.models import CandleModel
from app.services.strategy_service import strategy_service
from app.services.notification_service import notification_service


@pytest.mark.asyncio
async def test_watchlist_crud_and_auto_monitoring():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Register test user
        reg_res = await client.post(
            "/api/auth/register",
            json={"name": "Watchlist Trader", "email": "trader@marketpulse.in", "password": "SecurePassword123!"},
        )
        assert reg_res.status_code == 201
        token = reg_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Create custom watchlist
        create_res = await client.post(
            "/api/watchlists",
            json={"name": "Alpha Momentum Basket"},
            headers=headers,
        )
        assert create_res.status_code == 201
        wl = create_res.json()
        wl_id = wl["id"]
        assert wl["name"] == "Alpha Momentum Basket"

        # 3. Add Instrument with auto_monitor=True
        add_res = await client.post(
            f"/api/watchlists/{wl_id}/items",
            json={
                "instrument_id": "RELIANCE",
                "auto_monitor": True,
                "buy_percent": 3.0,
                "sell_percent": 3.0,
            },
            headers=headers,
        )
        assert add_res.status_code == 200
        updated_wl = add_res.json()
        assert len(updated_wl["items"]) == 1
        item = updated_wl["items"][0]
        assert item["instrument"]["symbol"] == "RELIANCE"
        assert item["auto_monitor"] is True
        item_id = item["id"]

        # 4. Patch/Update item auto_monitor toggle
        patch_res = await client.patch(
            f"/api/watchlists/{wl_id}/items/{item_id}",
            json={"auto_monitor": False, "buy_percent": 2.5},
            headers=headers,
        )
        assert patch_res.status_code == 200
        patched_wl = patch_res.json()
        assert patched_wl["items"][0]["auto_monitor"] is False
        assert patched_wl["items"][0]["buy_percent"] == 2.5

        # Re-enable auto_monitor
        patch_res2 = await client.patch(
            f"/api/watchlists/{wl_id}/items/{item_id}",
            json={"auto_monitor": True},
            headers=headers,
        )
        assert patch_res2.status_code == 200
        assert patch_res2.json()["items"][0]["auto_monitor"] is True

        # 5. Fetch Auto Monitor Summary
        summary_res = await client.get("/api/watchlists/auto-monitor/summary", headers=headers)
        assert summary_res.status_code == 200
        summary = summary_res.json()
        assert len(summary) >= 1
        assert summary[0]["symbol"] == "RELIANCE"
        assert summary[0]["auto_monitor"] is True

        # 6. Simulate 5m candle completion & trigger calculation for RELIANCE
        now = datetime.now(timezone.utc)
        test_candle = CandleModel(
            symbol="RELIANCE",
            timeframe="5m",
            open=3000.0,
            high=3020.0,
            low=2980.0,
            close=3010.0,
            volume=50000.0,
            candle_start_time=now,
            candle_end_time=now,
            is_finalized=True,
        )
        triggers = await strategy_service.handle_candle_completed(test_candle)
        assert len(triggers) == 2
        buy_trig = next(t for t in triggers if t.signal_type == "BUY")
        assert buy_trig.trigger_price == 3069.4  # 2980 * 1.03

        # 7. Evaluate a live price tick hitting BUY trigger
        hit_tick = MarketTick(
            symbol="RELIANCE",
            price=3070.0,
            open=3000.0,
            high=3070.0,
            low=2980.0,
            close=3070.0,
            change=70.0,
            change_percent=2.33,
            volume=60000,
            timestamp=now,
            source="LIVE",
        )
        signals = await strategy_service.evaluate_tick_triggers(hit_tick)
        assert len(signals) >= 1
        assert signals[0].signal_type == "BUY"

        # 8. Query user notifications ledger
        notif_res = await client.get("/api/watchlists/notifications", headers=headers)
        assert notif_res.status_code == 200
        notifs_data = notif_res.json()
        assert notifs_data["total"] >= 1
        assert notifs_data["unread_count"] >= 1
        notif = notifs_data["notifications"][0]
        assert notif["symbol"] == "RELIANCE"
        assert notif["signal_type"] == "BUY"
        assert notif["is_read"] is False
        notif_id = notif["id"]

        # 9. Mark notification as read
        read_res = await client.put(f"/api/watchlists/notifications/{notif_id}/read", headers=headers)
        assert read_res.status_code == 200

        # Check unread count decreased
        notif_res2 = await client.get("/api/watchlists/notifications?unread_only=true", headers=headers)
        assert notif_res2.status_code == 200
        assert notif_res2.json()["total"] == 0

        # 10. Mark all as read endpoint
        read_all_res = await client.post("/api/watchlists/notifications/read-all", headers=headers)
        assert read_all_res.status_code == 200
