from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class MarketTick(BaseModel):
    symbol: str
    price: float
    open: float
    high: float
    low: float
    close: float
    change: float
    change_percent: float
    volume: Optional[int] = 0
    timestamp: datetime
    source: str = "MOCK"


class OHLCVBar(BaseModel):
    time: int  # Unix timestamp (seconds)
    open: float
    high: float
    low: float
    close: float
    volume: float


class MarketStatus(BaseModel):
    is_open: bool
    status_text: str
    market_time: str
    session: str  # "REGULAR", "PRE_OPEN", "CLOSED"
    next_open: Optional[str] = None
    next_close: Optional[str] = None
