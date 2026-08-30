import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.models.base import Base


class IndexCategory(str):
    MIDCAP = "MIDCAP"
    SMALLCAP = "SMALLCAP"
    MICROCAP = "MICROCAP"


class Index(Base):
    __tablename__ = "indexes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    symbol = Column(String(30), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    category = Column(String(20), nullable=False, index=True)  # MIDCAP, SMALLCAP, MICROCAP
    exchange = Column(String(10), default="NSE", nullable=False)
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    constituents = relationship("IndexConstituent", back_populates="index", cascade="all, delete-orphan")


class IndexConstituent(Base):
    __tablename__ = "index_constituents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    index_id = Column(String(36), ForeignKey("indexes.id", ondelete="CASCADE"), nullable=False, index=True)
    instrument_id = Column(String(36), ForeignKey("instruments.id", ondelete="CASCADE"), nullable=False, index=True)
    weightage = Column(Float, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    index = relationship("Index", back_populates="constituents")
    instrument = relationship("Instrument")
