from typing import Dict, List, Optional
import numpy as np
import pandas as pd
from app.schemas.analysis import BollingerBandsPoint, IndicatorAnalysisResponse, IndicatorPoint, MACDPoint
from app.schemas.market import OHLCVBar


class TechnicalAnalysisService:
    """Calculates standardized technical analysis indicators from OHLCV candlestick bars."""

    @staticmethod
    def _ohlcv_to_dataframe(candles: List[OHLCVBar]) -> pd.DataFrame:
        if not candles:
            return pd.DataFrame(columns=["time", "open", "high", "low", "close", "volume"])
        
        data = [
            {
                "time": c.time,
                "open": float(c.open),
                "high": float(c.high),
                "low": float(c.low),
                "close": float(c.close),
                "volume": float(c.volume),
            }
            for c in candles
        ]
        df = pd.DataFrame(data)
        df.sort_values("time", inplace=True)
        df.reset_index(drop=True, inplace=True)
        return df

    @staticmethod
    def calculate_sma(series: pd.Series, period: int = 20) -> pd.Series:
        """Simple Moving Average."""
        return series.rolling(window=period, min_periods=1).mean()

    @staticmethod
    def calculate_ema(series: pd.Series, period: int = 20) -> pd.Series:
        """Exponential Moving Average."""
        return series.ewm(span=period, adjust=False).mean()

    @staticmethod
    def calculate_rsi(series: pd.Series, period: int = 14) -> pd.Series:
        """Relative Strength Index (Wilder's Smoothing)."""
        delta = series.diff()
        gain = (delta.where(delta > 0, 0.0)).fillna(0.0)
        loss = (-delta.where(delta < 0, 0.0)).fillna(0.0)

        # Wilder's exponential smoothing: alpha = 1 / period
        avg_gain = gain.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
        avg_loss = loss.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()

        # Handle pure gain / pure loss division
        rsi = pd.Series(index=series.index, dtype=float)
        both_zero = (avg_gain == 0) & (avg_loss == 0)
        pure_gain = (avg_gain > 0) & (avg_loss == 0)
        pure_loss = (avg_gain == 0) & (avg_loss > 0)
        normal = (avg_loss > 0)

        rs = avg_gain[normal] / avg_loss[normal]
        rsi[normal] = 100.0 - (100.0 / (1.0 + rs))
        rsi[pure_gain] = 100.0
        rsi[pure_loss] = 0.0
        rsi[both_zero] = 50.0

        return rsi.fillna(50.0)

    @staticmethod
    def calculate_macd(
        series: pd.Series,
        fast_period: int = 12,
        slow_period: int = 26,
        signal_period: int = 9,
    ) -> Dict[str, pd.Series]:
        """Moving Average Convergence Divergence (MACD, Signal line, Histogram)."""
        fast_ema = series.ewm(span=fast_period, adjust=False).mean()
        slow_ema = series.ewm(span=slow_period, adjust=False).mean()
        macd_line = fast_ema - slow_ema
        signal_line = macd_line.ewm(span=signal_period, adjust=False).mean()
        hist = macd_line - signal_line
        return {
            "macd": macd_line,
            "signal": signal_line,
            "hist": hist,
        }

    @staticmethod
    def calculate_bollinger_bands(
        series: pd.Series,
        period: int = 20,
        std_multiplier: float = 2.0,
    ) -> Dict[str, pd.Series]:
        """Bollinger Bands (Upper, Middle SMA, Lower)."""
        middle = series.rolling(window=period, min_periods=1).mean()
        std = series.rolling(window=period, min_periods=1).std().fillna(0)
        upper = middle + (std * std_multiplier)
        lower = middle - (std * std_multiplier)
        return {
            "upper": upper,
            "middle": middle,
            "lower": lower,
        }

    @staticmethod
    def calculate_vwap(df: pd.DataFrame) -> pd.Series:
        """Volume Weighted Average Price."""
        typical_price = (df["high"] + df["low"] + df["close"]) / 3.0
        cum_volume = df["volume"].cumsum()
        cum_pv = (typical_price * df["volume"]).cumsum()
        vwap = cum_pv / cum_volume.replace(0, np.nan)
        return vwap.bfill().ffill()

    @staticmethod
    def calculate_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
        """Average True Range."""
        high = df["high"]
        low = df["low"]
        prev_close = df["close"].shift(1)

        tr1 = high - low
        tr2 = (high - prev_close).abs()
        tr3 = (low - prev_close).abs()
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)

        atr = tr.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
        return atr.bfill().ffill()

    def compute_all_indicators(
        self,
        symbol: str,
        candles: List[OHLCVBar],
        timeframe: str = "1D",
    ) -> IndicatorAnalysisResponse:
        """Compute full suite of technical indicators for chart overlay."""
        df = self._ohlcv_to_dataframe(candles)
        
        if df.empty:
            return IndicatorAnalysisResponse(
                symbol=symbol,
                timeframe=timeframe,
                candles=[],
                indicators={},
            )

        close = df["close"]
        sma_20 = self.calculate_sma(close, 20)
        sma_50 = self.calculate_sma(close, 50)
        ema_20 = self.calculate_ema(close, 20)
        rsi_14 = self.calculate_rsi(close, 14)
        macd_dict = self.calculate_macd(close, 12, 26, 9)
        bb_dict = self.calculate_bollinger_bands(close, 20, 2.0)
        vwap = self.calculate_vwap(df)
        atr_14 = self.calculate_atr(df, 14)

        times = df["time"].tolist()

        # Format indicator arrays
        indicators = {
            "SMA_20": [
                {"time": t, "value": round(v, 2) if not pd.isna(v) else None}
                for t, v in zip(times, sma_20)
            ],
            "SMA_50": [
                {"time": t, "value": round(v, 2) if not pd.isna(v) else None}
                for t, v in zip(times, sma_50)
            ],
            "EMA_20": [
                {"time": t, "value": round(v, 2) if not pd.isna(v) else None}
                for t, v in zip(times, ema_20)
            ],
            "RSI_14": [
                {"time": t, "value": round(v, 2) if not pd.isna(v) else None}
                for t, v in zip(times, rsi_14)
            ],
            "MACD": [
                {
                    "time": t,
                    "macd": round(m, 2) if not pd.isna(m) else None,
                    "signal": round(s, 2) if not pd.isna(s) else None,
                    "hist": round(h, 2) if not pd.isna(h) else None,
                }
                for t, m, s, h in zip(times, macd_dict["macd"], macd_dict["signal"], macd_dict["hist"])
            ],
            "BB_20_2": [
                {
                    "time": t,
                    "upper": round(u, 2) if not pd.isna(u) else None,
                    "middle": round(m, 2) if not pd.isna(m) else None,
                    "lower": round(l, 2) if not pd.isna(l) else None,
                }
                for t, u, m, l in zip(times, bb_dict["upper"], bb_dict["middle"], bb_dict["lower"])
            ],
            "VWAP": [
                {"time": t, "value": round(v, 2) if not pd.isna(v) else None}
                for t, v in zip(times, vwap)
            ],
            "ATR_14": [
                {"time": t, "value": round(v, 2) if not pd.isna(v) else None}
                for t, v in zip(times, atr_14)
            ],
        }

        return IndicatorAnalysisResponse(
            symbol=symbol,
            timeframe=timeframe,
            candles=candles,
            indicators=indicators,
        )


analysis_service = TechnicalAnalysisService()
