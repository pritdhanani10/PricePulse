import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, Index as SQLIndex
from app.models.base import Base


class Candle5m(Base):
    __tablename__ = "candles_5m"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    symbol = Column(String(30), nullable=False, index=True)
    timeframe = Column(String(10), default="5m", nullable=False)
    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(Float, default=0.0, nullable=False)
    candle_start_time = Column(DateTime(timezone=True), nullable=False, index=True)
    candle_end_time = Column(DateTime(timezone=True), nullable=False)
    is_finalized = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        SQLIndex("idx_candle_symbol_start", "symbol", "candle_start_time", unique=True),
    )
