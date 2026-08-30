import asyncio
from datetime import datetime, time, timedelta, timezone
import math
import random
from typing import AsyncGenerator, Dict, List, Optional
import numpy as np
from app.core.config import settings
from app.schemas.market import MarketStatus, MarketTick, OHLCVBar
from app.services.market_data.base import MarketDataProvider
from app.services.market_data.market_hours import get_indian_market_status

# Realistic baseline prices for Indian Market Instruments
DEFAULT_MARKET_INSTRUMENTS = {
    # Benchmark Indices
    "NIFTY50": {"name": "NIFTY 50", "price": 25150.0, "type": "INDEX", "volatility": 0.0012},
    "BANKNIFTY": {"name": "NIFTY BANK", "price": 51400.0, "type": "INDEX", "volatility": 0.0018},
    "FINNIFTY": {"name": "NIFTY FINANCIAL SERVICES", "price": 23650.0, "type": "INDEX", "volatility": 0.0015},
    "NIFTY_MIDCAP_100": {"name": "NIFTY Midcap 100", "price": 58240.0, "type": "INDEX", "volatility": 0.0022},
    "NIFTY_SMALLCAP_100": {"name": "NIFTY Smallcap 100", "price": 18450.0, "type": "INDEX", "volatility": 0.0028},
    "NIFTY_MICROCAP_250": {"name": "NIFTY Microcap 250", "price": 21890.0, "type": "INDEX", "volatility": 0.0035},

    # Large Cap Equities
    "RELIANCE": {"name": "Reliance Industries Ltd", "price": 2985.50, "type": "EQUITY", "volatility": 0.0020},
    "TCS": {"name": "Tata Consultancy Services Ltd", "price": 4180.25, "type": "EQUITY", "volatility": 0.0016},
    "HDFCBANK": {"name": "HDFC Bank Ltd", "price": 1645.80, "type": "EQUITY", "volatility": 0.0019},
    "INFY": {"name": "Infosys Ltd", "price": 1785.40, "type": "EQUITY", "volatility": 0.0022},
    "ICICIBANK": {"name": "ICICI Bank Ltd", "price": 1215.30, "type": "EQUITY", "volatility": 0.0021},
    "TATAMOTORS": {"name": "Tata Motors Ltd", "price": 1045.60, "type": "EQUITY", "volatility": 0.0028},
    "SBIN": {"name": "State Bank of India", "price": 815.20, "type": "EQUITY", "volatility": 0.0024},
    "BHARTIARTL": {"name": "Bharti Airtel Ltd", "price": 1560.75, "type": "EQUITY", "volatility": 0.0018},
    "ITC": {"name": "ITC Ltd", "price": 495.30, "type": "EQUITY", "volatility": 0.0014},
    "ZOMATO": {"name": "Zomato Ltd", "price": 250.0, "type": "EQUITY", "volatility": 0.0032},

    # NIFTY MIDCAP Constituents
    "DIXON": {"name": "Dixon Technologies (India) Ltd", "price": 12450.0, "type": "EQUITY", "volatility": 0.0035},
    "TATAELXSI": {"name": "Tata Elxsi Ltd", "price": 7120.0, "type": "EQUITY", "volatility": 0.0030},
    "POLYCAB": {"name": "Polycab India Ltd", "price": 6450.0, "type": "EQUITY", "volatility": 0.0029},
    "PERSISTENT": {"name": "Persistent Systems Ltd", "price": 4890.0, "type": "EQUITY", "volatility": 0.0032},
    "COFORGE": {"name": "Coforge Ltd", "price": 6240.0, "type": "EQUITY", "volatility": 0.0031},
    "MPHASIS": {"name": "Mphasis Ltd", "price": 2980.0, "type": "EQUITY", "volatility": 0.0028},
    "FEDERALBNK": {"name": "The Federal Bank Ltd", "price": 188.50, "type": "EQUITY", "volatility": 0.0025},
    "ASTRAL": {"name": "Astral Ltd", "price": 1875.0, "type": "EQUITY", "volatility": 0.0027},
    "VOLTAS": {"name": "Voltas Ltd", "price": 1680.0, "type": "EQUITY", "volatility": 0.0030},
    "ASHOKLEY": {"name": "Ashok Leyland Ltd", "price": 245.0, "type": "EQUITY", "volatility": 0.0028},

    # NIFTY SMALLCAP Constituents
    "TEJASNET": {"name": "Tejas Networks Ltd", "price": 1180.0, "type": "EQUITY", "volatility": 0.0042},
    "CDSL": {"name": "Central Depository Services (India) Ltd", "price": 1480.0, "type": "EQUITY", "volatility": 0.0038},
    "ANGELONE": {"name": "Angel One Ltd", "price": 2620.0, "type": "EQUITY", "volatility": 0.0040},
    "BSE": {"name": "BSE Ltd", "price": 2450.0, "type": "EQUITY", "volatility": 0.0039},
    "CENTURYPLY": {"name": "Century Plyboards (India) Ltd", "price": 760.0, "type": "EQUITY", "volatility": 0.0032},
    "RADICO": {"name": "Radico Khaitan Ltd", "price": 1920.0, "type": "EQUITY", "volatility": 0.0035},
    "KAYNES": {"name": "Kaynes Technology India Ltd", "price": 4650.0, "type": "EQUITY", "volatility": 0.0045},
    "CYIENT": {"name": "Cyient Ltd", "price": 1890.0, "type": "EQUITY", "volatility": 0.0036},
    "CAMS": {"name": "Computer Age Management Services Ltd", "price": 4150.0, "type": "EQUITY", "volatility": 0.0034},
    "SONATSOFTW": {"name": "Sonata Software Ltd", "price": 620.0, "type": "EQUITY", "volatility": 0.0037},

    # NIFTY MICROCAP Constituents
    "MARKSANS": {"name": "Marksans Pharma Ltd", "price": 245.0, "type": "EQUITY", "volatility": 0.0048},
    "SUBEX": {"name": "Subex Ltd", "price": 38.50, "type": "EQUITY", "volatility": 0.0055},
    "INFIBEAM": {"name": "Infibeam Avenues Ltd", "price": 32.40, "type": "EQUITY", "volatility": 0.0052},
    "DCMSHRIRAM": {"name": "DCM Shriram Ltd", "price": 1080.0, "type": "EQUITY", "volatility": 0.0040},
    "RANEHOLDIN": {"name": "Rane Holdings Ltd", "price": 1650.0, "type": "EQUITY", "volatility": 0.0044},
    "GEOJITFSL": {"name": "Geojit Financial Services Ltd", "price": 135.0, "type": "EQUITY", "volatility": 0.0050},
    "SAKSOFT": {"name": "Saksoft Ltd", "price": 265.0, "type": "EQUITY", "volatility": 0.0046},
    "NELCO": {"name": "Nelco Ltd", "price": 890.0, "type": "EQUITY", "volatility": 0.0045},
    "HGINFRA": {"name": "H.G. Infra Engineering Ltd", "price": 1420.0, "type": "EQUITY", "volatility": 0.0042},
    "ORIENTCEM": {"name": "Orient Cement Ltd", "price": 310.0, "type": "EQUITY", "volatility": 0.0047},
}



class MockMarketDataProvider(MarketDataProvider):
    """Simulated Indian Market Provider using Geometric Brownian Motion with Mean Reversion."""

    def __init__(self):
        self._subscribed_symbols: set = set(DEFAULT_MARKET_INSTRUMENTS.keys())
        self._state: Dict[str, Dict] = {}
        self._running: bool = False
        self._simulation_active: bool = True
        self._initialize_state()

    def is_simulation_enabled(self) -> bool:
        return self._simulation_active

    def set_simulation_state(self, enabled: bool) -> bool:
        self._simulation_active = enabled
        return self._simulation_active

    def _initialize_state(self) -> None:
        for sym, meta in DEFAULT_MARKET_INSTRUMENTS.items():
            self._ensure_symbol_state(
                symbol=sym,
                base_price=meta["price"],
                name=meta["name"],
                inst_type=meta["type"],
                volatility=meta["volatility"],
            )

    def _ensure_symbol_state(
        self,
        symbol: str,
        base_price: Optional[float] = None,
        name: Optional[str] = None,
        inst_type: Optional[str] = None,
        volatility: Optional[float] = None,
    ) -> Dict:
        """Ensure an instrument's live state dictionary exists and is initialized."""
        sym = symbol.upper().strip()
        if sym not in self._state:
            now = datetime.now(timezone.utc)
            meta = DEFAULT_MARKET_INSTRUMENTS.get(sym, {})
            base = base_price or meta.get("price", 500.0)
            inst_name = name or meta.get("name", sym)
            itype = inst_type or meta.get("type", "EQUITY")
            vol = volatility or meta.get("volatility", 0.002)

            # Intraday open price within +/- 0.5% of baseline
            open_price = round(base * (1 + random.uniform(-0.005, 0.005)), 2)
            self._state[sym] = {
                "symbol": sym,
                "name": inst_name,
                "type": itype,
                "base_price": base,
                "open": open_price,
                "high": open_price,
                "low": open_price,
                "close": open_price,
                "price": open_price,
                "volume": random.randint(50000, 1000000),
                "volatility": vol,
                "last_update": now,
            }
            self._subscribed_symbols.add(sym)
        return self._state[sym]

    async def connect(self) -> None:
        self._running = True

    async def disconnect(self) -> None:
        self._running = False

    async def subscribe(self, symbols: List[str]) -> None:
        for s in symbols:
            sym = s.upper().strip()
            self._subscribed_symbols.add(sym)
            self._ensure_symbol_state(sym)

    async def unsubscribe(self, symbols: List[str]) -> None:
        for s in symbols:
            self._subscribed_symbols.discard(s.upper().strip())

    async def get_latest_price(self, symbol: str) -> Optional[float]:
        sym = symbol.upper().strip()
        st = self._ensure_symbol_state(sym)
        return st["price"]

    async def get_quote(self, symbol: str) -> Optional[MarketTick]:
        sym = symbol.upper().strip()
        st = self._ensure_symbol_state(sym)
        open_price = max(0.01, st["open"])
        change = round(st["price"] - open_price, 2)
        change_pct = round((change / open_price) * 100, 2)
        return MarketTick(
            symbol=sym,
            price=st["price"],
            open=st["open"],
            high=st["high"],
            low=st["low"],
            close=st["close"],
            change=change,
            change_percent=change_pct,
            volume=st["volume"],
            timestamp=st["last_update"],
            source="MOCK",
        )

    def _simulate_tick(self, symbol: str) -> MarketTick:
        sym = symbol.upper().strip()
        st = self._ensure_symbol_state(sym)
        vol = st["volatility"]
        current = st["price"]
        
        # Mean reversion pull towards base price + random Gaussian shock
        mean_reversion = (st["base_price"] - current) * 0.005
        shock = float(np.random.normal(0, vol * current))
        new_price = round(current + mean_reversion + shock, 2)

        # Ensure price never drops below 0.05
        new_price = max(0.05, new_price)

        # Update high, low, volume
        st["price"] = new_price
        st["high"] = max(st["high"], new_price)
        st["low"] = min(st["low"], new_price)
        st["volume"] += random.randint(10, 500)
        st["last_update"] = datetime.now(timezone.utc)

        open_price = max(0.01, st["open"])
        change = round(new_price - open_price, 2)
        change_pct = round((change / open_price) * 100, 2)

        return MarketTick(
            symbol=sym,
            price=new_price,
            open=st["open"],
            high=st["high"],
            low=st["low"],
            close=st["close"],
            change=change,
            change_percent=change_pct,
            volume=st["volume"],
            timestamp=st["last_update"],
            source="MOCK",
        )

    async def stream_ticks(self) -> AsyncGenerator[MarketTick, None]:
        """Continuously yield simulated ticks for all subscribed symbols."""
        while self._running:
            market_status = self.get_market_status()
            
            # Check if simulation should generate price movements
            should_simulate = self._simulation_active
            if (settings.RESPECT_MARKET_HOURS or not settings.SIMULATE_WHEN_CLOSED) and not market_status.is_open:
                should_simulate = False

            symbols = list(self._subscribed_symbols)
            random.shuffle(symbols)
            
            for symbol in symbols:
                if not self._running:
                    break
                if should_simulate:
                    tick = self._simulate_tick(symbol)
                else:
                    # Return static frozen quote without price movement
                    tick = await self.get_quote(symbol)
                
                if tick:
                    yield tick

            await asyncio.sleep(settings.TICK_INTERVAL_SECONDS)

    async def get_historical_ohlcv(
        self,
        symbol: str,
        timeframe: str = "1D",
        limit: int = 100,
    ) -> List[OHLCVBar]:
        """Generate realistic historical candlestick data ending at the current price."""
        sym = symbol.upper().strip()
        st = self._ensure_symbol_state(sym)
        current_price = st["price"]
        volatility = st["volatility"] * 5  # Daily volatility multiplier

        bars: List[OHLCVBar] = []
        now_dt = datetime.now(timezone.utc)
        
        # Robust timeframe resolution
        tf = (timeframe or "1D").upper().strip()
        if tf in ("1D", "D", "DAILY"):
            step_seconds = 86400
        elif tf in ("1H", "H", "60M", "HOURLY"):
            step_seconds = 3600
        elif tf in ("15M", "15", "15MIN"):
            step_seconds = 900
        elif tf in ("5M", "5", "5MIN"):
            step_seconds = 300
        elif tf in ("1M", "1", "1MIN"):
            step_seconds = 60
        else:
            step_seconds = 86400

        start_ts = int(now_dt.timestamp()) - (limit * step_seconds)

        # Generate a backward-anchored random walk to match current price
        simulated_prices = [current_price]
        for _ in range(limit - 1):
            prev = simulated_prices[-1]
            change = float(np.random.normal(0, volatility * prev))
            simulated_prices.append(max(0.05, round(prev - change, 2)))
        
        simulated_prices.reverse()

        for i, close_val in enumerate(simulated_prices):
            bar_time = start_ts + (i * step_seconds)
            open_val = simulated_prices[i - 1] if i > 0 else round(close_val * (1 + random.uniform(-0.005, 0.005)), 2)
            open_val = max(0.05, open_val)
            high_val = round(max(open_val, close_val) * (1 + random.uniform(0.001, 0.012)), 2)
            low_val = round(min(open_val, close_val) * (1 - random.uniform(0.001, 0.012)), 2)
            low_val = max(0.05, low_val)
            volume_val = float(random.randint(50000, 2500000))

            bars.append(
                OHLCVBar(
                    time=bar_time,
                    open=open_val,
                    high=high_val,
                    low=low_val,
                    close=close_val,
                    volume=volume_val,
                )
            )

        return bars

    def get_market_status(self) -> MarketStatus:
        return get_indian_market_status()
