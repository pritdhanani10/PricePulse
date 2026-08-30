import os
from contextlib import asynccontextmanager
import json
import logging
from typing import Optional
from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.api.alerts import router as alerts_router
from app.api.analysis import router as analysis_router
from app.api.auth import router as auth_router
from app.api.instruments import router as instruments_router
from app.api.watchlists import router as watchlists_router
from app.api.indexes import router as indexes_router
from app.api.strategy import router as strategy_router
from app.core.config import settings
from app.core.database import AsyncSessionLocal, engine
from app.core.redis import redis_manager
from app.core.security import decode_access_token
from app.models.base import Base
from app.models.instrument import Instrument
from app.models.index import Index, IndexConstituent, IndexCategory
from app.services.market_data.mock_provider import DEFAULT_MARKET_INSTRUMENTS
from app.services.strategy_service import strategy_service
from app.websocket.manager import ws_manager
from app.workers.market_worker import market_worker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("market_platform")

# Index Category Definitions & Official Constituents
OFFICIAL_INDEXES = {
    IndexCategory.MIDCAP: {
        "symbol": "NIFTY_MIDCAP_100",
        "name": "NIFTY Midcap 100",
        "description": "NIFTY Midcap 100 Index captures the movement of top mid-sized Indian companies.",
        "constituents": ["DIXON", "TATAELXSI", "POLYCAB", "PERSISTENT", "COFORGE", "MPHASIS", "FEDERALBNK", "ASTRAL", "VOLTAS", "ASHOKLEY"],
    },
    IndexCategory.SMALLCAP: {
        "symbol": "NIFTY_SMALLCAP_100",
        "name": "NIFTY Smallcap 100",
        "description": "NIFTY Smallcap 100 Index represents high-growth small-cap enterprises listed on NSE.",
        "constituents": ["TEJASNET", "CDSL", "ANGELONE", "BSE", "CENTURYPLY", "RADICO", "KAYNES", "CYIENT", "CAMS", "SONATSOFTW"],
    },
    IndexCategory.MICROCAP: {
        "symbol": "NIFTY_MICROCAP_250",
        "name": "NIFTY Microcap 250",
        "description": "NIFTY Microcap 250 Index tracks the performance of emerging micro-cap leaders.",
        "constituents": ["MARKSANS", "SUBEX", "INFIBEAM", "DCMSHRIRAM", "RANEHOLDIN", "GEOJITFSL", "SAKSOFT", "NELCO", "HGINFRA", "ORIENTCEM"],
    },
}


async def init_db():
    """Create tables and seed initial Indian Market instruments, indexes, and strategies if not present."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with AsyncSessionLocal() as session:
        # 1. Seed Instruments
        instrument_map = {}
        for symbol, data in DEFAULT_MARKET_INSTRUMENTS.items():
            stmt = select(Instrument).where(Instrument.symbol == symbol)
            existing = (await session.execute(stmt)).scalar_one_or_none()
            if not existing:
                inst = Instrument(
                    symbol=symbol,
                    name=data["name"],
                    exchange="NSE",
                    instrument_type=data["type"],
                    base_price=data["price"],
                    tick_size=0.05,
                    lot_size=1 if data["type"] == "EQUITY" else (50 if symbol == "NIFTY50" else 15),
                    is_active=True,
                )
                session.add(inst)
                instrument_map[symbol] = inst
            else:
                instrument_map[symbol] = existing
        await session.commit()

        # 2. Seed Official Index Categories
        for cat, idx_info in OFFICIAL_INDEXES.items():
            stmt = select(Index).where(Index.category == cat)
            existing_idx = (await session.execute(stmt)).scalar_one_or_none()
            if not existing_idx:
                existing_idx = Index(
                    symbol=idx_info["symbol"],
                    name=idx_info["name"],
                    category=cat,
                    exchange="NSE",
                    description=idx_info["description"],
                    is_active=True,
                )
                session.add(existing_idx)
                await session.flush()

            # Seed constituents for this index
            for sym in idx_info["constituents"]:
                inst_stmt = select(Instrument).where(Instrument.symbol == sym)
                inst_obj = (await session.execute(inst_stmt)).scalar_one_or_none()
                if inst_obj:
                    # Check if already in index_constituents
                    c_stmt = select(IndexConstituent).where(
                        (IndexConstituent.index_id == existing_idx.id) &
                        (IndexConstituent.instrument_id == inst_obj.id)
                    )
                    existing_const = (await session.execute(c_stmt)).scalar_one_or_none()
                    if not existing_const:
                        c_entry = IndexConstituent(
                            index_id=existing_idx.id,
                            instrument_id=inst_obj.id,
                            weightage=round(100.0 / len(idx_info["constituents"]), 2),
                            is_active=True,
                        )
                        session.add(c_entry)

        await session.commit()
        
        # 3. Seed default Strategy
        await strategy_service.ensure_strategy_seeded()

    logger.info("✅ Database initialized and seeded with Indian market instruments, index categories & strategy.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing Market Alert & Analysis Platform...")
    await init_db()
    await redis_manager.connect()
    if not os.getenv("TESTING"):
        await market_worker.start()
    yield
    # Shutdown
    logger.info("Shutting down platform...")
    if not os.getenv("TESTING"):
        await market_worker.stop()
    await redis_manager.disconnect()
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Real-Time Indian Stock Market Alert & Analysis Platform API",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For flexible local development & staging
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount REST API Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(instruments_router, prefix=settings.API_V1_STR)
app.include_router(alerts_router, prefix=settings.API_V1_STR)
app.include_router(watchlists_router, prefix=settings.API_V1_STR)
app.include_router(analysis_router, prefix=settings.API_V1_STR)
app.include_router(indexes_router, prefix=settings.API_V1_STR)
app.include_router(strategy_router, prefix=settings.API_V1_STR)



@app.get("/")
async def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs_url": "/docs",
    }


@app.websocket("/ws/market")
async def websocket_market_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    """
    Bidirectional WebSocket endpoint for live market ticks and trigger alerts.
    Clients can send JSON commands:
      {"action": "subscribe", "symbols": ["NIFTY50", "RELIANCE"]}
      {"action": "unsubscribe", "symbols": ["TCS"]}
      {"action": "ping"}
    """
    user_id = None
    if token:
        payload = decode_access_token(token)
        if payload:
            user_id = payload.get("sub")

    await ws_manager.connect(websocket, user_id=user_id)
    try:
        while True:
            text = await websocket.receive_text()
            try:
                msg = json.loads(text)
                action = msg.get("action", "").lower()
                
                if action == "subscribe":
                    symbols = msg.get("symbols", [])
                    await ws_manager.subscribe(websocket, symbols)
                    await websocket.send_text(json.dumps({"type": "SUBSCRIBED", "symbols": symbols}))
                
                elif action == "unsubscribe":
                    symbols = msg.get("symbols", [])
                    await ws_manager.unsubscribe(websocket, symbols)
                    await websocket.send_text(json.dumps({"type": "UNSUBSCRIBED", "symbols": symbols}))
                
                elif action == "ping":
                    await websocket.send_text(json.dumps({"type": "PONG"}))
            
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket client error: {e}")
        await ws_manager.disconnect(websocket)
