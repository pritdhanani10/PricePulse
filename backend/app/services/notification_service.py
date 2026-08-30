import logging
from typing import Optional
from app.core.config import settings
from app.models.alert import Alert

logger = logging.getLogger(__name__)


class NotificationService:
    """Dispatches notifications across multiple channels (WebSocket, Console, Telegram, Email)."""

    async def send_alert_notification(
        self,
        alert: Alert,
        current_price: float,
        channel: str = "IN_APP",
    ) -> bool:
        title = f"🚨 Market Alert Triggered: {alert.instrument.symbol if alert.instrument else 'Asset'}"
        message = (
            f"Symbol: {alert.instrument.symbol if alert.instrument else alert.instrument_id}\n"
            f"Direction: {alert.direction} ({alert.threshold_percent}%)\n"
            f"Reference Price: ₹{alert.reference_price:,.2f}\n"
            f"Target Price: ₹{alert.target_price:,.2f}\n"
            f"Triggered Live Price: ₹{current_price:,.2f}\n"
            f"Time: {alert.triggered_at}"
        )

        logger.info(f"\n==================== NOTIFICATION ====================\n{title}\n{message}\n=======================================================")

        # Future Telegram Bot Integration
        if settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID:
            await self._send_telegram(title, message)

        return True

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
