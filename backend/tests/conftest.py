import os
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
import app.core.database as db_module
from app.models.base import Base

TEST_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_temp.db"))
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"

# Rebind app.core.database engine and sessionmaker to test DB
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    future=True,
    connect_args={"check_same_thread": False},
)
TestAsyncSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

db_module.engine = test_engine
db_module.AsyncSessionLocal = TestAsyncSessionLocal

@pytest_asyncio.fixture(autouse=True)
async def init_test_database():
    from app.main import init_db
    await init_db()
    yield
    async with db_module.engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_db(request):
    def remove_test_file():
        if os.path.exists(TEST_DB_FILE):
            try:
                os.remove(TEST_DB_FILE)
            except Exception:
                pass
    request.addfinalizer(remove_test_file)
