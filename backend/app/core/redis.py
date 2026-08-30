import asyncio
import json
import logging
from typing import Any, Callable, Dict, List, Optional
import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisManager:
    """Manages Redis connection, caching, and pub/sub channels with fallback support."""
    
    def __init__(self):
        self.client: Optional[aioredis.Redis] = None
        self._local_cache: Dict[str, Any] = {}
        self._subscribers: Dict[str, List[Callable]] = {}
        self.is_connected: bool = False

    async def connect(self) -> None:
        if settings.REDIS_ENABLED:
            try:
                self.client = aioredis.from_url(
                    settings.REDIS_URL,
                    encoding="utf-8",
                    decode_responses=True,
                )
                await self.client.ping()
                self.is_connected = True
                logger.info("Connected to Redis server.")
            except Exception as e:
                logger.warning(f"Could not connect to Redis ({e}). Running with in-memory fallback cache.")
                self.client = None
                self.is_connected = False
        else:
            logger.info("Redis disabled in config. Using in-memory cache & Pub/Sub.")
            self.is_connected = False

    async def disconnect(self) -> None:
        if self.client and self.is_connected:
            await self.client.aclose()
            self.is_connected = False
            logger.info("Disconnected from Redis.")

    async def set(self, key: str, value: Any, expire_seconds: Optional[int] = None) -> None:
        serialized = json.dumps(value) if not isinstance(value, str) else value
        if self.is_connected and self.client:
            try:
                await self.client.set(key, serialized, ex=expire_seconds)
                return
            except Exception as e:
                logger.error(f"Redis SET failed: {e}")
        self._local_cache[key] = serialized

    async def get(self, key: str) -> Optional[Any]:
        if self.is_connected and self.client:
            try:
                val = await self.client.get(key)
                if val is not None:
                    try:
                        return json.loads(val)
                    except Exception:
                        return val
            except Exception as e:
                logger.error(f"Redis GET failed: {e}")
        
        val = self._local_cache.get(key)
        if val is not None and isinstance(val, str):
            try:
                return json.loads(val)
            except Exception:
                return val
        return val

    async def publish(self, channel: str, message: Any) -> None:
        payload = json.dumps(message) if not isinstance(message, str) else message
        if self.is_connected and self.client:
            try:
                await self.client.publish(channel, payload)
                return
            except Exception as e:
                logger.error(f"Redis PUBLISH failed: {e}")

        # Local in-memory dispatch
        if channel in self._subscribers:
            for callback in self._subscribers[channel]:
                if asyncio.iscoroutinefunction(callback):
                    asyncio.create_task(callback(payload))
                else:
                    callback(payload)

    def subscribe_local(self, channel: str, callback: Callable) -> None:
        if channel not in self._subscribers:
            self._subscribers[channel] = []
        self._subscribers[channel].append(callback)


redis_manager = RedisManager()
