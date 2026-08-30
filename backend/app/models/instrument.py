from sqlalchemy import Boolean, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, generate_uuid


class Instrument(Base, TimestampMixin):
    __tablename__ = "instruments"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_uuid,
        index=True,
    )
    symbol: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    exchange: Mapped[str] = mapped_column(String(20), default="NSE", nullable=False)
    instrument_type: Mapped[str] = mapped_column(String(30), default="EQUITY", nullable=False)  # INDEX | EQUITY
    base_price: Mapped[float] = mapped_column(Float, default=100.0, nullable=False)
    tick_size: Mapped[float] = mapped_column(Float, default=0.05, nullable=False)
    lot_size: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    alerts = relationship("Alert", back_populates="instrument", cascade="all, delete-orphan")
    alert_history = relationship("AlertHistory", back_populates="instrument", cascade="all, delete-orphan")
    watchlist_items = relationship("WatchlistItem", back_populates="instrument", cascade="all, delete-orphan")
