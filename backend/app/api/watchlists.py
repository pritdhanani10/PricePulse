from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.instrument import Instrument
from app.models.user import User
from app.models.watchlist import Watchlist, WatchlistItem
from app.schemas.watchlist import (
    AddWatchlistItemRequest,
    WatchlistCreate,
    WatchlistResponse,
)

router = APIRouter(prefix="/watchlists", tags=["Watchlists"])


@router.get("", response_model=List[WatchlistResponse])
async def get_user_watchlists(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all watchlists and their contained instruments for the current user."""
    stmt = (
        select(Watchlist)
        .options(
            selectinload(Watchlist.items).selectinload(WatchlistItem.instrument)
        )
        .where(Watchlist.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=WatchlistResponse, status_code=status.HTTP_201_CREATED)
async def create_watchlist(
    data: WatchlistCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new custom watchlist."""
    watchlist = Watchlist(
        user_id=current_user.id,
        name=data.name.strip(),
    )
    db.add(watchlist)
    await db.commit()
    await db.refresh(watchlist)

    stmt = (
        select(Watchlist)
        .options(
            selectinload(Watchlist.items).selectinload(WatchlistItem.instrument)
        )
        .where(Watchlist.id == watchlist.id)
    )
    return (await db.execute(stmt)).scalar_one()


@router.delete("/{watchlist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_watchlist(
    watchlist_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a watchlist."""
    stmt = select(Watchlist).where(
        and_(Watchlist.id == watchlist_id, Watchlist.user_id == current_user.id)
    )
    watchlist = (await db.execute(stmt)).scalar_one_or_none()
    if not watchlist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watchlist not found",
        )
    await db.delete(watchlist)
    await db.commit()
    return None


@router.post("/{watchlist_id}/items", response_model=WatchlistResponse)
async def add_item_to_watchlist(
    watchlist_id: str,
    payload: AddWatchlistItemRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add an instrument to a watchlist."""
    # Verify watchlist belongs to user
    wl_stmt = select(Watchlist).where(
        and_(Watchlist.id == watchlist_id, Watchlist.user_id == current_user.id)
    )
    watchlist = (await db.execute(wl_stmt)).scalar_one_or_none()
    if not watchlist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watchlist not found",
        )

    # Verify instrument exists
    inst_stmt = select(Instrument).where(
        (Instrument.id == payload.instrument_id) | (Instrument.symbol == payload.instrument_id.upper())
    )
    instrument = (await db.execute(inst_stmt)).scalar_one_or_none()
    if not instrument:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Instrument '{payload.instrument_id}' not found",
        )

    # Check if item already in watchlist
    item_stmt = select(WatchlistItem).where(
        and_(
            WatchlistItem.watchlist_id == watchlist.id,
            WatchlistItem.instrument_id == instrument.id,
        )
    )
    existing_item = (await db.execute(item_stmt)).scalar_one_or_none()
    if not existing_item:
        new_item = WatchlistItem(
            watchlist_id=watchlist.id,
            instrument_id=instrument.id,
        )
        db.add(new_item)
        await db.commit()

    # Return refreshed watchlist
    reload_stmt = (
        select(Watchlist)
        .options(
            selectinload(Watchlist.items).selectinload(WatchlistItem.instrument)
        )
        .where(Watchlist.id == watchlist.id)
    )
    return (await db.execute(reload_stmt)).scalar_one()


@router.delete("/{watchlist_id}/items/{instrument_id}", response_model=WatchlistResponse)
async def remove_item_from_watchlist(
    watchlist_id: str,
    instrument_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove an instrument from a watchlist."""
    wl_stmt = select(Watchlist).where(
        and_(Watchlist.id == watchlist_id, Watchlist.user_id == current_user.id)
    )
    watchlist = (await db.execute(wl_stmt)).scalar_one_or_none()
    if not watchlist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watchlist not found",
        )

    inst_stmt = select(Instrument).where(
        (Instrument.id == instrument_id) | (Instrument.symbol == instrument_id.upper())
    )
    instrument = (await db.execute(inst_stmt)).scalar_one_or_none()
    resolved_id = instrument.id if instrument else instrument_id

    item_stmt = select(WatchlistItem).where(
        and_(
            WatchlistItem.watchlist_id == watchlist.id,
            WatchlistItem.instrument_id == resolved_id,
        )
    )
    item = (await db.execute(item_stmt)).scalar_one_or_none()
    if item:
        await db.delete(item)
        await db.commit()

    reload_stmt = (
        select(Watchlist)
        .options(
            selectinload(Watchlist.items).selectinload(WatchlistItem.instrument)
        )
        .where(Watchlist.id == watchlist.id)
    )
    return (await db.execute(reload_stmt)).scalar_one()
