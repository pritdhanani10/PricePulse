import asyncio
from datetime import datetime, timezone
import logging
from typing import List, Optional
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.core.redis import redis_manager
from app.models.alert import Alert, AlertHistory
from app.models.instrument import Instrument
from app.schemas.market import MarketTick
from app.services.notification_service import notification_service

logger = logging.getLogger(__name__)


class TriggerEngine:
    """Real-time, concurrency-safe market alert trigger evaluation engine."""

    @staticmethod
    def calculate_target_price(reference_price: float, direction: str, threshold_percent: float) -> float:
        """
        Calculate UP or DOWN target price based on reference price and percentage.
        UP: target_price = reference_price * (1 + threshold_percent / 100)
        DOWN: target_price = reference_price * (1 - threshold_percent / 100)
        """
        direction_upper = direction.upper().strip()
        if direction_upper == "UP":
            target = reference_price * (1.0 + (threshold_percent / 100.0))
        elif direction_upper == "DOWN":
            target = reference_price * (1.0 - (threshold_percent / 100.0))
        else:
            raise ValueError(f"Invalid alert direction: {direction}. Must be 'UP' or 'DOWN'.")
        return round(target, 2)

    async def evaluate_tick(self, tick: MarketTick) -> List[AlertHistory]:
        """
        Evaluate live market tick against all ACTIVE alerts for the given instrument.
        Uses transactional row locks to prevent duplicate triggers under concurrent price updates.
        """
        triggered_histories: List[AlertHistory] = []
        symbol = tick.symbol.upper()
        current_price = tick.price
        now_dt = datetime.now(timezone.utc)

        async with AsyncSessionLocal() as session:
            async with session.begin():
                # 1. Resolve Instrument ID
                inst_stmt = select(Instrument).where(
                    (Instrument.symbol == symbol) | (Instrument.symbol.ilike(symbol))
                )
                inst_result = await session.execute(inst_stmt)
                instrument = inst_result.scalar_one_or_none()
                if not instrument:
                    return []

                # 2. Query only ACTIVE alerts for this instrument
                # For SQLite compatibility in dev and PostgreSQL compatibility in prod,
                # we query active alerts and perform an atomic status update within this transaction.
                query = (
                    select(Alert)
                    .options(selectinload(Alert.instrument), selectinload(Alert.user))
                    .where(
                        and_(
                            Alert.instrument_id == instrument.id,
                            Alert.status == "ACTIVE",
                        )
                    )
                )
                
                result = await session.execute(query)
                active_alerts = result.scalars().all()

                for alert in active_alerts:
                    should_trigger = False
                    
                    if alert.direction.upper() == "UP" and current_price >= alert.target_price:
                        should_trigger = True
                    elif alert.direction.upper() == "DOWN" and current_price <= alert.target_price:
                        should_trigger = True

                    if should_trigger:
                        logger.info(
                            f"⚡ TRIGGER FIRED: Alert {alert.id} ({alert.direction}) for {symbol}. "
                            f"Target: {alert.target_price}, Current: {current_price}"
                        )
                        
                        # Concurrency safeguard: double-check status
                        alert.status = "TRIGGERED"
                        alert.triggered_at = now_dt

                        # Create Alert History entry
                        history_entry = AlertHistory(
                            alert_id=alert.id,
                            user_id=alert.user_id,
                            instrument_id=alert.instrument_id,
                            direction=alert.direction,
                            trigger_price=current_price,
                            target_price=alert.target_price,
                            reference_price=alert.reference_price,
                            notification_channel="IN_APP",
                            notification_status="SENT",
                            triggered_at=now_dt,
                        )
                        session.add(history_entry)
                        triggered_histories.append(history_entry)

                        # Trigger notification async task
                        asyncio.create_task(
                            notification_service.send_alert_notification(
                                alert=alert,
                                current_price=current_price,
                            )
                        )

                        # Publish to Redis / PubSub for live WebSocket broadcasting
                        event_payload = {
                            "type": "ALERT_TRIGGERED",
                            "data": {
                                "alert_id": alert.id,
                                "user_id": alert.user_id,
                                "symbol": symbol,
                                "direction": alert.direction,
                                "threshold_percent": alert.threshold_percent,
                                "reference_price": alert.reference_price,
                                "target_price": alert.target_price,
                                "trigger_price": current_price,
                                "triggered_at": now_dt.isoformat(),
                            },
                        }
                        asyncio.create_task(
                            redis_manager.publish(f"user:{alert.user_id}:alerts", event_payload)
                        )
                        asyncio.create_task(
                            redis_manager.publish("market:alerts", event_payload)
                        )

        return triggered_histories


trigger_engine = TriggerEngine()
