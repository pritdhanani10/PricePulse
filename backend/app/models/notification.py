from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, generate_uuid


class UserNotification(Base, TimestampMixin):
    __tablename__ = "user_notifications"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_uuid,
        index=True,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    watchlist_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("watchlists.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    instrument_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("instruments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    symbol: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    signal_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("strategy_signals.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    notification_type: Mapped[str] = mapped_column(
        String(30),
        default="WATCHLIST_SIGNAL",
        nullable=False,
        index=True,
    )  # WATCHLIST_SIGNAL | PRICE_ALERT
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    
    signal_type: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # BUY | SELL
    trigger_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    market_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    reference_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user = relationship("User", back_populates="notifications")
    watchlist = relationship("Watchlist")
    instrument = relationship("Instrument")
    signal = relationship("StrategySignal")
