import asyncio
import json
import logging
from typing import Dict, List, Optional, Set
from fastapi import WebSocket, WebSocketDisconnect
from app.schemas.market import MarketTick

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages active WebSocket connections, per-symbol subscriptions, and user channels."""

    def __init__(self):
        # All active client websockets: {websocket: {"symbols": set(), "user_id": Optional[str]}}
        self._connections: Dict[WebSocket, Dict] = {}
        # Symbol to subscribed sockets: {symbol: set(websocket)}
        self._symbol_subscribers: Dict[str, Set[WebSocket]] = {}
        # User ID to active websockets: {user_id: set(websocket)}
        self._user_connections: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, user_id: Optional[str] = None) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections[websocket] = {
                "symbols": set(),
                "user_id": user_id,
            }
            if user_id:
                if user_id not in self._user_connections:
                    self._user_connections[user_id] = set()
                self._user_connections[user_id].add(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self._connections)}")

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            if websocket in self._connections:
                info = self._connections.pop(websocket)
                user_id = info.get("user_id")
                # Remove from symbol subscriptions
                for sym in info.get("symbols", set()):
                    if sym in self._symbol_subscribers:
                        self._symbol_subscribers[sym].discard(websocket)
                        if not self._symbol_subscribers[sym]:
                            del self._symbol_subscribers[sym]
                # Remove from user connections
                if user_id and user_id in self._user_connections:
                    self._user_connections[user_id].discard(websocket)
                    if not self._user_connections[user_id]:
                        del self._user_connections[user_id]
        logger.info(f"WebSocket client disconnected. Total clients: {len(self._connections)}")

    async def subscribe(self, websocket: WebSocket, symbols: List[str]) -> None:
        async with self._lock:
            if websocket not in self._connections:
                return
            for s in symbols:
                sym = s.upper().strip()
                self._connections[websocket]["symbols"].add(sym)
                if sym not in self._symbol_subscribers:
                    self._symbol_subscribers[sym] = set()
                self._symbol_subscribers[sym].add(websocket)
        logger.debug(f"Client subscribed to: {symbols}")

    async def unsubscribe(self, websocket: WebSocket, symbols: List[str]) -> None:
        async with self._lock:
            if websocket not in self._connections:
                return
            for s in symbols:
                sym = s.upper().strip()
                self._connections[websocket]["symbols"].discard(sym)
                if sym in self._symbol_subscribers:
                    self._symbol_subscribers[sym].discard(websocket)

    async def broadcast_tick(self, tick: MarketTick) -> None:
        """Broadcast live tick only to clients subscribed to this symbol or listening to global feed."""
        sym = tick.symbol.upper()
        payload = {
            "type": "TICK",
            "data": {
                "symbol": tick.symbol,
                "price": tick.price,
                "open": tick.open,
                "high": tick.high,
                "low": tick.low,
                "close": tick.close,
                "change": tick.change,
                "change_percent": tick.change_percent,
                "volume": tick.volume,
                "timestamp": tick.timestamp.isoformat(),
            },
        }
        json_data = json.dumps(payload)

        # Find target sockets (either subscribed to this symbol or subscribed to ALL)
        target_sockets = set()
        async with self._lock:
            if sym in self._symbol_subscribers:
                target_sockets.update(self._symbol_subscribers[sym])
            if "*" in self._symbol_subscribers:
                target_sockets.update(self._symbol_subscribers["*"])
            # If a client has no explicit symbol filters, receive default major symbols
            for ws, info in self._connections.items():
                if not info["symbols"]:
                    target_sockets.add(ws)

        if not target_sockets:
            return

        # Send asynchronously without blocking the market feed
        for ws in list(target_sockets):
            try:
                await ws.send_text(json_data)
            except Exception:
                # Disconnect stale sockets gracefully
                asyncio.create_task(self.disconnect(ws))

    async def send_to_user(self, user_id: str, message: dict) -> None:
        """Send direct notification to all active sockets of a specific user."""
        json_data = json.dumps(message)
        sockets = set()
        async with self._lock:
            if user_id in self._user_connections:
                sockets.update(self._user_connections[user_id])
        
        for ws in sockets:
            try:
                await ws.send_text(json_data)
            except Exception:
                asyncio.create_task(self.disconnect(ws))

    async def broadcast_all(self, message: dict) -> None:
        """Broadcast generic message to every connected client."""
        json_data = json.dumps(message)
        for ws in list(self._connections.keys()):
            try:
                await ws.send_text(json_data)
            except Exception:
                asyncio.create_task(self.disconnect(ws))

    async def broadcast_event(self, message: dict) -> None:
        """Alias for broadcast_all."""
        await self.broadcast_all(message)


ws_manager = ConnectionManager()

