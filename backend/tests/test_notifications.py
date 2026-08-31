import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import AsyncSessionLocal
from app.models.notification import UserNotification
from app.models.user import User
from sqlalchemy import select


@pytest.mark.asyncio
async def test_vapid_public_key_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/notifications/vapid-public-key")
        assert response.status_code == 200
        data = response.json()
        assert "public_key" in data
        assert len(data["public_key"]) > 20


@pytest.mark.asyncio
async def test_push_subscription_and_notification_ledger():
    # 1. Register user
    user_payload = {
        "email": "notifyuser@example.com",
        "password": "StrongPassword123!",
        "name": "Notify User",
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        reg_resp = await ac.post("/api/auth/register", json=user_payload)
        if reg_resp.status_code in (200, 201):
            token = reg_resp.json()["access_token"]
        else:
            login_resp = await ac.post("/api/auth/login", json={"email": user_payload["email"], "password": user_payload["password"]})
            token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Register Web Push subscription
        sub_payload = {
            "endpoint": "https://fcm.googleapis.com/fcm/send/test-device-endpoint-12345",
            "keys": {
                "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9EgVKA7Gh27YStRBElCXKLvgQIVBzkHYEgUZ5OtbgFNHz4",
                "auth": "tBHItJI5svbpez7KI4CCXg",
            },
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0",
        }
        sub_resp = await ac.post("/api/notifications/push-subscription", json=sub_payload, headers=headers)
        assert sub_resp.status_code == 201
        sub_data = sub_resp.json()
        assert sub_data["endpoint"] == sub_payload["endpoint"]

        # 3. Create a notification in DB ledger
        async with AsyncSessionLocal() as session:
            user_stmt = select(User).where(User.email == user_payload["email"])
            user_obj = (await session.execute(user_stmt)).scalar_one()
            notif = UserNotification(
                user_id=user_obj.id,
                symbol="RELIANCE",
                notification_type="WATCHLIST_SIGNAL",
                title="Watchlist BUY Signal: RELIANCE",
                message="Breakout detected at target level",
                signal_type="BUY",
                trigger_price=3000.0,
                market_price=3005.0,
                reference_price=2910.0,
                is_read=False,
            )
            session.add(notif)
            await session.commit()
            await session.refresh(notif)
            notif_id = notif.id

        # 4. Check user notifications list
        list_resp = await ac.get("/api/notifications", headers=headers)
        assert list_resp.status_code == 200
        notifs = list_resp.json()
        assert notifs["total"] >= 1

        # 5. Mark notification as read
        read_resp = await ac.put(f"/api/notifications/{notif_id}/read", headers=headers)
        assert read_resp.status_code == 200

        # 6. Mark all as read
        read_all_resp = await ac.post("/api/notifications/read-all", headers=headers)
        assert read_all_resp.status_code == 200

        # 7. Unregister push subscription
        unsub_resp = await ac.delete(f"/api/notifications/push-subscription?endpoint={sub_payload['endpoint']}", headers=headers)
        assert unsub_resp.status_code == 200

