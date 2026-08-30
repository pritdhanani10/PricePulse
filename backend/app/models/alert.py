from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, generate_uuid


class Alert(Base, TimestampMixin):
    __tablename__ = "alerts"

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
    instrument_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("instruments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    alert_type: Mapped[str] = mapped_column(
        String(30),
        default="PERCENTAGE",
        nullable=False,
    )  # PERCENTAGE | ABSOLUTE
    reference_type: Mapped[str] = mapped_column(
        String(30),
        default="CURRENT_PRICE",
        nullable=False,
    )  # CURRENT_PRICE | MARKET_OPEN | CUSTOM
    reference_price: Mapped[float] = mapped_column(Float, nullable=False)

    direction: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        index=True,
    )  # UP | DOWN
    threshold_percent: Mapped[float] = mapped_column(Float, nullable=False)
    target_price: Mapped[float] = mapped_column(Float, nullable=False, index=True)

    status: Mapped[str] = mapped_column(
        String(20),
        default="ACTIVE",
        nullable=False,
        index=True,
    )  # ACTIVE | TRIGGERED | DISABLED | CANCELLED
    triggered_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    user = relationship("User", back_populates="alerts")
    instrument = relationship("Instrument", back_populates="alerts")
    history_entries = relationship("AlertHistory", back_populates="alert", cascade="all, delete-orphan")


class AlertHistory(Base, TimestampMixin):
    __tablename__ = "alert_history"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_uuid,
        index=True,
    )
    alert_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("alerts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    instrument_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("instruments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    direction: Mapped[str] = mapped_column(String(10), nullable=False)
    trigger_price: Mapped[float] = mapped_column(Float, nullable=False)
    target_price: Mapped[float] = mapped_column(Float, nullable=False)
    reference_price: Mapped[float] = mapped_column(Float, nullable=False)
    
    notification_channel: Mapped[str] = mapped_column(String(30), default="IN_APP", nullable=False)
    notification_status: Mapped[str] = mapped_column(String(20), default="SENT", nullable=False)
    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    # Relationships
    alert = relationship("Alert", back_populates="history_entries")
    user = relationship("User", back_populates="alert_history")
    instrument = relationship("Instrument", back_populates="alert_history")
