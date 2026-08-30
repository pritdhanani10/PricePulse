import ssl
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.core.config import settings


def get_normalized_database_url_and_args():
    raw_url = settings.DATABASE_URL.strip()
    
    # Auto-convert standard postgres:// and postgresql:// to postgresql+asyncpg://
    if raw_url.startswith("postgres://"):
        normalized_url = "postgresql+asyncpg://" + raw_url[len("postgres://"):]
    elif raw_url.startswith("postgresql://") and not raw_url.startswith("postgresql+"):
        normalized_url = "postgresql+asyncpg://" + raw_url[len("postgresql://"):]
    else:
        normalized_url = raw_url

    connect_args = {}
    engine_kwargs = {
        "echo": False,
        "future": True,
    }

    if "sqlite" in normalized_url:
        connect_args["check_same_thread"] = False
    elif "postgresql" in normalized_url or "asyncpg" in normalized_url:
        # Supabase and PgBouncer SSL and connection tuning
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        connect_args["ssl"] = ctx
        connect_args["statement_cache_size"] = 0
        engine_kwargs["pool_pre_ping"] = True
        engine_kwargs["pool_recycle"] = 300

    engine_kwargs["connect_args"] = connect_args
    return normalized_url, engine_kwargs


_db_url, _engine_kwargs = get_normalized_database_url_and_args()

engine = create_async_engine(
    _db_url,
    **_engine_kwargs,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that yields an async database session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
