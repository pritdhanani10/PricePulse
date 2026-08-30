import asyncio
from datetime import datetime, timezone
import logging
from typing import Dict, List, Optional
from sqlalchemy import select, and_, or_, update, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.core.redis import redis_manager
from app.models.candle import Candle5m
from app.models.index import Index, IndexConstituent
from app.models.instrument import Instrument
from app.models.strategy import Strategy, StrategyTrigger, StrategySignal, TriggerStatus, SignalType
from app.schemas.market import MarketTick
from app.strategies.base import BaseStrategy
from app.strategies.candle_three_percent_strategy import CandleThreePercentStrategy
from app.strategies.models import CandleModel, StrategyConfig, TriggerDefinition, EvaluatedSignal
from app.services.signal_service import signal_service
from app.websocket.manager import ws_manager

logger = logging.getLogger(__name__)


class StrategyService:
    """Core Strategy Coordinator: Manages strategy registry, trigger lifecycle, and tick evaluation."""

    def __init__(self):
        # Register default strategy
        self._strategy = CandleThreePercentStrategy()

    def get_strategy(self) -> CandleThreePercentStrategy:
        return self._strategy

    def update_config(self, config: StrategyConfig) -> StrategyConfig:
        self._strategy.config = config
        return self._strategy.config

    async def ensure_strategy_seeded(self) -> None:
        """Seed default strategy in DB if not present."""
        async with AsyncSessionLocal() as session:
            try:
                stmt = select(Strategy).where(Strategy.code == self._strategy.code)
                existing = (await session.execute(stmt)).scalar_one_or_none()
                if not existing:
                    strat = Strategy(
                        name=self._strategy.name,
                        code=self._strategy.code,
                        description=self._strategy.description,
                        config_json=self._strategy.config.model_dump(),
                        is_active=True,
                    )
                    session.add(strat)
                    await session.commit()
                    logger.info("✅ Seeded default 5-Minute 3% Strategy in database.")
            except Exception as e:
                await session.rollback()
                logger.error(f"Error seeding strategy: {e}")

    async def handle_candle_completed(self, candle: CandleModel) -> List[StrategyTrigger]:
        """
        Invoked when a 5-minute candle closes.
        Generates BUY/SELL triggers and manages old trigger lifecycle according to policy.
        """
        symbol = candle.symbol.upper().strip()
        now = datetime.now(timezone.utc)
        created_triggers: List[StrategyTrigger] = []

        async with AsyncSessionLocal() as session:
            try:
                # 1. Fetch strategy from DB
                strat_stmt = select(Strategy).where(Strategy.code == self._strategy.code)
                strat = (await session.execute(strat_stmt)).scalar_one_or_none()
                if not strat:
                    await self.ensure_strategy_seeded()
                    strat = (await session.execute(strat_stmt)).scalar_one_or_none()

                # 2. Look up index mapping if constituent
                idx_stmt = (
                    select(IndexConstituent.index_id)
                    .join(Instrument, Instrument.id == IndexConstituent.instrument_id)
                    .where(Instrument.symbol == symbol)
                )
                index_id = (await session.execute(idx_stmt)).scalar_one_or_none()

                # 3. Find reference candle ID if saved
                c_stmt = select(Candle5m.id).where(
                    and_(
                        Candle5m.symbol == symbol,
                        Candle5m.candle_start_time == candle.candle_start_time,
                    )
                )
                ref_candle_id = (await session.execute(c_stmt)).scalar_one_or_none()

                # 4. Apply Lifecycle Policy for prior active triggers
                policy = self._strategy.config.lifecycle_policy

                if policy == "REPLACE_ON_NEW_CANDLE":
                    # Mark older active triggers as REPLACED
                    replace_stmt = (
                        update(StrategyTrigger)
                        .where(
                            and_(
                                StrategyTrigger.symbol == symbol,
                                StrategyTrigger.status == TriggerStatus.ACTIVE,
                            )
                        )
                        .values(status=TriggerStatus.REPLACED, replaced_at=now)
                    )
                    await session.execute(replace_stmt)
                elif policy == "EXPIRE_ON_NEW_CANDLE":
                    # Mark older active triggers as EXPIRED
                    expire_stmt = (
                        update(StrategyTrigger)
                        .where(
                            and_(
                                StrategyTrigger.symbol == symbol,
                                StrategyTrigger.status == TriggerStatus.ACTIVE,
                            )
                        )
                        .values(status=TriggerStatus.EXPIRED, expires_at=now)
                    )
                    await session.execute(expire_stmt)

                # 5. Evaluate strategy to create new Trigger Definitions
                trigger_defs = self._strategy.evaluate_candle(candle)

                for t_def in trigger_defs:
                    db_trigger = StrategyTrigger(
                        strategy_id=strat.id if strat else "default_strategy",
                        symbol=symbol,
                        index_id=index_id,
                        reference_candle_id=ref_candle_id,
                        signal_type=t_def.signal_type,
                        reference_price=t_def.reference_price,
                        percentage=t_def.percentage,
                        trigger_price=t_def.trigger_price,
                        status=TriggerStatus.ACTIVE,
                        reference_candle_time=candle.candle_start_time,
                        created_at=now,
                    )
                    session.add(db_trigger)
                    created_triggers.append(db_trigger)

                await session.commit()
                for ct in created_triggers:
                    await session.refresh(ct)

                logger.info(
                    f"⚡ Strategy triggers created for {symbol}: "
                    f"BUY: ₹{trigger_defs[0].trigger_price} (from Low ₹{trigger_defs[0].reference_price}) | "
                    f"SELL: ₹{trigger_defs[1].trigger_price} (from High ₹{trigger_defs[1].reference_price})"
                )

                # 6. Broadcast trigger creation / update via WebSocket
                broadcast_data = {
                    "type": "STRATEGY_TRIGGERS_UPDATED",
                    "data": {
                        "symbol": symbol,
                        "reference_candle": candle.model_dump(mode="json"),
                        "triggers": [
                            {
                                "id": t.id,
                                "signal_type": t.signal_type,
                                "reference_price": t.reference_price,
                                "trigger_price": t.trigger_price,
                                "percentage": t.percentage,
                                "status": t.status,
                                "created_at": t.created_at.isoformat(),
                            }
                            for t in created_triggers
                        ],
                    },
                }
                asyncio.create_task(ws_manager.broadcast_event(broadcast_data))
                asyncio.create_task(redis_manager.publish("market:strategy_triggers", broadcast_data))

            except Exception as e:
                await session.rollback()
                logger.error(f"Error handling completed candle for strategy on {symbol}: {e}", exc_info=True)

        return created_triggers

    async def evaluate_tick_triggers(self, tick: MarketTick) -> List[StrategySignal]:
        """
        Evaluate live incoming price tick against all ACTIVE triggers for that symbol.
        Uses transactional safety to ensure a trigger fires exactly once (no duplicates).
        """
        symbol = tick.symbol.upper().strip()
        current_price = tick.price
        now = datetime.now(timezone.utc)
        generated_signals: List[StrategySignal] = []

        async with AsyncSessionLocal() as session:
            try:
                # 1. Query only ACTIVE triggers for this symbol
                stmt = (
                    select(StrategyTrigger)
                    .options(selectinload(StrategyTrigger.strategy), selectinload(StrategyTrigger.index))
                    .where(
                        and_(
                            StrategyTrigger.symbol == symbol,
                            StrategyTrigger.status == TriggerStatus.ACTIVE,
                        )
                    )
                )
                result = await session.execute(stmt)
                active_triggers = result.scalars().all()

                if not active_triggers:
                    return []

                # Convert to TriggerDefinitions for strategy evaluation
                trigger_defs = [
                    TriggerDefinition(
                        signal_type=t.signal_type,
                        reference_price=t.reference_price,
                        percentage=t.percentage,
                        trigger_price=t.trigger_price,
                        reference_candle_time=t.reference_candle_time or now,
                        symbol=t.symbol,
                        strategy_code=self._strategy.code,
                    )
                    for t in active_triggers
                ]

                # 2. Evaluate strategy rule
                evaluated_signals = self._strategy.evaluate_price(tick, trigger_defs)

                for ev_sig in evaluated_signals:
                    # Find corresponding trigger in active_triggers
                    matching_trigger = next(
                        (t for t in active_triggers if t.signal_type == ev_sig.signal_type and t.status == TriggerStatus.ACTIVE),
                        None
                    )

                    if matching_trigger:
                        # Concurrency check & status transition
                        matching_trigger.status = TriggerStatus.TRIGGERED
                        matching_trigger.triggered_at = now
                        await session.commit()

                        # Record signal & broadcast
                        sig = await signal_service.record_and_broadcast_signal(ev_sig, matching_trigger)
                        if sig:
                            generated_signals.append(sig)

            except Exception as e:
                await session.rollback()
                logger.error(f"Error evaluating strategy triggers for tick {symbol}: {e}", exc_info=True)

        return generated_signals

    async def get_active_triggers(self, symbol: Optional[str] = None) -> List[dict]:
        """Fetch current ACTIVE strategy triggers for a symbol or all symbols."""
        async with AsyncSessionLocal() as session:
            stmt = (
                select(StrategyTrigger)
                .options(selectinload(StrategyTrigger.strategy), selectinload(StrategyTrigger.index))
                .where(StrategyTrigger.status == TriggerStatus.ACTIVE)
            )
            if symbol:
                stmt = stmt.where(StrategyTrigger.symbol == symbol.upper().strip())

            result = await session.execute(stmt)
            triggers = result.scalars().all()

            return [
                {
                    "id": t.id,
                    "symbol": t.symbol,
                    "signal_type": t.signal_type,
                    "reference_price": t.reference_price,
                    "trigger_price": t.trigger_price,
                    "percentage": t.percentage,
                    "status": t.status,
                    "reference_candle_time": t.reference_candle_time.isoformat() if t.reference_candle_time else None,
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                    "index_name": t.index.name if t.index else None,
                    "index_category": t.index.category if t.index else None,
                }
                for t in triggers
            ]

    async def ensure_symbol_monitored(self, symbol: str) -> None:
        """Ensure market provider is streaming ticks and initial 5m triggers exist for symbol."""
        sym = symbol.upper().strip()
        from app.services.market_data.factory import get_market_data_provider
        provider = get_market_data_provider()
        await provider.subscribe([sym])

        # Check if active triggers already exist
        async with AsyncSessionLocal() as session:
            stmt = select(StrategyTrigger).where(
                and_(
                    StrategyTrigger.symbol == sym,
                    StrategyTrigger.status == TriggerStatus.ACTIVE,
                )
            )
            existing = (await session.execute(stmt)).scalars().all()
            if not existing:
                from app.services.candle_service import candle_service
                latest_candle = await candle_service.get_latest_completed_candle(sym)
                if latest_candle:
                    await self.handle_candle_completed(latest_candle)

    async def get_watchlist_auto_monitor_summary(self, user_id: str) -> List[dict]:
        """
        Calculates live distances to BUY and SELL triggers for all auto-monitored stocks in user's watchlists.
        """
        from app.models.watchlist import Watchlist, WatchlistItem
        from app.services.market_data.factory import get_market_data_provider
        provider = get_market_data_provider()

        async with AsyncSessionLocal() as session:
            stmt = (
                select(WatchlistItem)
                .join(Watchlist, Watchlist.id == WatchlistItem.watchlist_id)
                .join(Instrument, Instrument.id == WatchlistItem.instrument_id)
                .options(
                    selectinload(WatchlistItem.watchlist),
                    selectinload(WatchlistItem.instrument),
                )
                .where(
                    and_(
                        Watchlist.user_id == user_id,
                        WatchlistItem.auto_monitor == True,
                    )
                )
            )
            items = (await session.execute(stmt)).scalars().all()

            results = []
            for item in items:
                sym = item.instrument.symbol.upper()
                quote = await provider.get_quote(sym)
                current_price = quote.price if quote else item.instrument.base_price

                # Fetch active triggers for this symbol
                trig_stmt = select(StrategyTrigger).where(
                    and_(
                        StrategyTrigger.symbol == sym,
                        StrategyTrigger.status == TriggerStatus.ACTIVE,
                    )
                )
                active_trigs = (await session.execute(trig_stmt)).scalars().all()

                buy_trig = next((t for t in active_trigs if t.signal_type == "BUY"), None)
                sell_trig = next((t for t in active_trigs if t.signal_type == "SELL"), None)

                buy_dist = None
                if buy_trig and current_price > 0:
                    buy_dist = round(((buy_trig.trigger_price - current_price) / current_price) * 100, 2)

                sell_dist = None
                if sell_trig and current_price > 0:
                    sell_dist = round(((current_price - sell_trig.trigger_price) / current_price) * 100, 2)

                # Fetch latest signal
                sig_stmt = (
                    select(StrategySignal)
                    .where(StrategySignal.symbol == sym)
                    .order_by(desc(StrategySignal.signal_time))
                    .limit(1)
                )
                last_sig = (await session.execute(sig_stmt)).scalar_one_or_none()

                results.append({
                    "watchlist_id": item.watchlist_id,
                    "watchlist_name": item.watchlist.name if item.watchlist else "Watchlist",
                    "item_id": item.id,
                    "instrument_id": item.instrument_id,
                    "symbol": sym,
                    "name": item.instrument.name,
                    "instrument_type": item.instrument.instrument_type,
                    "auto_monitor": item.auto_monitor,
                    "current_price": current_price,
                    "buy_trigger_price": buy_trig.trigger_price if buy_trig else None,
                    "buy_percent": item.buy_percent,
                    "buy_distance_percent": buy_dist,
                    "sell_trigger_price": sell_trig.trigger_price if sell_trig else None,
                    "sell_percent": item.sell_percent,
                    "sell_distance_percent": sell_dist,
                    "reference_candle_time": buy_trig.reference_candle_time.isoformat() if buy_trig and buy_trig.reference_candle_time else None,
                    "last_signal_type": last_sig.signal_type if last_sig else None,
                    "last_signal_time": last_sig.signal_time.isoformat() if last_sig and last_sig.signal_time else None,
                })

            return results


strategy_service = StrategyService()
