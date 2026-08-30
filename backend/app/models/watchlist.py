from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, generate_uuid


class Watchlist(Base, TimestampMixin):
    __tablename__ = "watchlists"

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
    name: Mapped[str] = mapped_column(String(100), default="My Watchlist", nullable=False)

    # Relationships
    user = relationship("User", back_populates="watchlists")
    items = relationship("WatchlistItem", back_populates="watchlist", cascade="all, delete-orphan")


class WatchlistItem(Base, TimestampMixin):
    __tablename__ = "watchlist_items"
    __table_args__ = (
        UniqueConstraint("watchlist_id", "instrument_id", name="uq_watchlist_instrument"),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_uuid,
        index=True,
    )
    watchlist_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("watchlists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    instrument_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("instruments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Relationships
    watchlist = relationship("Watchlist", back_populates="items")
    instrument = relationship("Instrument", back_populates="watchlist_items")
