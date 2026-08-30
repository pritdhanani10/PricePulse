from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.instrument import InstrumentResponse


class WatchlistItemResponse(BaseModel):
    id: str
    watchlist_id: str
    instrument_id: str
    instrument: InstrumentResponse
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
