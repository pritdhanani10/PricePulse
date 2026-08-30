from abc import ABC, abstractmethod
from typing import List, Optional
from app.strategies.models import CandleModel, TriggerDefinition, EvaluatedSignal
from app.schemas.market import MarketTick


class BaseStrategy(ABC):
    """Abstract Base Strategy Interface."""

    def __init__(self, code: str, name: str, description: str):
        self.code = code
        self.name = name
        self.description = description

    @abstractmethod
    def evaluate_candle(self, candle: CandleModel) -> List[TriggerDefinition]:
        """
        Evaluate a finalized candle and generate trigger definitions (e.g. BUY / SELL triggers).
        Must only be called on closed/finalized candles.
        """
        pass

    @abstractmethod
    def evaluate_price(
        self,
        tick: MarketTick,
        active_triggers: List[TriggerDefinition],
    ) -> List[EvaluatedSignal]:
        """
        Evaluate a live market price tick against active triggers.
        """
        pass
