import asyncio
from datetime import datetime, timezone, timedelta
import logging
from typing import Dict, List, Optional, Tuple
from sqlalchemy import select, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.candle import Candle5m
from app.schemas.market import MarketTick, OHLCVBar
from app.strategies.models import CandleModel
from app.services.market_data.factory import get_market_data_provider

logger = logging.getLogger(__name__)


def get_5m_candle_bounds(dt: datetime) -> Tuple[datetime, datetime]:
    """Calculate the 5-minute aligned start and end timestamps for a given datetime."""
    # Ensure UTC
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    
    minute = (dt.minute // 5) * 5
    start = dt.replace(minute=minute, second=0, microsecond=0)
    end = start + timedelta(minutes=5)
    return start, end


class CandleService:
    """Real-Time 5-Minute Candle Aggregator, Database Synchronizer, and Finalizer."""

    def __init__(self):
        # In-memory accumulator for currently forming 5m candle: {symbol: dict}
        self._forming_candles: Dict[str, dict] = {}
        self._lock = asyncio.Lock()

    async def get_latest_completed_candle(self, symbol: str) -> Optional[CandleModel]:
        """Fetch the most recent finalized 5-minute candle for a symbol."""
        sym = symbol.upper().strip()
        async with AsyncSessionLocal() as session:
            stmt = (
                select(Candle5m)
                .where(and_(Candle5m.symbol == sym, Candle5m.is_finalized == True))
                .order_by(desc(Candle5m.candle_start_time))
                .limit(1)
            )
            result = await session.execute(stmt)
            c = result.scalar_one_or_none()
            if c:
                return CandleModel(
                    symbol=c.symbol,
                    timeframe=c.timeframe,
                    open=c.open,
                    high=c.high,
                    low=c.low,
                    close=c.close,
                    volume=c.volume,
                    candle_start_time=c.candle_start_time,
                    candle_end_time=c.candle_end_time,
                    is_finalized=c.is_finalized,
                )

        # Fallback to provider historical data if none in DB
        provider = get_market_data_provider()
        bars = await provider.get_historical_ohlcv(sym, timeframe="5m", limit=5)
        if bars:
            last_bar = bars[-1]
            c_start = datetime.fromtimestamp(last_bar.time, tz=timezone.utc)
            c_end = c_start + timedelta(minutes=5)
            # Persist to DB
            candle_model = CandleModel(
                symbol=sym,
                timeframe="5m",
                open=last_bar.open,
                high=last_bar.high,
                low=last_bar.low,
                close=last_bar.close,
                volume=last_bar.volume,
                candle_start_time=c_start,
                candle_end_time=c_end,
                is_finalized=True,
            )
            await self.save_finalized_candle(candle_model)
            return candle_model

        return None

    async def get_historical_5m_candles(self, symbol: str, limit: int = 100) -> List[CandleModel]:
        """Fetch historical 5-minute candles from DB and Market Data Provider."""
        sym = symbol.upper().strip()
        provider = get_market_data_provider()
        bars = await provider.get_historical_ohlcv(sym, timeframe="5m", limit=limit)
        candles: List[CandleModel] = []

        for b in bars:
            c_start = datetime.fromtimestamp(b.time, tz=timezone.utc)
            c_end = c_start + timedelta(minutes=5)
            candles.append(
                CandleModel(
                    symbol=sym,
                    timeframe="5m",
                    open=b.open,
                    high=b.high,
                    low=b.low,
                    close=b.close,
                    volume=b.volume,
                    candle_start_time=c_start,
                    candle_end_time=c_end,
                    is_finalized=True,
                )
            )

        return candles

    async def process_tick(self, tick: MarketTick) -> Optional[CandleModel]:
        """
        Ingest a live price tick into the 5-minute aggregator.
        Returns a finalized CandleModel if this tick caused a previous 5m candle bucket to close.
        """
        sym = tick.symbol.upper().strip()
        tick_time = tick.timestamp if tick.timestamp else datetime.now(timezone.utc)
        start_time, end_time = get_5m_candle_bounds(tick_time)

        finalized_candle: Optional[CandleModel] = None

        async with self._lock:
            current_acc = self._forming_candles.get(sym)

            if current_acc:
                # Check if this tick belongs to a new 5-minute bucket
                if current_acc["start_time"] != start_time:
                    # Previous candle has finalized!
                    finalized_candle = CandleModel(
                        symbol=sym,
                        timeframe="5m",
                        open=current_acc["open"],
                        high=current_acc["high"],
                        low=current_acc["low"],
                        close=current_acc["close"],
                        volume=current_acc["volume"],
                        candle_start_time=current_acc["start_time"],
                        candle_end_time=current_acc["end_time"],
                        is_finalized=True,
                    )
                    # Reset accumulator with the new tick
                    self._forming_candles[sym] = {
                        "start_time": start_time,
                        "end_time": end_time,
                        "open": tick.price,
                        "high": tick.price,
                        "low": tick.price,
                        "close": tick.price,
                        "volume": tick.volume,
                    }
                else:
                    # Update current forming candle
                    current_acc["high"] = max(current_acc["high"], tick.price)
                    current_acc["low"] = min(current_acc["low"], tick.price)
                    current_acc["close"] = tick.price
                    current_acc["volume"] = tick.volume
            else:
                # Initialize new forming candle
                self._forming_candles[sym] = {
                    "start_time": start_time,
                    "end_time": end_time,
                    "open": tick.price,
                    "high": tick.price,
                    "low": tick.price,
                    "close": tick.price,
                    "volume": tick.volume,
                }

        if finalized_candle:
            logger.info(
                f"🕯️ 5M CANDLE FINALIZED: {sym} [O: ₹{finalized_candle.open}, H: ₹{finalized_candle.high}, "
                f"L: ₹{finalized_candle.low}, C: ₹{finalized_candle.close}] at {finalized_candle.candle_start_time.strftime('%H:%M:%S')}"
            )
            await self.save_finalized_candle(finalized_candle)

        return finalized_candle

    async def save_finalized_candle(self, candle: CandleModel) -> None:
        """Persist finalized 5m candle to database, avoiding duplicate inserts."""
        async with AsyncSessionLocal() as session:
            try:
                stmt = select(Candle5m).where(
                    and_(
                        Candle5m.symbol == candle.symbol,
                        Candle5m.candle_start_time == candle.candle_start_time,
                    )
                )
                existing = (await session.execute(stmt)).scalar_one_or_none()
                if not existing:
                    db_candle = Candle5m(
                        symbol=candle.symbol,
                        timeframe=candle.timeframe,
                        open=candle.open,
                        high=candle.high,
                        low=candle.low,
                        close=candle.close,
                        volume=candle.volume,
                        candle_start_time=candle.candle_start_time,
                        candle_end_time=candle.candle_end_time,
                        is_finalized=True,
                    )
                    session.add(db_candle)
                    await session.commit()
                else:
                    existing.open = candle.open
                    existing.high = candle.high
                    existing.low = candle.low
                    existing.close = candle.close
                    existing.volume = candle.volume
                    existing.is_finalized = True
                    await session.commit()
            except Exception as e:
                await session.rollback()
                logger.error(f"Error saving finalized 5m candle for {candle.symbol}: {e}")


candle_service = CandleService()
