from typing import Dict, List, Optional
from pydantic import BaseModel
from app.schemas.market import OHLCVBar


class IndicatorPoint(BaseModel):
    time: int
    value: Optional[float] = None


class MACDPoint(BaseModel):
    time: int
    macd: Optional[float] = None
    signal: Optional[float] = None
    hist: Optional[float] = None


class BollingerBandsPoint(BaseModel):
    time: int
    upper: Optional[float] = None
    middle: Optional[float] = None
    lower: Optional[float] = None


class IndicatorAnalysisResponse(BaseModel):
    symbol: str
    timeframe: str = "1D"
    candles: List[OHLCVBar]
    indicators: Dict[str, List]  # key: "SMA_20", "EMA_20", "RSI_14", "MACD", "BB_20_2", "VWAP", "ATR_14"
    disclaimer: str = "For informational and educational purposes only. Not financial or investment advice."


class MarketNewsItem(BaseModel):
    id: str
    title: str
    publisher: str
    link: str
    published_at: str
    sentiment: str = "NEUTRAL"  # BULLISH | BEARISH | NEUTRAL
    related_symbols: List[str] = []


class MacroIndicatorItem(BaseModel):
    name: str
    symbol: str
    value: float
    change: float
    change_percent: float
    unit: str
    updated_at: str


class MacroSummaryResponse(BaseModel):
    usdinr: MacroIndicatorItem
    crude_oil: MacroIndicatorItem
    gold: MacroIndicatorItem
    updated_at: str
