from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.index import Index, IndexConstituent, IndexCategory
from app.models.instrument import Instrument
from app.services.market_data.factory import get_market_data_provider

router = APIRouter(prefix="/indexes", tags=["Indexes & Constituents"])


@router.get("", response_model=List[dict])
async def get_all_indexes(db: AsyncSession = Depends(get_db)):
    """Fetch all supported index categories: NIFTY MIDCAP, NIFTY SMALLCAP, NIFTY MICROCAP."""
    stmt = (
        select(Index)
        .options(selectinload(Index.constituents))
        .where(Index.is_active == True)
        .order_by(Index.category)
    )
    result = await db.execute(stmt)
    indexes = result.scalars().all()

    response = []
    for idx in indexes:
        # Count constituents
        c_count = len(idx.constituents) if idx.constituents else 0
        response.append({
            "id": idx.id,
            "symbol": idx.symbol,
            "name": idx.name,
            "category": idx.category,
            "exchange": idx.exchange,
            "description": idx.description,
            "constituents_count": c_count,
            "created_at": idx.created_at.isoformat() if idx.created_at else None,
        })
    return response


@router.get("/category/{category}", response_model=dict)
async def get_index_by_category(category: str, db: AsyncSession = Depends(get_db)):
    """Fetch an index and its constituent stocks by category (MIDCAP, SMALLCAP, MICROCAP)."""
    cat_upper = category.upper().strip()
    if cat_upper not in (IndexCategory.MIDCAP, IndexCategory.SMALLCAP, IndexCategory.MICROCAP):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category '{category}'. Only MIDCAP, SMALLCAP, MICROCAP are supported."
        )

    stmt = (
        select(Index)
        .options(
            selectinload(Index.constituents).selectinload(IndexConstituent.instrument)
        )
        .where(Index.category == cat_upper)
    )
    result = await db.execute(stmt)
    idx = result.scalar_one_or_none()

    if not idx:
        raise HTTPException(status_code=404, detail=f"Index for category {cat_upper} not found.")

    provider = get_market_data_provider()
    constituents_data = []

    for c in idx.constituents:
        if c.instrument and c.is_active:
            quote = await provider.get_quote(c.instrument.symbol)
            price = quote.price if quote else c.instrument.base_price
            change = quote.change if quote else 0.0
            change_pct = quote.change_percent if quote else 0.0

            constituents_data.append({
                "id": c.id,
                "instrument_id": c.instrument.id,
                "symbol": c.instrument.symbol,
                "name": c.instrument.name,
                "exchange": c.instrument.exchange,
                "instrument_type": c.instrument.instrument_type,
                "current_price": price,
                "change": change,
                "change_percent": change_pct,
                "weightage": c.weightage,
                "lot_size": c.instrument.lot_size,
                "tick_size": c.instrument.tick_size,
            })

    # Sort constituents alphabetically by symbol
    constituents_data.sort(key=lambda x: x["symbol"])

    return {
        "id": idx.id,
        "symbol": idx.symbol,
        "name": idx.name,
        "category": idx.category,
        "exchange": idx.exchange,
        "description": idx.description,
        "total_constituents": len(constituents_data),
        "constituents": constituents_data,
    }


@router.get("/{index_id}/constituents", response_model=List[dict])
async def get_index_constituents(index_id: str, db: AsyncSession = Depends(get_db)):
    """Fetch constituent stocks for a specific index ID with live price data."""
    stmt = (
        select(IndexConstituent)
        .options(selectinload(IndexConstituent.instrument))
        .where(IndexConstituent.index_id == index_id)
    )
    result = await db.execute(stmt)
    constituents = result.scalars().all()

    provider = get_market_data_provider()
    response = []

    for c in constituents:
        if c.instrument and c.is_active:
            quote = await provider.get_quote(c.instrument.symbol)
            response.append({
                "id": c.id,
                "instrument_id": c.instrument.id,
                "symbol": c.instrument.symbol,
                "name": c.instrument.name,
                "exchange": c.instrument.exchange,
                "current_price": quote.price if quote else c.instrument.base_price,
                "change": quote.change if quote else 0.0,
                "change_percent": quote.change_percent if quote else 0.0,
                "weightage": c.weightage,
            })

    return response
