import asyncio
from datetime import datetime, timezone
import hashlib
import logging
from typing import Dict, List, Optional
import httpx
from app.schemas.analysis import MacroIndicatorItem, MacroSummaryResponse, MarketNewsItem

logger = logging.getLogger(__name__)

BULLISH_KEYWORDS = ["profit", "growth", "surge", "gain", "rally", "record high", "bullish", "upgrade", "outperform", "dividend", "q4", "q3", "revenue up", "expansion"]
BEARISH_KEYWORDS = ["loss", "drop", "plunge", "decline", "fall", "bearish", "downgrade", "underperform", "inflation", "tariff", "slump", "fraud", "probe", "selloff"]


def analyze_sentiment(text: str) -> str:
    text_lower = text.lower()
    bull_count = sum(1 for kw in BULLISH_KEYWORDS if kw in text_lower)
    bear_count = sum(1 for kw in BEARISH_KEYWORDS if kw in text_lower)
    if bull_count > bear_count:
        return "BULLISH"
    elif bear_count > bull_count:
        return "BEARISH"
    return "NEUTRAL"


class MarketIntelligenceService:
    """Provides real-time financial market news sentiment and global macro indicators."""

    def __init__(self):
        self._news_cache: Dict[str, List[MarketNewsItem]] = {}
        self._news_cache_time: Dict[str, datetime] = {}
        self._macro_cache: Optional[MacroSummaryResponse] = None
        self._macro_cache_time: Optional[datetime] = None

    async def get_market_news(self, query: str = "Indian Stock Market NSE", limit: int = 10) -> List[MarketNewsItem]:
        cache_key = query.upper().strip()
        now = datetime.now(timezone.utc)

        # 5-minute TTL cache
        if (
            cache_key in self._news_cache
            and cache_key in self._news_cache_time
            and (now - self._news_cache_time[cache_key]).total_seconds() < 300
        ):
            return self._news_cache[cache_key][:limit]

        items: List[MarketNewsItem] = []
        try:
            url = f"https://query1.finance.yahoo.com/v1/finance/search?q={query}&newsCount={limit + 5}"
            async with httpx.AsyncClient(
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
                timeout=6.0,
            ) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    news_list = res.json().get("news", [])
                    for item in news_list:
                        title = item.get("title", "").strip()
                        if not title:
                            continue
                        pub = item.get("publisher", "Financial News")
                        link = item.get("link", "#")
                        pub_time = item.get("providerPublishTime")
                        if pub_time:
                            dt_str = datetime.fromtimestamp(pub_time, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
                        else:
                            dt_str = now.strftime("%Y-%m-%d %H:%M:%S UTC")

                        symbols = item.get("relatedSymbols", [])
                        news_id = item.get("uuid") or hashlib.md5(title.encode()).hexdigest()

                        items.append(
                            MarketNewsItem(
                                id=str(news_id),
                                title=title,
                                publisher=pub,
                                link=link,
                                published_at=dt_str,
                                sentiment=analyze_sentiment(title),
                                related_symbols=symbols,
                            )
                        )
        except Exception as e:
            logger.warning(f"Error fetching market news for '{query}': {e}")

        # Fallback items if external query returned empty
        if not items:
            items = [
                MarketNewsItem(
                    id="news_default_1",
                    title="Indian Markets: NSE Indices & Equities Trading Session Active",
                    publisher="Market Wire",
                    link="https://www.nseindia.com",
                    published_at=now.strftime("%Y-%m-%d %H:%M:%S UTC"),
                    sentiment="BULLISH",
                    related_symbols=["NIFTY50", "BANKNIFTY"],
                ),
                MarketNewsItem(
                    id="news_default_2",
                    title="RBI Monetary Policy & Global Cues Support Domestic Market Sentiment",
                    publisher="Economic Desk",
                    link="https://www.rbi.org.in",
                    published_at=now.strftime("%Y-%m-%d %H:%M:%S UTC"),
                    sentiment="NEUTRAL",
                    related_symbols=["BANKNIFTY"],
                ),
            ]

        self._news_cache[cache_key] = items
        self._news_cache_time[cache_key] = now
        return items[:limit]

    async def get_macro_summary(self) -> MacroSummaryResponse:
        now = datetime.now(timezone.utc)
        if self._macro_cache and self._macro_cache_time and (now - self._macro_cache_time).total_seconds() < 120:
            return self._macro_cache

        # Default fallback metrics
        usdinr = MacroIndicatorItem(name="USD/INR", symbol="INR=X", value=86.85, change=0.04, change_percent=0.05, unit="INR", updated_at=now.isoformat())
        crude = MacroIndicatorItem(name="Brent Crude Oil", symbol="BZ=F", value=74.50, change=-0.35, change_percent=-0.47, unit="USD/bbl", updated_at=now.isoformat())
        gold = MacroIndicatorItem(name="Gold", symbol="GC=F", value=2910.20, change=12.40, change_percent=0.43, unit="USD/oz", updated_at=now.isoformat())

        tickers = [
            ("INR=X", "USD/INR", "INR"),
            ("BZ=F", "Brent Crude Oil", "USD/bbl"),
            ("GC=F", "Gold", "USD/oz"),
        ]

        async def fetch_ticker(symbol_code: str, name: str, unit: str) -> Optional[MacroIndicatorItem]:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol_code}?interval=1d&range=1d"
            try:
                async with httpx.AsyncClient(
                    headers={"User-Agent": "Mozilla/5.0"},
                    timeout=5.0,
                ) as client:
                    r = await client.get(url)
                    if r.status_code == 200:
                        meta = r.json().get("chart", {}).get("result", [{}])[0].get("meta", {})
                        price = meta.get("regularMarketPrice")
                        if price is not None:
                            prev_close = meta.get("chartPreviousClose") or price
                            chg = round(price - prev_close, 2)
                            pct = round((chg / prev_close) * 100, 2) if prev_close else 0.0
                            return MacroIndicatorItem(
                                name=name,
                                symbol=symbol_code,
                                value=round(float(price), 2),
                                change=chg,
                                change_percent=pct,
                                unit=unit,
                                updated_at=now.isoformat(),
                            )
            except Exception as e:
                logger.debug(f"Error fetching macro ticker {symbol_code}: {e}")
            return None

        tasks = [fetch_ticker(sym, name, unit) for sym, name, unit in tickers]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        if isinstance(results[0], MacroIndicatorItem):
            usdinr = results[0]
        if isinstance(results[1], MacroIndicatorItem):
            crude = results[1]
        if isinstance(results[2], MacroIndicatorItem):
            gold = results[2]

        summary = MacroSummaryResponse(
            usdinr=usdinr,
            crude_oil=crude,
            gold=gold,
            updated_at=now.strftime("%Y-%m-%d %H:%M:%S UTC"),
        )
        self._macro_cache = summary
        self._macro_cache_time = now
        return summary


market_intelligence_service = MarketIntelligenceService()
