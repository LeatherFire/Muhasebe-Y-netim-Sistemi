# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId

from app.models.notification import (
    Notification,
    NotificationCreate,
    NotificationUpdate,
    NotificationSummary,
    NotificationStats,
    NotificationPreferences,
    NotificationType,
    NotificationPriority,
    NotificationStatus,
    NotificationChannel
)
from app.models.user import User
from app.api.routes.auth import get_current_user
from app.core.database import get_database
from app.core.errors import (
    validate_object_id,
    raise_not_found,
    raise_bad_request
)

router = APIRouter()

@router.get("/", response_model=List[NotificationSummary])
async def get_notifications(
    status_filter: Optional[NotificationStatus] = Query(None, description="Duruma göre filtrele"),
    type_filter: Optional[NotificationType] = Query(None, description="Türe göre filtrele"),
    unread_only: bool = Query(False, description="Sadece okunmamışlar"),
    limit: int = Query(50, le=100, description="Maksimum kayıt sayısı"),
    skip: int = Query(0, ge=0, description="Atlanacak kayıt sayısı"),
    current_user: User = Depends(get_current_user)
):
    """Kullanıcının bildirimlerini listele"""
    db = get_database()
    
    # Filtre oluştur
    filter_query = {"user_id": current_user.id}
    
    if status_filter:
        filter_query["status"] = status_filter
    if type_filter:
        filter_query["type"] = type_filter
    if unread_only:
        filter_query["read_at"] = None
    
    notifications = []
    cursor = db.notifications.find(filter_query).sort("created_at", -1).skip(skip).limit(limit)
    
    async for notification in cursor:
        summary = NotificationSummary(
            id=str(notification["_id"]),
            title=notification["title"],
            message=notification["message"],
            type=notification["type"],
            priority=notification["priority"],
            status=notification["status"],
            created_at=notification["created_at"],
            read_at=notification.get("read_at"),
            action_url=notification.get("action_url"),
            action_text=notification.get("action_text")
        )
        notifications.append(summary)
    
    return notifications

@router.get("/stats", response_model=NotificationStats)
async def get_notification_stats(
    current_user: User = Depends(get_current_user)
):
    """Kullanıcının bildirim istatistiklerini getir"""
    db = get_database()
    
    # Temel sayıları al
    total_notifications = await db.notifications.count_documents({"user_id": current_user.id})
    unread_count = await db.notifications.count_documents({
        "user_id": current_user.id,
        "read_at": None
    })
    pending_count = await db.notifications.count_documents({
        "user_id": current_user.id,
        "status": NotificationStatus.PENDING
    })
    failed_count = await db.notifications.count_documents({
        "user_id": current_user.id,
        "status": NotificationStatus.FAILED
    })
    
    # Türe göre dağılım
    type_pipeline = [
        {"$match": {"user_id": current_user.id}},
        {"$group": {"_id": "$type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    
    by_type = []
    async for doc in db.notifications.aggregate(type_pipeline):
        by_type.append({
            "type": doc["_id"],
            "count": doc["count"]
        })
    
    # Önceliğe göre dağılım
    priority_pipeline = [
        {"$match": {"user_id": current_user.id}},
        {"$group": {"_id": "$priority", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    
    by_priority = []
    async for doc in db.notifications.aggregate(priority_pipeline):
        by_priority.append({
            "priority": doc["_id"],
            "count": doc["count"]
        })
    
    # Son bildirimler
    recent_notifications = []
    cursor = db.notifications.find({"user_id": current_user.id}).sort("created_at", -1).limit(5)
    
    async for notification in cursor:
        summary = NotificationSummary(
            id=str(notification["_id"]),
            title=notification["title"],
            message=notification["message"],
            type=notification["type"],
            priority=notification["priority"],
            status=notification["status"],
            created_at=notification["created_at"],
            read_at=notification.get("read_at"),
            action_url=notification.get("action_url"),
            action_text=notification.get("action_text")
        )
        recent_notifications.append(summary)
    
    return NotificationStats(
        total_notifications=total_notifications,
        unread_count=unread_count,
        pending_count=pending_count,
        failed_count=failed_count,
        by_type=by_type,
        by_priority=by_priority,
        recent_notifications=recent_notifications
    )

@router.post("/", response_model=Notification)
async def create_notification(
    notification_data: NotificationCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Yeni bildirim oluştur"""
    db = get_database()
    
    now = datetime.utcnow()
    notification_dict = notification_data.model_dump()
    notification_dict.update({
        "status": NotificationStatus.PENDING,
        "created_by": current_user.id,
        "created_at": now,
        "updated_at": now
    })
    
    result = await db.notifications.insert_one(notification_dict)
    
    # Background task ile bildirim gönder
    background_tasks.add_task(
        send_notification,
        str(result.inserted_id),
        notification_data.channels
    )
    
    # Oluşturulan bildirimi getir
    created_notification = await db.notifications.find_one({"_id": result.inserted_id})
    created_notification["_id"] = str(created_notification["_id"])
    
    return Notification(**created_notification)

@router.put("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    current_user: User = Depends(get_current_user)
):
    """Bildirimi okundu olarak işaretle"""
    validate_object_id(notification_id)
    db = get_database()
    
    notification = await db.notifications.find_one({
        "_id": ObjectId(notification_id),
        "user_id": current_user.id
    })
    
    if not notification:
        raise_not_found("Bildirim bulunamadı")
    
    now = datetime.utcnow()
    await db.notifications.update_one(
        {"_id": ObjectId(notification_id)},
        {
            "$set": {
                "status": NotificationStatus.READ,
                "read_at": now,
                "updated_at": now
            }
        }
    )
    
    return {"message": "Bildirim okundu olarak işaretlendi"}

@router.put("/{notification_id}/dismiss")
async def dismiss_notification(
    notification_id: str,
    current_user: User = Depends(get_current_user)
):
    """Bildirimi göz ardı et"""
    validate_object_id(notification_id)
    db = get_database()
    
    notification = await db.notifications.find_one({
        "_id": ObjectId(notification_id),
        "user_id": current_user.id
    })
    
    if not notification:
        raise_not_found("Bildirim bulunamadı")
    
    now = datetime.utcnow()
    await db.notifications.update_one(
        {"_id": ObjectId(notification_id)},
        {
            "$set": {
                "status": NotificationStatus.DISMISSED,
                "dismissed_at": now,
                "updated_at": now
            }
        }
    )
    
    return {"message": "Bildirim göz ardı edildi"}

@router.put("/mark-all-read")
async def mark_all_as_read(
    current_user: User = Depends(get_current_user)
):
    """Tüm bildirimleri okundu olarak işaretle"""
    db = get_database()
    
    now = datetime.utcnow()
    result = await db.notifications.update_many(
        {
            "user_id": current_user.id,
            "read_at": None
        },
        {
            "$set": {
                "status": NotificationStatus.READ,
                "read_at": now,
                "updated_at": now
            }
        }
    )
    
    return {"message": f"{result.modified_count} bildirim okundu olarak işaretlendi"}

@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: User = Depends(get_current_user)
):
    """Bildirimi sil"""
    validate_object_id(notification_id)
    db = get_database()
    
    notification = await db.notifications.find_one({
        "_id": ObjectId(notification_id),
        "user_id": current_user.id
    })
    
    if not notification:
        raise_not_found("Bildirim bulunamadı")
    
    await db.notifications.delete_one({"_id": ObjectId(notification_id)})
    
    return {"message": "Bildirim silindi"}

@router.get("/preferences", response_model=NotificationPreferences)
async def get_notification_preferences(
    current_user: User = Depends(get_current_user)
):
    """Kullanıcı bildirim tercihlerini getir"""
    db = get_database()
    
    preferences = await db.notification_preferences.find_one({"user_id": current_user.id})
    
    if not preferences:
        # Varsayılan tercihler oluştur
        default_preferences = NotificationPreferences(user_id=current_user.id)
        await db.notification_preferences.insert_one(default_preferences.model_dump())
        return default_preferences
    
    return NotificationPreferences(**preferences)

@router.put("/preferences", response_model=NotificationPreferences)
async def update_notification_preferences(
    preferences_data: NotificationPreferences,
    current_user: User = Depends(get_current_user)
):
    """Kullanıcı bildirim tercihlerini güncelle"""
    db = get_database()
    
    now = datetime.utcnow()
    preferences_dict = preferences_data.model_dump()
    preferences_dict.update({
        "user_id": current_user.id,
        "updated_at": now
    })
    
    await db.notification_preferences.update_one(
        {"user_id": current_user.id},
        {"$set": preferences_dict},
        upsert=True
    )
    
    return preferences_data

# Background task functions
async def send_notification(notification_id: str, channels: List[NotificationChannel]):
    """Bildirimi gönder (background task)"""
    db = get_database()
    
    try:
        notification = await db.notifications.find_one({"_id": ObjectId(notification_id)})
        if not notification:
            return
        
        success = True
        errors = []
        
        # Her kanal için gönderim yap
        for channel in channels:
            try:
                if channel == NotificationChannel.IN_APP:
                    # In-app notification already stored in database
                    pass
                elif channel == NotificationChannel.EMAIL:
                    await send_email_notification(notification)
                elif channel == NotificationChannel.SMS:
                    await send_sms_notification(notification)
                elif channel == NotificationChannel.PUSH:
                    await send_push_notification(notification)
            except Exception as e:
                success = False
                errors.append(f"{channel}: {str(e)}")
        
        # Update notification status
        now = datetime.utcnow()
        update_data = {
            "sent_at": now,
            "delivery_attempts": notification.get("delivery_attempts", 0) + 1,
            "last_delivery_attempt": now,
            "updated_at": now
        }
        
        if success:
            update_data["status"] = NotificationStatus.SENT
        else:
            update_data["status"] = NotificationStatus.FAILED
            update_data["delivery_errors"] = notification.get("delivery_errors", []) + errors
        
        await db.notifications.update_one(
            {"_id": ObjectId(notification_id)},
            {"$set": update_data}
        )
        
    except Exception as e:
        # Log error
        print(f"Error sending notification {notification_id}: {e}")

async def send_email_notification(notification: dict):
    """E-posta bildirimi gönder"""
    # E-posta gönderim implementasyonu
    # Bu kısım gerçek e-posta servisi ile entegre edilebilir
    print(f"Email notification sent: {notification['title']}")

async def send_sms_notification(notification: dict):
    """SMS bildirimi gönder"""
    # SMS gönderim implementasyonu
    print(f"SMS notification sent: {notification['title']}")

async def send_push_notification(notification: dict):
    """Push bildirimi gönder"""
    # Push notification gönderim implementasyonu
    print(f"Push notification sent: {notification['title']}")

# Scheduler functions for automated notifications
async def create_payment_due_notifications():
    """Vade yaklaşan ödemeler için bildirim oluştur"""
    db = get_database()
    
    # 3 gün sonrası vade olan ödeme emirleri
    three_days_later = datetime.utcnow() + timedelta(days=3)
    due_payments = db.payment_orders.find({
        "status": "approved",
        "due_date": {
            "$gte": datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0),
            "$lte": three_days_later.replace(hour=23, minute=59, second=59, microsecond=999999)
        }
    })
    
    async for payment in due_payments:
        # Check if notification already exists
        existing = await db.notifications.find_one({
            "type": NotificationType.PAYMENT_DUE,
            "related_entity_id": str(payment["_id"]),
            "user_id": payment["created_by"]
        })
        
        if not existing:
            notification_data = NotificationCreate(
                title="Ödeme Vadesi Yaklaşıyor",
                message=f"{payment['recipient_name']} için {payment['amount']} TL ödeme vadesi yaklaşıyor.",
                type=NotificationType.PAYMENT_DUE,
                priority=NotificationPriority.HIGH,
                user_id=payment["created_by"],
                related_entity_type="payment_order",
                related_entity_id=str(payment["_id"]),
                action_url=f"/payment-orders/{payment['_id']}",
                action_text="Detayları Görüntüle"
            )
            
            await db.notifications.insert_one(notification_data.model_dump())