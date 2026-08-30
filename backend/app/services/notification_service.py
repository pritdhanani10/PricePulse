import asyncio
from datetime import datetime, timezone
import logging
from typing import Optional
from sqlalchemy import select, and_, desc, func, update

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.redis import redis_manager
from app.models.alert import Alert
from app.models.notification import UserNotification
from app.models.strategy import StrategySignal
from app.websocket.manager import ws_manager

logger = logging.getLogger(__name__)


class NotificationService:
    """Dispatches notifications across multiple channels (WebSocket, In-App Database, Console, Telegram)."""

    async def send_alert_notification(
        self,
        alert: Alert,
        current_price: float,
        channel: str = "IN_APP",
    ) -> bool:
        symbol = alert.instrument.symbol if alert.instrument else alert.instrument_id
        title = f"🚨 Market Alert Triggered: {symbol}"
        message = (
            f"Symbol: {symbol}\n"
            f"Direction: {alert.direction} ({alert.threshold_percent}%)\n"
            f"Reference Price: ₹{alert.reference_price:,.2f}\n"
            f"Target Price: ₹{alert.target_price:,.2f}\n"
            f"Triggered Live Price: ₹{current_price:,.2f}\n"
            f"Time: {alert.triggered_at}"
        )

        logger.info(f"\n==================== ALERT NOTIFICATION ====================\n{title}\n{message}\n============================================================")

        # Telegram Bot Integration
        if settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID:
            await self._send_telegram(title, message)

        return True

    async def send_watchlist_signal_notification(
        self,
        user_id: str,
        symbol: str,
        signal: StrategySignal,
        watchlist_id: Optional[str] = None,
        instrument_id: Optional[str] = None,
    ) -> Optional[UserNotification]:
        """
        Persists a high-priority UserNotification in DB and broadcasts across WebSocket & Redis.
        Ensures users get alerted even if offline, preserving full history.
        """
        now = datetime.now(timezone.utc)
        sig_type = signal.signal_type.upper()
        emoji = "🟢" if sig_type == "BUY" else "🔴"
        title = f"{emoji} Watchlist {sig_type} Signal: {symbol}"
        message = (
            f"Automated 5-minute Strategy detected a {sig_type} trigger for {symbol} in your Watchlist.\n"
            f"Trigger Target: ₹{signal.trigger_price:,.2f} | Executed Live Price: ₹{signal.actual_market_price:,.2f}\n"
            f"Reference Price: ₹{signal.reference_price:,.2f} (5m Candle)"
        )

        async with AsyncSessionLocal() as session:
            try:
                notification = UserNotification(
                    user_id=user_id,
                    watchlist_id=watchlist_id,
                    instrument_id=instrument_id,
                    symbol=symbol.upper().strip(),
                    signal_id=signal.id,
                    notification_type="WATCHLIST_SIGNAL",
                    title=title,
                    message=message,
                    signal_type=sig_type,
                    trigger_price=signal.trigger_price,
                    market_price=signal.actual_market_price,
                    reference_price=signal.reference_price,
                    is_read=False,
                    created_at=now,
                )
                session.add(notification)
                await session.commit()
                await session.refresh(notification)

                logger.info(f"🔔 Created UserNotification {notification.id} for User {user_id}: {title}")

                # Broadcast over Redis & WebSocket
                payload = {
                    "type": "WATCHLIST_SIGNAL_NOTIFICATION",
                    "data": {
                        "id": notification.id,
                        "user_id": user_id,
                        "watchlist_id": watchlist_id,
                        "symbol": symbol.upper().strip(),
                        "signal_id": signal.id,
                        "signal_type": sig_type,
                        "title": title,
                        "message": message,
                        "trigger_price": signal.trigger_price,
                        "market_price": signal.actual_market_price,
                        "reference_price": signal.reference_price,
                        "created_at": notification.created_at.isoformat(),
                        "is_read": False,
                    },
                }

                asyncio.create_task(redis_manager.publish(f"user:{user_id}:notifications", payload))
                asyncio.create_task(ws_manager.broadcast_event(payload))

                # Telegram notification if configured
                if settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID:
                    asyncio.create_task(self._send_telegram(title, message))

                return notification

            except Exception as e:
                await session.rollback()
                logger.error(f"Failed to record watchlist signal notification for user {user_id}: {e}", exc_info=True)
                return None

    async def get_user_notifications(
        self,
        user_id: str,
        unread_only: bool = False,
        limit: int = 50,
    ):
        """Retrieve stored notifications for a user."""
        async with AsyncSessionLocal() as session:
            stmt = (
                select(UserNotification)
                .where(UserNotification.user_id == user_id)
                .order_by(desc(UserNotification.created_at))
            )
            if unread_only:
                stmt = stmt.where(UserNotification.is_read == False)

            stmt = stmt.limit(limit)
            result = await session.execute(stmt)
            notifications = result.scalars().all()

            # Count unread
            count_stmt = select(func.count(UserNotification.id)).where(
                and_(UserNotification.user_id == user_id, UserNotification.is_read == False)
            )
            unread_count = (await session.execute(count_stmt)).scalar() or 0

            return notifications, unread_count

    async def mark_as_read(self, notification_id: str, user_id: str) -> bool:
        """Mark a single notification as read."""
        now = datetime.now(timezone.utc)
        async with AsyncSessionLocal() as session:
            stmt = (
                update(UserNotification)
                .where(and_(UserNotification.id == notification_id, UserNotification.user_id == user_id))
                .values(is_read=True, read_at=now)
            )
            res = await session.execute(stmt)
            await session.commit()
            return res.rowcount > 0

    async def mark_all_as_read(self, user_id: str) -> int:
        """Mark all notifications as read for a user."""
        now = datetime.now(timezone.utc)
        async with AsyncSessionLocal() as session:
            stmt = (
                update(UserNotification)
                .where(and_(UserNotification.user_id == user_id, UserNotification.is_read == False))
                .values(is_read=True, read_at=now)
            )
            res = await session.execute(stmt)
            await session.commit()
            return res.rowcount

    async def _send_telegram(self, title: str, message: str) -> None:
        try:
            import httpx
            url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
            payload = {
                "chat_id": settings.TELEGRAM_CHAT_ID,
                "text": f"*{title}*\n\n{message}",
                "parse_mode": "Markdown",
            }
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code != 200:
                    logger.warning(f"Telegram notification returned {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.error(f"Failed to dispatch Telegram alert: {e}")


notification_service = NotificationService()
