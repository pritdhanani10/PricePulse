from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.instrument import Instrument
from app.schemas.instrument import InstrumentCreate, InstrumentQuote, InstrumentResponse
from app.schemas.market import MarketStatus, OHLCVBar
from app.services.market_data.factory import get_market_data_provider
from app.core.constants import DEFAULT_MARKET_INSTRUMENTS

router = APIRouter(prefix="/instruments", tags=["Instruments"])


@router.get("", response_model=List[InstrumentResponse])
async def list_instruments(
    instrument_type: Optional[str] = Query(None, description="Filter by 'INDEX' or 'EQUITY'"),
    search: Optional[str] = Query(None, description="Search by symbol or name"),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all available tradeable instruments (Indices and Equities)."""
    stmt = select(Instrument).where(Instrument.is_active == True)
    if instrument_type:
        stmt = stmt.where(Instrument.instrument_type == instrument_type.upper().strip())
    if search:
        search_pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            (Instrument.symbol.ilike(search_pattern)) | (Instrument.name.ilike(search_pattern))
        )
    stmt = stmt.order_by(Instrument.instrument_type, Instrument.symbol)
    result = await db.execute(stmt)
    instruments = result.scalars().all()
    return instruments


@router.post("", response_model=InstrumentResponse, status_code=status.HTTP_201_CREATED)
async def create_instrument(
    instrument_in: InstrumentCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create and register a new tradeable instrument."""
    sym = instrument_in.symbol.upper().strip()
    stmt = select(Instrument).where(Instrument.symbol == sym)
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Instrument with symbol '{sym}' already exists",
        )

    inst = Instrument(
        symbol=sym,
        name=instrument_in.name.strip(),
        exchange=instrument_in.exchange.upper().strip(),
        instrument_type=instrument_in.instrument_type.upper().strip(),
        base_price=instrument_in.base_price,
        tick_size=instrument_in.tick_size,
        lot_size=int(instrument_in.lot_size),
        is_active=True,
    )
    db.add(inst)
    await db.commit()
    await db.refresh(inst)

    # Register symbol with live provider
    provider = get_market_data_provider()
    await provider.subscribe([sym])
    return inst


@router.get("/market/status", response_model=MarketStatus)
async def get_market_status():
    """Check current Indian Market (NSE/BSE) trading session status and hours."""
    provider = get_market_data_provider()
    return provider.get_market_status()



@router.get("/quotes", response_model=List[InstrumentQuote])
async def get_all_quotes(
    db: AsyncSession = Depends(get_db),
):
    """Fetch live quotes for all active instruments."""
    stmt = select(Instrument).where(Instrument.is_active == True)
    result = await db.execute(stmt)
    instruments = result.scalars().all()

    provider = get_market_data_provider()
    quotes = []
    for inst in instruments:
        quote = await provider.get_quote(inst.symbol)
        if quote:
            quotes.append(
                InstrumentQuote(
                    symbol=inst.symbol,
                    name=inst.name,
                    exchange=inst.exchange,
                    instrument_type=inst.instrument_type,
                    price=quote.price,
                    open=quote.open,
                    high=quote.high,
                    low=quote.low,
                    close=quote.close,
                    change=quote.change,
                    change_percent=quote.change_percent,
                    volume=quote.volume or 0,
                    timestamp=quote.timestamp,
                )
            )
        else:
            # Fallback quote guarantee
            quotes.append(
                InstrumentQuote(
                    symbol=inst.symbol,
                    name=inst.name,
                    exchange=inst.exchange,
                    instrument_type=inst.instrument_type,
                    price=inst.base_price,
                    open=inst.base_price,
                    high=inst.base_price,
                    low=inst.base_price,
                    close=inst.base_price,
                    change=0.0,
                    change_percent=0.0,
                    volume=0,
                    timestamp=datetime.now(timezone.utc),
                )
            )
    return quotes


@router.get("/{symbol}", response_model=InstrumentResponse)
async def get_instrument(
    symbol: str,
    db: AsyncSession = Depends(get_db),
):
    """Fetch instrument details by symbol."""
    stmt = select(Instrument).where(Instrument.symbol == symbol.upper().strip())
    result = await db.execute(stmt)
    instrument = result.scalar_one_or_none()
    if not instrument:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Instrument '{symbol}' not found",
        )
    return instrument


@router.get("/{symbol}/price", response_model=InstrumentQuote)
async def get_instrument_price(
    symbol: str,
    db: AsyncSession = Depends(get_db),
):
    """Fetch real-time snapshot quote for a specific instrument."""
    sym = symbol.upper().strip()
    stmt = select(Instrument).where(Instrument.symbol == sym)
    result = await db.execute(stmt)
    instrument = result.scalar_one_or_none()
    if not instrument:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Instrument '{symbol}' not found",
        )

    provider = get_market_data_provider()
    quote = await provider.get_quote(sym)
    if not quote:
        # Construct fallback quote from instrument record
        quote_price = instrument.base_price
        return InstrumentQuote(
            symbol=instrument.symbol,
            name=instrument.name,
            exchange=instrument.exchange,
            instrument_type=instrument.instrument_type,
            price=quote_price,
            open=quote_price,
            high=quote_price,
            low=quote_price,
            close=quote_price,
            change=0.0,
            change_percent=0.0,
            volume=0,
            timestamp=datetime.now(timezone.utc),
        )

    return InstrumentQuote(
        symbol=instrument.symbol,
        name=instrument.name,
        exchange=instrument.exchange,
        instrument_type=instrument.instrument_type,
        price=quote.price,
        open=quote.open,
        high=quote.high,
        low=quote.low,
        close=quote.close,
        change=quote.change,
        change_percent=quote.change_percent,
        volume=quote.volume or 0,
        timestamp=quote.timestamp,
    )


@router.get("/{symbol}/history", response_model=List[OHLCVBar])
async def get_instrument_history(
    symbol: str,
    timeframe: str = Query("1D", description="'1D', '1H', '15m', or '5m'"),
    limit: int = Query(100, ge=10, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Fetch historical OHLCV candlestick series."""
    sym = symbol.upper().strip()
    stmt = select(Instrument).where(Instrument.symbol == sym)
    result = await db.execute(stmt)
    instrument = result.scalar_one_or_none()
    if not instrument:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Instrument '{symbol}' not found",
        )

    provider = get_market_data_provider()
    candles = await provider.get_historical_ohlcv(symbol=sym, timeframe=timeframe, limit=limit)
    return candles


@router.post("/seed", status_code=status.HTTP_200_OK)
async def seed_default_instruments(
    db: AsyncSession = Depends(get_db),
):
    """Seed default Indian market indices (NIFTY 50, BANK NIFTY, FIN NIFTY) and top NSE equities."""
    seeded_count = 0
    symbols_to_subscribe = []
    for symbol, data in DEFAULT_MARKET_INSTRUMENTS.items():
        stmt = select(Instrument).where(Instrument.symbol == symbol)
        existing = (await db.execute(stmt)).scalar_one_or_none()
        symbols_to_subscribe.append(symbol)
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
            db.add(inst)
            seeded_count += 1
    await db.commit()

    provider = get_market_data_provider()
    await provider.subscribe(symbols_to_subscribe)
    return {"message": f"Successfully seeded {seeded_count} instruments into database."}
