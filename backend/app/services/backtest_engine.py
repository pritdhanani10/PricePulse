from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field

from app.strategies.candle_three_percent_strategy import CandleThreePercentStrategy
from app.strategies.models import CandleModel, StrategyConfig
from app.services.candle_service import candle_service


class BacktestRequest(BaseModel):
    symbol: str
    timeframe: str = "5m"
    buy_percent: float = 3.0
    sell_percent: float = 3.0
    buy_from: str = "LOW"
    sell_from: str = "HIGH"
    candle_limit: int = 150
    lifecycle_policy: str = "REPLACE_ON_NEW_CANDLE"


class BacktestSignal(BaseModel):
    signal_type: str  # BUY or SELL
    symbol: str
    reference_candle_time: datetime
    reference_price: float
    trigger_price: float
    actual_triggered_price: float
    triggered_candle_time: datetime
    price_change_from_trigger: Optional[float] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class BacktestResult(BaseModel):
    symbol: str
    timeframe: str
    total_candles_analyzed: int
    total_signals: int
    buy_signals: int
    sell_signals: int
    signals: List[BacktestSignal]
    summary: Dict[str, Any]
    disclaimer: str = (
        "Strategy-generated backtesting simulation for algorithmic analysis only. "
        "Past performance does not guarantee future results and is not financial/investment advice."
    )


class BacktestEngine:
    """
    Backtesting simulation engine with chronological execution and zero look-ahead bias.
    """

    @staticmethod
    async def run_backtest(request: BacktestRequest) -> BacktestResult:
        symbol = request.symbol.upper().strip()
        candles = await candle_service.get_historical_5m_candles(symbol, limit=request.candle_limit)

        if len(candles) < 2:
            return BacktestResult(
                symbol=symbol,
                timeframe=request.timeframe,
                total_candles_analyzed=len(candles),
                total_signals=0,
                buy_signals=0,
                sell_signals=0,
                signals=[],
                summary={"message": "Insufficient 5-minute historical candles for analysis."},
            )

        strategy = CandleThreePercentStrategy(
            config=StrategyConfig(
                timeframe=request.timeframe,
                buy_from=request.buy_from,  # type: ignore
                buy_percent=request.buy_percent,
                sell_from=request.sell_from,  # type: ignore
                sell_percent=request.sell_percent,
                lifecycle_policy=request.lifecycle_policy,  # type: ignore
            )
        )

        signals: List[BacktestSignal] = []
        buy_count = 0
        sell_count = 0

        # Chronological candle-by-candle simulation
        # Candle i is the finalized reference candle that sets triggers
        # Subsequent candles (i+1, ...) simulate the price movement
        for i in range(len(candles) - 1):
            ref_candle = candles[i]
            target_candle = candles[i + 1]

            # 1. Generate trigger definitions from reference candle i
            triggers = strategy.evaluate_candle(ref_candle)
            buy_trigger = next((t for t in triggers if t.signal_type == "BUY"), None)
            sell_trigger = next((t for t in triggers if t.signal_type == "SELL"), None)

            # 2. Check if target candle (i+1) crossed BUY trigger level
            # Condition: High of target candle >= BUY_TRIGGER_PRICE
            if buy_trigger and target_candle.high >= buy_trigger.trigger_price:
                actual_price = max(buy_trigger.trigger_price, target_candle.open)
                sig = BacktestSignal(
                    signal_type="BUY",
                    symbol=symbol,
                    reference_candle_time=ref_candle.candle_start_time,
                    reference_price=buy_trigger.reference_price,
                    trigger_price=buy_trigger.trigger_price,
                    actual_triggered_price=round(actual_price, 2),
                    triggered_candle_time=target_candle.candle_start_time,
                    price_change_from_trigger=round(((target_candle.close - actual_price) / actual_price) * 100, 2),
                    metadata={
                        "reference_low": ref_candle.low,
                        "target_candle_high": target_candle.high,
                        "target_candle_close": target_candle.close,
                    },
                )
                signals.append(sig)
                buy_count += 1

            # 3. Check if target candle (i+1) crossed SELL trigger level
            # Condition: Low of target candle <= SELL_TRIGGER_PRICE
            if sell_trigger and target_candle.low <= sell_trigger.trigger_price:
                actual_price = min(sell_trigger.trigger_price, target_candle.open)
                sig = BacktestSignal(
                    signal_type="SELL",
                    symbol=symbol,
                    reference_candle_time=ref_candle.candle_start_time,
                    reference_price=sell_trigger.reference_price,
                    trigger_price=sell_trigger.trigger_price,
                    actual_triggered_price=round(actual_price, 2),
                    triggered_candle_time=target_candle.candle_start_time,
                    price_change_from_trigger=round(((actual_price - target_candle.close) / actual_price) * 100, 2),
                    metadata={
                        "reference_high": ref_candle.high,
                        "target_candle_low": target_candle.low,
                        "target_candle_close": target_candle.close,
                    },
                )
                signals.append(sig)
                sell_count += 1

        return BacktestResult(
            symbol=symbol,
            timeframe=request.timeframe,
            total_candles_analyzed=len(candles),
            total_signals=len(signals),
            buy_signals=buy_count,
            sell_signals=sell_count,
            signals=signals,
            summary={
                "strategy": "5-Minute 3% Candle Strategy",
                "buy_rule": f"Low + {request.buy_percent}%",
                "sell_rule": f"High - {request.sell_percent}%",
                "candle_count": len(candles),
                "trigger_frequency_pct": round((len(signals) / max(1, len(candles))) * 100, 2),
            },
        )


backtest_engine = BacktestEngine()
