from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
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
    AutoMonitorItemSummary,
    NotificationListResponse,
    UpdateWatchlistItemRequest,
    UserNotificationResponse,
    WatchlistCreate,
    WatchlistResponse,
)
from app.services.notification_service import notification_service
from app.services.strategy_service import strategy_service

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
    """Add an instrument to a watchlist and ensure background monitoring is primed."""
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
            auto_monitor=payload.auto_monitor,
            strategy_code=payload.strategy_code,
            buy_percent=payload.buy_percent,
            sell_percent=payload.sell_percent,
        )
        db.add(new_item)
        await db.commit()
    else:
        # Update flags if already exists
        existing_item.auto_monitor = payload.auto_monitor
        existing_item.strategy_code = payload.strategy_code
        existing_item.buy_percent = payload.buy_percent
        existing_item.sell_percent = payload.sell_percent
        await db.commit()

    # If auto-monitored, ensure market worker and strategy triggers are ready
    if payload.auto_monitor:
        await strategy_service.ensure_symbol_monitored(instrument.symbol)

    # Return refreshed watchlist
    reload_stmt = (
        select(Watchlist)
        .options(
            selectinload(Watchlist.items).selectinload(WatchlistItem.instrument)
        )
        .where(Watchlist.id == watchlist.id)
    )
    return (await db.execute(reload_stmt)).scalar_one()


@router.patch("/{watchlist_id}/items/{item_id}", response_model=WatchlistResponse)
async def update_watchlist_item(
    watchlist_id: str,
    item_id: str,
    payload: UpdateWatchlistItemRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update auto-monitor state or parameters for a watchlist item."""
    wl_stmt = select(Watchlist).where(
        and_(Watchlist.id == watchlist_id, Watchlist.user_id == current_user.id)
    )
    watchlist = (await db.execute(wl_stmt)).scalar_one_or_none()
    if not watchlist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watchlist not found",
        )

    item_stmt = (
        select(WatchlistItem)
        .options(selectinload(WatchlistItem.instrument))
        .where(
            and_(
                WatchlistItem.id == item_id,
                WatchlistItem.watchlist_id == watchlist.id,
            )
        )
    )
    item = (await db.execute(item_stmt)).scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watchlist item not found",
        )

    if payload.auto_monitor is not None:
        item.auto_monitor = payload.auto_monitor
    if payload.strategy_code is not None:
        item.strategy_code = payload.strategy_code
    if payload.buy_percent is not None:
        item.buy_percent = payload.buy_percent
    if payload.sell_percent is not None:
        item.sell_percent = payload.sell_percent

    await db.commit()

    if item.auto_monitor and item.instrument:
        await strategy_service.ensure_symbol_monitored(item.instrument.symbol)

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
            (WatchlistItem.instrument_id == resolved_id) | (WatchlistItem.id == instrument_id),
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


@router.get("/auto-monitor/summary", response_model=List[AutoMonitorItemSummary])
async def get_auto_monitor_summary(
    current_user: User = Depends(get_current_user),
):
    """Get consolidated live auto-monitoring summary with distances to triggers."""
    return await strategy_service.get_watchlist_auto_monitor_summary(current_user.id)


@router.get("/notifications", response_model=NotificationListResponse)
async def get_watchlist_notifications(
    unread_only: bool = Query(False, description="Filter only unread notifications"),
    limit: int = Query(50, ge=1, le=200, description="Max number of notifications"),
    current_user: User = Depends(get_current_user),
):
    """Retrieve all notifications and alert reminders for the logged-in user."""
    notifications, unread_count = await notification_service.get_user_notifications(
        user_id=current_user.id,
        unread_only=unread_only,
        limit=limit,
    )
    return {
        "total": len(notifications),
        "unread_count": unread_count,
        "notifications": notifications,
    }


@router.put("/notifications/{notification_id}/read", response_model=dict)
async def mark_notification_as_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
):
    """Mark a notification as read."""
    success = await notification_service.mark_as_read(
        notification_id=notification_id,
        user_id=current_user.id,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return {"status": "success", "message": "Notification marked as read"}


@router.post("/notifications/read-all", response_model=dict)
async def mark_all_notifications_as_read(
    current_user: User = Depends(get_current_user),
):
    """Mark all notifications as read for current user."""
    count = await notification_service.mark_all_as_read(user_id=current_user.id)
    return {"status": "success", "count": count, "message": f"{count} notifications marked as read"}
