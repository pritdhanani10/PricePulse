from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.instrument import InstrumentResponse


class WatchlistItemResponse(BaseModel):
    id: str
    watchlist_id: str
    instrument_id: str
    instrument: InstrumentResponse
    auto_monitor: bool = True
    strategy_code: str = "CANDLE_3_PERCENT_5M"
    buy_percent: float = 3.0
    sell_percent: float = 3.0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WatchlistBase(BaseModel):
    name: str = "My Watchlist"


class WatchlistCreate(WatchlistBase):
    pass


class WatchlistResponse(WatchlistBase):
    id: str
    user_id: str
    items: List[WatchlistItemResponse] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AddWatchlistItemRequest(BaseModel):
    instrument_id: str
    auto_monitor: bool = True
    strategy_code: str = "CANDLE_3_PERCENT_5M"
    buy_percent: float = 3.0
    sell_percent: float = 3.0


class UpdateWatchlistItemRequest(BaseModel):
    auto_monitor: Optional[bool] = None
    strategy_code: Optional[str] = None
    buy_percent: Optional[float] = None
    sell_percent: Optional[float] = None


class UserNotificationResponse(BaseModel):
    id: str
    user_id: str
    watchlist_id: Optional[str] = None
    instrument_id: Optional[str] = None
    symbol: str
    signal_id: Optional[str] = None
    notification_type: str = "WATCHLIST_SIGNAL"
    title: str
    message: str
    signal_type: Optional[str] = None  # BUY | SELL
    trigger_price: Optional[float] = None
    market_price: Optional[float] = None
    reference_price: Optional[float] = None
    is_read: bool = False
    read_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationListResponse(BaseModel):
    total: int
    unread_count: int
    notifications: List[UserNotificationResponse]


class AutoMonitorItemSummary(BaseModel):
    watchlist_id: str
    watchlist_name: str
    item_id: str
    instrument_id: str
    symbol: str
    name: str
    instrument_type: str
    auto_monitor: bool
    current_price: float
    buy_trigger_price: Optional[float] = None
    buy_percent: float = 3.0
    buy_distance_percent: Optional[float] = None
    sell_trigger_price: Optional[float] = None
    sell_percent: float = 3.0
    sell_distance_percent: Optional[float] = None
    reference_candle_time: Optional[str] = None
    last_signal_type: Optional[str] = None
    last_signal_time: Optional[str] = None
