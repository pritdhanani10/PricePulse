import asyncio
from datetime import datetime, timezone
import logging
from typing import Dict, List, Optional
from sqlalchemy import select, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.core.redis import redis_manager
from app.models.instrument import Instrument
from app.models.strategy import Strategy, StrategyTrigger, StrategySignal, TriggerStatus, SignalType
from app.models.watchlist import Watchlist, WatchlistItem
from app.services.notification_service import notification_service
from app.strategies.models import EvaluatedSignal
from app.websocket.manager import ws_manager

logger = logging.getLogger(__name__)


class SignalService:
    """Service handling Strategy Signal persistence, concurrency control, and WebSocket broadcasting."""

    async def record_and_broadcast_signal(
        self,
        signal_data: EvaluatedSignal,
        trigger: StrategyTrigger,
    ) -> Optional[StrategySignal]:
        """
        Atomically records a generated StrategySignal, dispatches real-time WebSocket broadcasts,
        and generates persistent notifications for all users monitoring this stock in their Watchlists.
        """
        symbol = signal_data.symbol.upper().strip()
        async with AsyncSessionLocal() as session:
            try:
                # 1. Fetch parent strategy
                stmt = select(Strategy).where(Strategy.code == signal_data.metadata.get("strategy_code", "CANDLE_3_PERCENT_5M"))
                strat = (await session.execute(stmt)).scalar_one_or_none()
                strat_id = strat.id if strat else trigger.strategy_id

                # 2. Check if a signal for this trigger already exists (strict duplicate prevention)
                sig_check = select(StrategySignal).where(StrategySignal.trigger_id == trigger.id)
                existing_sig = (await session.execute(sig_check)).scalar_one_or_none()
                if existing_sig:
                    logger.warning(f"Signal already recorded for trigger {trigger.id}. Skipping duplicate.")
                    return existing_sig

                # 3. Create StrategySignal record
                new_signal = StrategySignal(
                    strategy_id=strat_id,
                    trigger_id=trigger.id,
                    symbol=symbol,
                    index_id=trigger.index_id,
                    signal_type=signal_data.signal_type,
                    trigger_price=signal_data.trigger_price,
                    actual_market_price=signal_data.actual_trigger_price,
                    reference_price=signal_data.reference_price,
                    trigger_percent=signal_data.trigger_percent,
                    signal_time=signal_data.triggered_at,
                    reference_candle_time=signal_data.reference_candle_time,
                    metadata_json=signal_data.metadata,
                )
                session.add(new_signal)
                await session.commit()
                await session.refresh(new_signal)

                logger.info(
                    f"🎯 STRATEGY SIGNAL GENERATED: {new_signal.signal_type} {new_signal.symbol} "
                    f"at ₹{new_signal.actual_market_price} (Trigger: ₹{new_signal.trigger_price}) "
                    f"Ref: ₹{new_signal.reference_price}"
                )

                # 4. Broadcast to WebSocket clients
                event_payload = {
                    "type": "STRATEGY_SIGNAL",
                    "data": {
                        "id": new_signal.id,
                        "strategy_name": signal_data.strategy_name,
                        "symbol": new_signal.symbol,
                        "signal_type": new_signal.signal_type,
                        "trigger_price": new_signal.trigger_price,
                        "actual_market_price": new_signal.actual_market_price,
                        "reference_price": new_signal.reference_price,
                        "trigger_percent": new_signal.trigger_percent,
                        "signal_time": new_signal.signal_time.isoformat(),
                        "reference_candle_time": new_signal.reference_candle_time.isoformat() if new_signal.reference_candle_time else None,
                    },
                }

                # Publish via Redis / In-memory WebSockets
                asyncio.create_task(redis_manager.publish("market:strategy_signals", event_payload))
                asyncio.create_task(ws_manager.broadcast_event(event_payload))

                # 5. Automatically create notifications for all users auto-monitoring this stock in their Watchlist
                wl_stmt = (
                    select(WatchlistItem)
                    .join(Watchlist, Watchlist.id == WatchlistItem.watchlist_id)
                    .join(Instrument, Instrument.id == WatchlistItem.instrument_id)
                    .options(selectinload(WatchlistItem.watchlist))
                    .where(
                        and_(
                            Instrument.symbol == symbol,
                            WatchlistItem.auto_monitor == True,
                        )
                    )
                )
                wl_items = (await session.execute(wl_stmt)).scalars().all()
                for item in wl_items:
                    if item.watchlist and item.watchlist.user_id:
                        asyncio.create_task(
                            notification_service.send_watchlist_signal_notification(
                                user_id=item.watchlist.user_id,
                                symbol=symbol,
                                signal=new_signal,
                                watchlist_id=item.watchlist_id,
                                instrument_id=item.instrument_id,
                            )
                        )

                return new_signal
            except Exception as e:
                await session.rollback()
                logger.error(f"Error recording strategy signal: {e}", exc_info=True)
                return None

    async def get_signals(
        self,
        symbol: Optional[str] = None,
        signal_type: Optional[str] = None,
        index_id: Optional[str] = None,
        limit: int = 50,
    ) -> List[dict]:
        """Fetch historical signals with filters."""
        async with AsyncSessionLocal() as session:
            stmt = (
                select(StrategySignal)
                .options(selectinload(StrategySignal.strategy), selectinload(StrategySignal.index))
                .order_by(desc(StrategySignal.signal_time))
            )
            if symbol:
                stmt = stmt.where(StrategySignal.symbol == symbol.upper().strip())
            if signal_type:
                stmt = stmt.where(StrategySignal.signal_type == signal_type.upper().strip())
            if index_id:
                stmt = stmt.where(StrategySignal.index_id == index_id)

            stmt = stmt.limit(limit)
            result = await session.execute(stmt)
            signals = result.scalars().all()

            return [
                {
                    "id": s.id,
                    "symbol": s.symbol,
                    "strategy_name": s.strategy.name if s.strategy else "5-Minute 3% Strategy",
                    "signal_type": s.signal_type,
                    "trigger_price": s.trigger_price,
                    "actual_market_price": s.actual_market_price,
                    "reference_price": s.reference_price,
                    "trigger_percent": s.trigger_percent,
                    "signal_time": s.signal_time.isoformat() if s.signal_time else None,
                    "reference_candle_time": s.reference_candle_time.isoformat() if s.reference_candle_time else None,
                    "index_name": s.index.name if s.index else None,
                    "index_category": s.index.category if s.index else None,
                }
                for s in signals
            ]


signal_service = SignalService()
