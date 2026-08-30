from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class InstrumentBase(BaseModel):
    symbol: str
    name: str
    exchange: str = "NSE"
    instrument_type: str = "EQUITY"  # INDEX | EQUITY
    base_price: float
    tick_size: float = 0.05
    lot_size: float = 1


class InstrumentCreate(InstrumentBase):
    pass


class InstrumentResponse(InstrumentBase):
    id: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InstrumentQuote(BaseModel):
    symbol: str
    name: str
    exchange: str
    instrument_type: str
    price: float
    open: float
    high: float
    low: float
    close: float
    change: float
    change_percent: float
    volume: int
    timestamp: datetime
