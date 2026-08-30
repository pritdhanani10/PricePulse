from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.alert import Alert, AlertHistory
from app.models.instrument import Instrument
from app.models.user import User
from app.schemas.alert import (
    AlertCreate,
    AlertHistoryResponse,
    AlertResponse,
    AlertUpdate,
    DualAlertCreate,
)
from app.services.market_data.factory import get_market_data_provider
from app.services.trigger_engine import TriggerEngine

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("", response_model=List[AlertResponse])
async def list_alerts(
    status_filter: Optional[str] = Query(None, alias="status", description="ACTIVE, TRIGGERED, DISABLED"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all alerts created by the authenticated user."""
    stmt = (
        select(Alert)
        .options(selectinload(Alert.instrument))
        .where(Alert.user_id == current_user.id)
    )
    if status_filter:
        stmt = stmt.where(Alert.status == status_filter.upper().strip())
    stmt = stmt.order_by(Alert.created_at.desc())
    
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=AlertResponse, status_code=status.HTTP_201_CREATED)
async def create_alert(
    alert_in: AlertCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new percentage-based UP or DOWN market alert."""
    # 1. Resolve Instrument
    inst_stmt = select(Instrument).where(
        (Instrument.id == alert_in.instrument_id) | (Instrument.symbol == alert_in.instrument_id.upper())
    )
    inst_res = await db.execute(inst_stmt)
    instrument = inst_res.scalar_one_or_none()
    if not instrument:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Instrument '{alert_in.instrument_id}' not found",
        )

    # 2. Determine Reference Price
    provider = get_market_data_provider()
    quote = await provider.get_quote(instrument.symbol)
    
    if alert_in.reference_type == "MARKET_OPEN":
        reference_price = quote.open if quote else instrument.base_price
    elif alert_in.reference_type == "CURRENT_PRICE":
        reference_price = quote.price if quote else instrument.base_price
    elif alert_in.reference_type == "CUSTOM":
        if not alert_in.reference_price or alert_in.reference_price <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Custom reference price must be provided and greater than 0.",
            )
        reference_price = alert_in.reference_price
    else:
        reference_price = quote.price if quote else instrument.base_price

    # 3. Calculate Target Price
    target_price = TriggerEngine.calculate_target_price(
        reference_price=reference_price,
        direction=alert_in.direction,
        threshold_percent=alert_in.threshold_percent,
    )

    # 4. Prevent duplicate identical active alert
    dup_stmt = select(Alert).where(
        and_(
            Alert.user_id == current_user.id,
            Alert.instrument_id == instrument.id,
            Alert.direction == alert_in.direction.upper(),
            Alert.target_price == target_price,
            Alert.status == "ACTIVE",
        )
    )
    existing_dup = (await db.execute(dup_stmt)).scalar_one_or_none()
    if existing_dup:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An active {alert_in.direction} alert with target price ₹{target_price:,.2f} already exists for {instrument.symbol}.",
        )

    # 5. Persist Alert
    alert = Alert(
        user_id=current_user.id,
        instrument_id=instrument.id,
        alert_type="PERCENTAGE",
        reference_type=alert_in.reference_type,
        reference_price=reference_price,
        direction=alert_in.direction.upper(),
        threshold_percent=alert_in.threshold_percent,
        target_price=target_price,
        status="ACTIVE",
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)

    # Reload with instrument relationship
    reload_stmt = select(Alert).options(selectinload(Alert.instrument)).where(Alert.id == alert.id)
    return (await db.execute(reload_stmt)).scalar_one()


@router.post("/dual", response_model=List[AlertResponse], status_code=status.HTTP_201_CREATED)
async def create_dual_alerts(
    payload: DualAlertCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create both UP and DOWN triggers simultaneously for an instrument."""
    if not payload.up_percentage and not payload.down_percentage:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one of up_percentage or down_percentage must be specified.",
        )

    inst_stmt = select(Instrument).where(
        (Instrument.id == payload.instrument_id) | (Instrument.symbol == payload.instrument_id.upper())
    )
    instrument = (await db.execute(inst_stmt)).scalar_one_or_none()
    if not instrument:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Instrument '{payload.instrument_id}' not found",
        )

    provider = get_market_data_provider()
    quote = await provider.get_quote(instrument.symbol)

    if payload.reference_type == "MARKET_OPEN":
        ref_price = quote.open if quote else instrument.base_price
    elif payload.reference_type == "CUSTOM" and payload.reference_price:
        ref_price = payload.reference_price
    else:
        ref_price = quote.price if quote else instrument.base_price

    created_alerts = []

    if payload.up_percentage:
        up_target = TriggerEngine.calculate_target_price(ref_price, "UP", payload.up_percentage)
        up_alert = Alert(
            user_id=current_user.id,
            instrument_id=instrument.id,
            alert_type="PERCENTAGE",
            reference_type=payload.reference_type,
            reference_price=ref_price,
            direction="UP",
            threshold_percent=payload.up_percentage,
            target_price=up_target,
            status="ACTIVE",
        )
        db.add(up_alert)
        created_alerts.append(up_alert)

    if payload.down_percentage:
        down_target = TriggerEngine.calculate_target_price(ref_price, "DOWN", payload.down_percentage)
        down_alert = Alert(
            user_id=current_user.id,
            instrument_id=instrument.id,
            alert_type="PERCENTAGE",
            reference_type=payload.reference_type,
            reference_price=ref_price,
            direction="DOWN",
            threshold_percent=payload.down_percentage,
            target_price=down_target,
            status="ACTIVE",
        )
        db.add(down_alert)
        created_alerts.append(down_alert)

    await db.commit()

    alert_ids = [a.id for a in created_alerts]
    res_stmt = (
        select(Alert)
        .options(selectinload(Alert.instrument))
        .where(Alert.id.in_(alert_ids))
    )
    return (await db.execute(res_stmt)).scalars().all()


@router.put("/{alert_id}", response_model=AlertResponse)
async def update_alert(
    alert_id: str,
    update_in: AlertUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update or cancel an active alert."""
    stmt = (
        select(Alert)
        .options(selectinload(Alert.instrument))
        .where(and_(Alert.id == alert_id, Alert.user_id == current_user.id))
    )
    alert = (await db.execute(stmt)).scalar_one_or_none()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )

    if update_in.status:
        alert.status = update_in.status.upper()

    if update_in.threshold_percent is not None:
        alert.threshold_percent = update_in.threshold_percent
        alert.target_price = TriggerEngine.calculate_target_price(
            reference_price=alert.reference_price,
            direction=alert.direction,
            threshold_percent=update_in.threshold_percent,
        )

    await db.commit()
    await db.refresh(alert)
    return alert


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an alert."""
    stmt = select(Alert).where(and_(Alert.id == alert_id, Alert.user_id == current_user.id))
    alert = (await db.execute(stmt)).scalar_one_or_none()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )
    await db.delete(alert)
    await db.commit()
    return None


@router.get("/history", response_model=List[AlertHistoryResponse])
async def get_alert_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve full timeline history of triggered alerts for the authenticated user."""
    stmt = (
        select(AlertHistory)
        .options(selectinload(AlertHistory.instrument))
        .where(AlertHistory.user_id == current_user.id)
        .order_by(AlertHistory.triggered_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()
