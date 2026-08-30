import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_user_registration_and_login():
    transport = ASGITransport(app=app)
    uid = uuid.uuid4().hex[:8]
    email = f"pritam_{uid}@stockmarket.in"
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Register user
        reg_payload = {
            "name": "Pritam Trader",
            "email": email,
            "password": "SecretPassword123!",
        }
        res = await client.post("/api/auth/register", json=reg_payload)
        assert res.status_code == 201
        data = res.json()
        assert "access_token" in data
        assert data["user"]["email"] == email
        assert data["user"]["name"] == "Pritam Trader"

        # 2. Prevent duplicate email registration
        dup_res = await client.post("/api/auth/register", json=reg_payload)
        assert dup_res.status_code == 400

        # 3. Login with credentials
        login_payload = {
            "email": email,
            "password": "SecretPassword123!",
        }
        login_res = await client.post("/api/auth/login", json=login_payload)
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]

        # 4. Fetch /me profile
        me_res = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_res.status_code == 200
        assert me_res.json()["email"] == email
