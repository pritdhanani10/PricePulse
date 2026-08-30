from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.instrument import Instrument
from app.schemas.analysis import IndicatorAnalysisResponse
from app.services.analysis_service import analysis_service
from app.services.market_data.factory import get_market_data_provider

router = APIRouter(prefix="/analysis", tags=["Technical Analysis"])


@router.get("/{symbol}", response_model=IndicatorAnalysisResponse)
async def get_technical_analysis(
    symbol: str,
    timeframe: str = Query("1D", description="'1D', '1H', or '15m'"),
    limit: int = Query(120, ge=20, le=500, description="Number of candles to calculate indicators for"),
    db: AsyncSession = Depends(get_db),
):
    """
    Compute full technical analysis indicators (SMA, EMA, RSI, MACD, Bollinger Bands, VWAP, ATR)
    for the requested symbol.
    """
    sym = symbol.upper().strip()
    inst_stmt = select(Instrument).where(Instrument.symbol == sym)
    inst = (await db.execute(inst_stmt)).scalar_one_or_none()
    if not inst:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Instrument '{symbol}' not found",
        )

    provider = get_market_data_provider()
    candles = await provider.get_historical_ohlcv(symbol=sym, timeframe=timeframe, limit=limit)
    
    if not candles:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Historical data unavailable for '{symbol}'",
        )

    result = analysis_service.compute_all_indicators(
        symbol=sym,
        candles=candles,
        timeframe=timeframe,
    )
    return result
