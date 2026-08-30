from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.instrument import InstrumentResponse


class AlertBase(BaseModel):
    instrument_id: str
    direction: str = Field(..., description="'UP' or 'DOWN'")
    reference_type: str = Field(default="CURRENT_PRICE", description="'CURRENT_PRICE', 'MARKET_OPEN', or 'CUSTOM'")
    reference_price: Optional[float] = None
    threshold_percent: float = Field(..., gt=0, description="Percentage threshold (e.g. 3.0 for 3%)")


class AlertCreate(AlertBase):
    pass


class DualAlertCreate(BaseModel):
    """Convenience schema to create both UP and DOWN triggers in a single request."""
    instrument_id: str
    reference_type: str = "CURRENT_PRICE"
    reference_price: Optional[float] = None
    up_percentage: Optional[float] = Field(None, gt=0)
    down_percentage: Optional[float] = Field(None, gt=0)


class AlertUpdate(BaseModel):
    status: Optional[str] = None  # ACTIVE, DISABLED, CANCELLED
    threshold_percent: Optional[float] = Field(None, gt=0)


class AlertResponse(BaseModel):
    id: str
    user_id: str
    instrument_id: str
    alert_type: str
    reference_type: str
    reference_price: float
    direction: str
    threshold_percent: float
    target_price: float
    status: str
    triggered_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    instrument: Optional[InstrumentResponse] = None

    model_config = ConfigDict(from_attributes=True)


class AlertHistoryResponse(BaseModel):
    id: str
    alert_id: str
    user_id: str
    instrument_id: str
    direction: str
    trigger_price: float
    target_price: float
    reference_price: float
    notification_channel: str
    notification_status: str
    triggered_at: datetime
    instrument: Optional[InstrumentResponse] = None

    model_config = ConfigDict(from_attributes=True)
