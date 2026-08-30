from datetime import datetime
from typing import Dict, List, Literal, Optional, Any
from pydantic import BaseModel, Field


class CandleModel(BaseModel):
    symbol: str
    timeframe: str = "5m"
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0
    candle_start_time: datetime
    candle_end_time: datetime
    is_finalized: bool = True


class StrategyConfig(BaseModel):
    timeframe: str = "5m"
    buy_from: Literal["LOW", "OPEN", "CLOSE"] = "LOW"
    buy_percent: float = 3.0
    sell_from: Literal["HIGH", "OPEN", "CLOSE"] = "HIGH"
    sell_percent: float = 3.0
    lifecycle_policy: Literal["REPLACE_ON_NEW_CANDLE", "EXPIRE_ON_NEW_CANDLE", "ACTIVE_UNTIL_HIT"] = "REPLACE_ON_NEW_CANDLE"


class TriggerDefinition(BaseModel):
    signal_type: Literal["BUY", "SELL"]
    reference_price: float
    percentage: float
    trigger_price: float
    reference_candle_time: datetime
    symbol: str
    index_id: Optional[str] = None
    strategy_code: str = "CANDLE_3_PERCENT_5M"


class EvaluatedSignal(BaseModel):
    signal_type: Literal["BUY", "SELL"]
    symbol: str
    index_category: Optional[str] = None
    reference_candle_time: datetime
    reference_price: float
    trigger_percent: float
    trigger_price: float
    actual_trigger_price: float
    triggered_at: datetime
    strategy_name: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
