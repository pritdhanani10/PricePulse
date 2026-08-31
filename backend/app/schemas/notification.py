from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionCreate(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys
    user_agent: Optional[str] = None


class PushSubscriptionResponse(BaseModel):
    id: str
    user_id: str
    endpoint: str
    user_agent: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VapidPublicKeyResponse(BaseModel):
    public_key: str


class UserNotificationResponse(BaseModel):
    id: str
    user_id: str
    watchlist_id: Optional[str] = None
    instrument_id: Optional[str] = None
    symbol: str
    signal_id: Optional[str] = None
    notification_type: str = "WATCHLIST_SIGNAL"  # WATCHLIST_SIGNAL | PRICE_ALERT | SYSTEM_TEST
    title: str
    message: str
    signal_type: Optional[str] = None  # BUY | SELL | UP | DOWN
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
