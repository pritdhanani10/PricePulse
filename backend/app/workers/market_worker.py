import asyncio
import logging
from app.core.redis import redis_manager
from app.services.market_data.factory import get_market_data_provider
from app.services.trigger_engine import trigger_engine
from app.websocket.manager import ws_manager

logger = logging.getLogger(__name__)


class MarketWorker:
    """Asynchronous background worker continuously streaming ticks and driving the trigger engine."""

    def __init__(self):
        self._task: asyncio.Task = None
        self._is_running: bool = False

    async def start(self) -> None:
        if self._is_running:
            return
        self._is_running = True
        provider = get_market_data_provider()
        await provider.connect()
        self._task = asyncio.create_task(self._run_loop())
        logger.info("🚀 Market Worker started successfully.")

    async def stop(self) -> None:
        self._is_running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        provider = get_market_data_provider()
        await provider.disconnect()
        logger.info("🛑 Market Worker stopped.")

    async def _run_loop(self) -> None:
        provider = get_market_data_provider()
        try:
            async for tick in provider.stream_ticks():
                if not self._is_running:
                    break
                
                # 1. Update cache
                await redis_manager.set(
                    f"market:quote:{tick.symbol.upper()}",
                    tick.model_dump(mode="json"),
                    expire_seconds=60,
                )

                # 2. Evaluate active alerts in concurrency-safe trigger engine
                try:
                    await trigger_engine.evaluate_tick(tick)
                except Exception as e:
                    logger.error(f"Error during trigger engine evaluation for {tick.symbol}: {e}", exc_info=True)

                # 3. Update 5-minute candle aggregation and handle candle completion
                try:
                    from app.services.candle_service import candle_service
                    from app.services.strategy_service import strategy_service

                    finalized_candle = await candle_service.process_tick(tick)
                    if finalized_candle:
                        # Automatically create new strategy triggers for the completed candle
                        await strategy_service.handle_candle_completed(finalized_candle)

                    # Evaluate live tick against ACTIVE strategy triggers
                    await strategy_service.evaluate_tick_triggers(tick)
                except Exception as e:
                    logger.error(f"Error in strategy/candle processing for {tick.symbol}: {e}", exc_info=True)

                # 4. Broadcast live tick to connected WebSocket clients
                try:
                    await ws_manager.broadcast_tick(tick)
                except Exception as e:
                    logger.error(f"Error broadcasting tick for {tick.symbol}: {e}")

        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Unexpected error in market worker loop: {e}", exc_info=True)


market_worker = MarketWorker()
