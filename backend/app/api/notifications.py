from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.schemas.notification import (
    NotificationListResponse,
    PushSubscriptionCreate,
    PushSubscriptionResponse,
    VapidPublicKeyResponse,
)
from app.services.notification_service import notification_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/vapid-public-key", response_model=VapidPublicKeyResponse)
async def get_vapid_public_key():
    """Retrieve the application's VAPID public key for Web Push subscription."""
    return {"public_key": settings.VAPID_PUBLIC_KEY}


@router.post("/push-subscription", response_model=PushSubscriptionResponse, status_code=status.HTTP_201_CREATED)
async def save_push_subscription(
    sub_in: PushSubscriptionCreate,
    current_user: User = Depends(get_current_user),
):
    """Register or refresh a device Web Push subscription for the authenticated user."""
    try:
        sub = await notification_service.register_push_subscription(
            user_id=current_user.id,
            endpoint=sub_in.endpoint,
            p256dh=sub_in.keys.p256dh,
            auth=sub_in.keys.auth,
            user_agent=sub_in.user_agent,
        )
        return sub
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to register push subscription: {str(e)}",
        )


@router.delete("/push-subscription", status_code=status.HTTP_200_OK)
async def delete_push_subscription(
    endpoint: str = Query(..., description="The push endpoint URL to unsubscribe"),
    current_user: User = Depends(get_current_user),
):
    """Unregister a device Web Push subscription."""
    success = await notification_service.unregister_push_subscription(
        endpoint=endpoint,
        user_id=current_user.id,
    )
    return {"status": "success", "unregistered": success}


@router.get("", response_model=NotificationListResponse)
async def get_user_notifications(
    unread_only: bool = Query(False, description="Filter only unread notifications"),
    limit: int = Query(50, ge=1, le=200, description="Max number of notifications"),
    current_user: User = Depends(get_current_user),
):
    """Retrieve stored notifications and alerts for the logged-in user."""
    notifications, unread_count = await notification_service.get_user_notifications(
        user_id=current_user.id,
        unread_only=unread_only,
        limit=limit,
    )
    return {
        "total": len(notifications),
        "unread_count": unread_count,
        "notifications": notifications,
    }


@router.put("/{notification_id}/read", response_model=dict)
async def mark_notification_as_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
):
    """Mark a notification as read."""
    success = await notification_service.mark_as_read(
        notification_id=notification_id,
        user_id=current_user.id,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return {"status": "success", "message": "Notification marked as read"}


@router.post("/read-all", response_model=dict)
async def mark_all_notifications_as_read(
    current_user: User = Depends(get_current_user),
):
    """Mark all notifications as read for current user."""
    count = await notification_service.mark_all_as_read(user_id=current_user.id)
    return {"status": "success", "count": count, "message": f"{count} notifications marked as read"}
