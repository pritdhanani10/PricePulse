from typing import Dict, List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.strategies.models import StrategyConfig, CandleModel
from app.services.strategy_service import strategy_service
from app.services.signal_service import signal_service
from app.services.candle_service import candle_service
from app.services.backtest_engine import backtest_engine, BacktestRequest, BacktestResult
from app.services.market_data.factory import get_market_data_provider

router = APIRouter(prefix="/strategy", tags=["Strategy & Signals"])


@router.get("/config", response_model=dict)
async def get_strategy_configuration():
    """Get the active parameters for the 5-minute 3% candle strategy."""
    strat = strategy_service.get_strategy()
    return {
        "strategy_name": strat.name,
        "strategy_code": strat.code,
        "description": strat.description,
        "config": strat.config.model_dump(),
    }


@router.post("/config", response_model=dict)
async def update_strategy_configuration(config: StrategyConfig):
    """Update configurable strategy parameters (e.g. buy_percent, sell_percent, lifecycle_policy)."""
    updated = strategy_service.update_config(config)
    return {
        "status": "success",
        "message": "Strategy configuration updated successfully.",
        "config": updated.model_dump(),
    }


@router.get("/triggers/active", response_model=List[dict])
async def get_active_strategy_triggers(
    symbol: Optional[str] = Query(None, description="Optional stock symbol to filter triggers"),
):
    """Fetch currently ACTIVE strategy triggers (BUY and SELL targets)."""
    return await strategy_service.get_active_triggers(symbol=symbol)


@router.get("/signals", response_model=List[dict])
async def get_strategy_signals(
    symbol: Optional[str] = Query(None, description="Filter by stock symbol"),
    signal_type: Optional[str] = Query(None, description="Filter by signal type (BUY / SELL)"),
    index_id: Optional[str] = Query(None, description="Filter by index ID"),
    limit: int = Query(50, ge=1, le=200, description="Max number of signals to return"),
):
    """Fetch generated Strategy Signal history with filters."""
    return await signal_service.get_signals(
        symbol=symbol,
        signal_type=signal_type,
        index_id=index_id,
        limit=limit,
    )


@router.get("/candles/{symbol}", response_model=dict)
async def get_symbol_5m_candles(
    symbol: str,
    limit: int = Query(60, ge=5, le=300, description="Number of 5-minute candles to return"),
):
    """Fetch normalized 5-minute candles and latest completed candle stats for a stock."""
    sym = symbol.upper().strip()
    candles = await candle_service.get_historical_5m_candles(sym, limit=limit)
    latest_completed = await candle_service.get_latest_completed_candle(sym)
    provider = get_market_data_provider()
    quote = await provider.get_quote(sym)

    return {
        "symbol": sym,
        "timeframe": "5m",
        "current_price": quote.price if quote else (latest_completed.close if latest_completed else None),
        "total_candles": len(candles),
        "latest_completed_candle": latest_completed.model_dump(mode="json") if latest_completed else None,
        "candles": [c.model_dump(mode="json") for c in candles],
    }


@router.post("/backtest", response_model=BacktestResult)
async def run_strategy_backtest(request: BacktestRequest):
    """Execute a chronological backtest simulation for the 5-minute strategy."""
    return await backtest_engine.run_backtest(request)
