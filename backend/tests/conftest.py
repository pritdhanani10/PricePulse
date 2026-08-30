import os
import pytest
import pytest_asyncio
from app.models.base import Base
from app.core.database import engine, AsyncSessionLocal

@pytest_asyncio.fixture(autouse=True)
async def init_test_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
