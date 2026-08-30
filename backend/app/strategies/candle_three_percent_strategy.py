from datetime import datetime, timezone
from typing import List, Optional
from app.strategies.base import BaseStrategy
from app.strategies.models import CandleModel, StrategyConfig, TriggerDefinition, EvaluatedSignal
from app.schemas.market import MarketTick


class CandleThreePercentStrategy(BaseStrategy):
    """
    Automated 5-Minute 3% Candle Strategy.
    
    Rules:
    - For each finalized 5-minute candle:
      1. BUY Trigger: LOW * (1 + 3%) -> Signal when price >= BUY_TRIGGER_PRICE
      2. SELL Trigger: HIGH * (1 - 3%) -> Signal when price <= SELL_TRIGGER_PRICE
    """

    def __init__(self, config: Optional[StrategyConfig] = None):
        super().__init__(
            code="CANDLE_3_PERCENT_5M",
            name="5-Minute 3% Candle Breakout & Reversal Strategy",
            description="Generates dynamic BUY (Low + 3%) and SELL (High - 3%) triggers based on each completed 5-minute candle.",
        )
        self.config = config or StrategyConfig()

    def calculate_buy_trigger(self, reference_price: float) -> float:
        """BUY_TRIGGER_PRICE = LOW * (1 + buy_percent / 100)"""
        target = reference_price * (1.0 + (self.config.buy_percent / 100.0))
        return round(target, 2)

    def calculate_sell_trigger(self, reference_price: float) -> float:
        """SELL_TRIGGER_PRICE = HIGH * (1 - sell_percent / 100)"""
        target = reference_price * (1.0 - (self.config.sell_percent / 100.0))
        return round(target, 2)

    def evaluate_candle(self, candle: CandleModel) -> List[TriggerDefinition]:
        """
        Create BUY and SELL trigger definitions from a finalized 5-minute candle.
        """
        if not candle.is_finalized:
            return []

        # 1. Determine reference prices
        ref_low = candle.low if self.config.buy_from == "LOW" else candle.open
        ref_high = candle.high if self.config.sell_from == "HIGH" else candle.open

        buy_trigger_price = self.calculate_buy_trigger(ref_low)
        sell_trigger_price = self.calculate_sell_trigger(ref_high)

        triggers = [
            TriggerDefinition(
                signal_type="BUY",
                reference_price=ref_low,
                percentage=self.config.buy_percent,
                trigger_price=buy_trigger_price,
                reference_candle_time=candle.candle_start_time,
                symbol=candle.symbol.upper(),
                strategy_code=self.code,
            ),
            TriggerDefinition(
                signal_type="SELL",
                reference_price=ref_high,
                percentage=self.config.sell_percent,
                trigger_price=sell_trigger_price,
                reference_candle_time=candle.candle_start_time,
                symbol=candle.symbol.upper(),
                strategy_code=self.code,
            ),
        ]
        return triggers

    def evaluate_price(
        self,
        tick: MarketTick,
        active_triggers: List[TriggerDefinition],
    ) -> List[EvaluatedSignal]:
        """
        Evaluate live market tick against ACTIVE triggers for this symbol.
        """
        signals: List[EvaluatedSignal] = []
        current_price = tick.price
        now = datetime.now(timezone.utc)

        for trigger in active_triggers:
            if trigger.symbol.upper() != tick.symbol.upper():
                continue

            should_trigger = False
            if trigger.signal_type == "BUY" and current_price >= trigger.trigger_price:
                should_trigger = True
            elif trigger.signal_type == "SELL" and current_price <= trigger.trigger_price:
                should_trigger = True

            if should_trigger:
                signals.append(
                    EvaluatedSignal(
                        signal_type=trigger.signal_type,
                        symbol=trigger.symbol.upper(),
                        reference_candle_time=trigger.reference_candle_time,
                        reference_price=trigger.reference_price,
                        trigger_percent=trigger.percentage,
                        trigger_price=trigger.trigger_price,
                        actual_trigger_price=current_price,
                        triggered_at=now,
                        strategy_name=self.name,
                        metadata={
                            "strategy_code": self.code,
                            "timeframe": self.config.timeframe,
                            "tick_timestamp": tick.timestamp.isoformat() if hasattr(tick, "timestamp") and tick.timestamp else now.isoformat(),
                        },
                    )
                )

        return signals
