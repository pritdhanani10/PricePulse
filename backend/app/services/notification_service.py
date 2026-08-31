import asyncio
from datetime import datetime, timezone
import json
import logging
from typing import Any, Dict, List, Optional
from pywebpush import webpush, WebPushException
from sqlalchemy import select, and_, desc, func, update, delete

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.redis import redis_manager
from app.models.alert import Alert
from app.models.notification import UserNotification
from app.models.push_subscription import PushSubscription
from app.models.strategy import StrategySignal
from app.websocket.manager import ws_manager

logger = logging.getLogger(__name__)


class NotificationService:
    """
    Dispatches notifications across multiple channels:
    - Real-time WebSocket broadcasts (instant in-app UI)
    - Web Push Protocol (Native Windows Action Center, Android & iOS Mobile notifications)
    - In-App Notification Ledger (SQLite / PostgreSQL)
    - Telegram Bot alerts
    """

    async def register_push_subscription(
        self,
        user_id: str,
        endpoint: str,
        p256dh: str,
        auth: str,
        user_agent: Optional[str] = None,
    ) -> PushSubscription:
        """Saves or updates a Web Push device subscription for a user."""
        async with AsyncSessionLocal() as session:
            try:
                stmt = select(PushSubscription).where(PushSubscription.endpoint == endpoint)
                existing = (await session.execute(stmt)).scalar_one_or_none()
                if existing:
                    existing.user_id = user_id
                    existing.p256dh = p256dh
                    existing.auth = auth
                    existing.user_agent = user_agent
                    await session.commit()
                    await session.refresh(existing)
                    logger.info(f"Updated push subscription {existing.id} for user {user_id}")
                    return existing
                else:
                    sub = PushSubscription(
                        user_id=user_id,
                        endpoint=endpoint,
                        p256dh=p256dh,
                        auth=auth,
                        user_agent=user_agent,
                    )
                    session.add(sub)
                    await session.commit()
                    await session.refresh(sub)
                    logger.info(f"Registered new push subscription {sub.id} for user {user_id}")
                    return sub
            except Exception as e:
                await session.rollback()
                logger.error(f"Failed to register push subscription: {e}", exc_info=True)
                raise

    async def unregister_push_subscription(self, endpoint: str, user_id: str) -> bool:
        """Removes a Web Push subscription."""
        async with AsyncSessionLocal() as session:
            stmt = delete(PushSubscription).where(
                and_(PushSubscription.endpoint == endpoint, PushSubscription.user_id == user_id)
            )
            res = await session.execute(stmt)
            await session.commit()
            return res.rowcount > 0

    async def send_web_push(
        self,
        user_id: str,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        url: Optional[str] = None,
    ) -> int:
        """
        Sends Web Push notifications to all registered device endpoints for this user.
        Automatically purges dead or unsubscribed endpoints (404/410).
        """
        if not settings.VAPID_PUBLIC_KEY or not settings.VAPID_PRIVATE_KEY:
            logger.debug("VAPID keys not configured; skipping web push dispatch.")
            return 0

        async with AsyncSessionLocal() as session:
            stmt = select(PushSubscription).where(PushSubscription.user_id == user_id)
            subs = (await session.execute(stmt)).scalars().all()
            if not subs:
                return 0

            payload_data = {
                "title": title,
                "body": body,
                "icon": "/favicon.svg",
                "badge": "/favicon.svg",
                "tag": f"pricepulse-{int(datetime.now().timestamp())}",
                "url": url or "/alerts/history",
                "data": data or {},
            }
            json_payload = json.dumps(payload_data)

            stale_endpoints = []
            successful_pushes = 0

            # Push in background loop or parallel tasks
            for sub in subs:
                try:
                    subscription_info = {
                        "endpoint": sub.endpoint,
                        "keys": {
                            "p256dh": sub.p256dh,
                            "auth": sub.auth,
                        },
                    }
                    # webpush executes synchronous crypto, run in threadpool
                    await asyncio.to_thread(
                        webpush,
                        subscription_info=subscription_info,
                        data=json_payload,
                        vapid_private_key=settings.VAPID_PRIVATE_KEY,
                        vapid_claims={"sub": settings.VAPID_CLAIM_EMAIL},
                        ttl=3600,
                    )
                    successful_pushes += 1
                    logger.info(f"Web push successfully delivered to endpoint: {sub.endpoint[:45]}...")
                except WebPushException as ex:
                    logger.warning(f"WebPush failed: {ex}")
                    # If endpoint is unsubscribed/expired, queue for removal
                    if ex.response and ex.response.status_code in (404, 410):
                        stale_endpoints.append(sub.endpoint)
                except Exception as e:
                    logger.warning(f"Unexpected WebPush error for endpoint {sub.endpoint[:45]}: {e}")

            if stale_endpoints:
                del_stmt = delete(PushSubscription).where(PushSubscription.endpoint.in_(stale_endpoints))
                await session.execute(del_stmt)
                await session.commit()
                logger.info(f"Purged {len(stale_endpoints)} stale push subscriptions.")

            return successful_pushes

    async def send_alert_notification(
        self,
        alert: Alert,
        current_price: float,
        channel: str = "IN_APP",
    ) -> Optional[UserNotification]:
        """
        Triggered when a price threshold is hit.
        1. Persists UserNotification in DB for full ledger history.
        2. Dispatches live WebSocket message directly to user sockets & global broadcast.
        3. Dispatches Web Push notification to Windows Action Center & Phone.
        4. Sends Telegram message if configured.
        """
        symbol = alert.instrument.symbol if alert.instrument else alert.instrument_id
        direction_emoji = "🚀" if alert.direction.upper() == "UP" else "🔻"
        title = f"{direction_emoji} Target Hit: {symbol} reached ₹{current_price:,.2f}"
        message = (
            f"Alert triggered for {symbol} ({alert.direction} {alert.threshold_percent}%).\n"
            f"Target Price: ₹{alert.target_price:,.2f} | Live Market Price: ₹{current_price:,.2f}\n"
            f"Reference Price: ₹{alert.reference_price:,.2f}"
        )

        now = datetime.now(timezone.utc)
        notification = None

        async with AsyncSessionLocal() as session:
            try:
                notification = UserNotification(
                    user_id=alert.user_id,
                    instrument_id=alert.instrument_id,
                    symbol=symbol.upper().strip(),
                    notification_type="PRICE_ALERT",
                    title=title,
                    message=message,
                    signal_type=alert.direction.upper(),
                    trigger_price=alert.target_price,
                    market_price=current_price,
                    reference_price=alert.reference_price,
                    is_read=False,
                    created_at=now,
                )
                session.add(notification)
                await session.commit()
                await session.refresh(notification)
                logger.info(f"🔔 Recorded Alert UserNotification {notification.id} for User {alert.user_id}: {title}")
            except Exception as e:
                await session.rollback()
                logger.error(f"Failed to record alert UserNotification for user {alert.user_id}: {e}", exc_info=True)

        # Prepare payload for WebSocket and Web Push
        event_payload = {
            "type": "ALERT_TRIGGERED",
            "data": {
                "id": notification.id if notification else alert.id,
                "alert_id": alert.id,
                "user_id": alert.user_id,
                "symbol": symbol.upper().strip(),
                "direction": alert.direction,
                "threshold_percent": alert.threshold_percent,
                "reference_price": alert.reference_price,
                "target_price": alert.target_price,
                "trigger_price": current_price,
                "triggered_at": now.isoformat(),
                "title": title,
                "message": message,
            },
        }

        # 1. Direct WebSocket dispatch
        asyncio.create_task(ws_manager.send_to_user(alert.user_id, event_payload))
        asyncio.create_task(ws_manager.broadcast_event(event_payload))
        asyncio.create_task(redis_manager.publish(f"user:{alert.user_id}:alerts", event_payload))
        asyncio.create_task(redis_manager.publish("market:alerts", event_payload))

        # 2. Native Web Push to Windows Action Center & Phone
        asyncio.create_task(
            self.send_web_push(
                user_id=alert.user_id,
                title=title,
                body=f"Target: ₹{alert.target_price:,.2f} | Live Price: ₹{current_price:,.2f}",
                data=event_payload["data"],
                url="/alerts/history",
            )
        )

        # 3. Telegram Bot Integration
        if settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID:
            asyncio.create_task(self._send_telegram(title, message))

        return notification

    async def send_watchlist_signal_notification(
        self,
        user_id: str,
        symbol: str,
        signal: StrategySignal,
        watchlist_id: Optional[str] = None,
        instrument_id: Optional[str] = None,
    ) -> Optional[UserNotification]:
        """
        Persists a high-priority UserNotification in DB and broadcasts across WebSocket, Redis & Web Push.
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

                # Direct WebSocket dispatch
                asyncio.create_task(ws_manager.send_to_user(user_id, payload))
                asyncio.create_task(ws_manager.broadcast_event(payload))
                asyncio.create_task(redis_manager.publish(f"user:{user_id}:notifications", payload))

                # Native Web Push to Windows PC & Phone
                asyncio.create_task(
                    self.send_web_push(
                        user_id=user_id,
                        title=title,
                        body=f"Target: ₹{signal.trigger_price:,.2f} | Live Price: ₹{signal.actual_market_price:,.2f}",
                        data=payload["data"],
                        url="/watchlist",
                    )
                )

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
