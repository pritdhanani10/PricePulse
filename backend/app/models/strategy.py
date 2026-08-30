import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Boolean, DateTime, JSON, ForeignKey, Index as SQLIndex
from sqlalchemy.orm import relationship
from app.models.base import Base


class TriggerStatus(str):
    ACTIVE = "ACTIVE"
    TRIGGERED = "TRIGGERED"
    EXPIRED = "EXPIRED"
    REPLACED = "REPLACED"
    CANCELLED = "CANCELLED"


class SignalType(str):
    BUY = "BUY"
    SELL = "SELL"


class Strategy(Base):
    __tablename__ = "strategies"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    code = Column(String(50), unique=True, nullable=False, index=True)  # e.g. "CANDLE_3_PERCENT_5M"
    description = Column(String(255), nullable=True)
    config_json = Column(JSON, nullable=False, default=dict)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    triggers = relationship("StrategyTrigger", back_populates="strategy", cascade="all, delete-orphan")
    signals = relationship("StrategySignal", back_populates="strategy", cascade="all, delete-orphan")


class StrategyTrigger(Base):
    __tablename__ = "strategy_triggers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    strategy_id = Column(String(36), ForeignKey("strategies.id", ondelete="CASCADE"), nullable=False, index=True)
    symbol = Column(String(30), nullable=False, index=True)
    index_id = Column(String(36), ForeignKey("indexes.id", ondelete="SET NULL"), nullable=True, index=True)
    reference_candle_id = Column(String(36), ForeignKey("candles_5m.id", ondelete="SET NULL"), nullable=True, index=True)
    
    signal_type = Column(String(10), nullable=False)  # BUY or SELL
    reference_price = Column(Float, nullable=False)  # LOW for BUY, HIGH for SELL
    percentage = Column(Float, nullable=False, default=3.0)  # 3.0
    trigger_price = Column(Float, nullable=False)  # Calculated trigger target price
    
    status = Column(String(20), default=TriggerStatus.ACTIVE, nullable=False, index=True)
    reference_candle_time = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    triggered_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    replaced_at = Column(DateTime(timezone=True), nullable=True)

    strategy = relationship("Strategy", back_populates="triggers")
    reference_candle = relationship("Candle5m")
    index = relationship("Index")
    signals = relationship("StrategySignal", back_populates="trigger")

    __table_args__ = (
        SQLIndex("idx_trigger_sym_status", "symbol", "status"),
    )


class StrategySignal(Base):
    __tablename__ = "strategy_signals"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    strategy_id = Column(String(36), ForeignKey("strategies.id", ondelete="CASCADE"), nullable=False, index=True)
    trigger_id = Column(String(36), ForeignKey("strategy_triggers.id", ondelete="SET NULL"), nullable=True, index=True)
    symbol = Column(String(30), nullable=False, index=True)
    index_id = Column(String(36), ForeignKey("indexes.id", ondelete="SET NULL"), nullable=True, index=True)
    
    signal_type = Column(String(10), nullable=False, index=True)  # BUY or SELL
    trigger_price = Column(Float, nullable=False)  # Planned target price
    actual_market_price = Column(Float, nullable=False)  # Executed market price on tick
    reference_price = Column(Float, nullable=True)  # Candle reference price
    trigger_percent = Column(Float, nullable=False, default=3.0)
    
    signal_time = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    reference_candle_time = Column(DateTime(timezone=True), nullable=True)
    metadata_json = Column(JSON, nullable=True, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    strategy = relationship("Strategy", back_populates="signals")
    trigger = relationship("StrategyTrigger", back_populates="signals")
    index = relationship("Index")

    __table_args__ = (
        SQLIndex("idx_signal_sym_time", "symbol", "signal_time"),
    )
