# -*- coding: utf-8 -*-
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

class NotificationType(str, Enum):
    """Bildirim türleri"""
    PAYMENT_DUE = "payment_due"                 # Ödeme vadesi yaklaşıyor
    PAYMENT_OVERDUE = "payment_overdue"         # Ödeme vadesi geçti
    PAYMENT_REMINDER = "payment_reminder"       # Ödeme hatırlatması
    INVOICE_DUE = "invoice_due"                 # Fatura vadesi
    DEBT_REMINDER = "debt_reminder"             # Borç hatırlatması
    CHECK_DUE = "check_due"                     # Çek vadesi
    APPROVAL_PENDING = "approval_pending"       # Onay bekleyen işlem
    APPROVAL_APPROVED = "approval_approved"     # İşlem onaylandı
    APPROVAL_REJECTED = "approval_rejected"     # İşlem reddedildi
    LOW_BALANCE = "low_balance"                 # Düşük bakiye
    HIGH_EXPENSE = "high_expense"               # Yüksek harcama
    MONTHLY_REPORT = "monthly_report"           # Aylık rapor
    SYSTEM_UPDATE = "system_update"             # Sistem güncellemesi
    BACKUP_REMINDER = "backup_reminder"         # Yedekleme hatırlatması

class NotificationPriority(str, Enum):
    """Bildirim öncelik seviyeleri"""
    LOW = "low"         # Düşük öncelik
    MEDIUM = "medium"   # Orta öncelik  
    HIGH = "high"       # Yüksek öncelik
    URGENT = "urgent"   # Acil

class NotificationStatus(str, Enum):
    """Bildirim durumları"""
    PENDING = "pending"     # Bekliyor
    SENT = "sent"          # Gönderildi
    READ = "read"          # Okundu
    DISMISSED = "dismissed" # Göz ardı edildi
    FAILED = "failed"      # Başarısız

class NotificationChannel(str, Enum):
    """Bildirim kanalları"""
    IN_APP = "in_app"      # Uygulama içi
    EMAIL = "email"        # E-posta
    SMS = "sms"           # SMS
    PUSH = "push"         # Push notification

class NotificationBase(BaseModel):
    """Bildirim base modeli"""
    title: str = Field(..., description="Bildirim başlığı")
    message: str = Field(..., description="Bildirim içeriği")
    type: NotificationType = Field(..., description="Bildirim türü")
    priority: NotificationPriority = Field(default=NotificationPriority.MEDIUM, description="Öncelik")
    channels: List[NotificationChannel] = Field(default_factory=lambda: [NotificationChannel.IN_APP], description="Bildirim kanalları")
    
    # İlişkili kayıtlar
    user_id: str = Field(..., description="Kullanıcı ID")
    related_entity_type: Optional[str] = Field(None, description="İlişkili entity türü (payment_order, debt, etc.)")
    related_entity_id: Optional[str] = Field(None, description="İlişkili entity ID")
    
    # Zamanlama
    scheduled_at: Optional[datetime] = Field(None, description="Zamanlanmış gönderim tarihi")
    expires_at: Optional[datetime] = Field(None, description="Son geçerlilik tarihi")
    
    # Metadata
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Ek bilgiler")
    action_url: Optional[str] = Field(None, description="Eylem URL'i")
    action_text: Optional[str] = Field(None, description="Eylem butonu metni")

class NotificationCreate(NotificationBase):
    """Bildirim oluşturma modeli"""
    pass

class NotificationUpdate(BaseModel):
    """Bildirim güncelleme modeli"""
    status: Optional[NotificationStatus] = None
    read_at: Optional[datetime] = None
    dismissed_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None

class Notification(NotificationBase):
    """Bildirim modeli"""
    id: Optional[str] = Field(default=None, alias="_id")
    status: NotificationStatus = Field(default=NotificationStatus.PENDING)
    
    # Tracking
    sent_at: Optional[datetime] = Field(None, description="Gönderim tarihi")
    read_at: Optional[datetime] = Field(None, description="Okunma tarihi")
    dismissed_at: Optional[datetime] = Field(None, description="Göz ardı edilme tarihi")
    
    # Delivery tracking
    delivery_attempts: int = Field(default=0, description="Gönderim deneme sayısı")
    last_delivery_attempt: Optional[datetime] = Field(None, description="Son gönderim denemesi")
    delivery_errors: List[str] = Field(default_factory=list, description="Gönderim hataları")
    
    # Audit
    created_by: str = Field(..., description="Oluşturan kullanıcı")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {datetime: lambda v: v.isoformat()}

class NotificationSummary(BaseModel):
    """Bildirim özet modeli"""
    id: str
    title: str
    message: str
    type: NotificationType
    priority: NotificationPriority
    status: NotificationStatus
    created_at: datetime
    read_at: Optional[datetime]
    action_url: Optional[str]
    action_text: Optional[str]

class NotificationStats(BaseModel):
    """Bildirim istatistikleri"""
    total_notifications: int = Field(0, description="Toplam bildirim sayısı")
    unread_count: int = Field(0, description="Okunmamış bildirim sayısı")
    pending_count: int = Field(0, description="Bekleyen bildirim sayısı")
    failed_count: int = Field(0, description="Başarısız bildirim sayısı")
    by_type: List[Dict[str, Any]] = Field(default_factory=list, description="Türe göre dağılım")
    by_priority: List[Dict[str, Any]] = Field(default_factory=list, description="Önceliğe göre dağılım")
    recent_notifications: List[NotificationSummary] = Field(default_factory=list, description="Son bildirimler")

class NotificationPreferences(BaseModel):
    """Kullanıcı bildirim tercihleri"""
    user_id: str = Field(..., description="Kullanıcı ID")
    
    # Kanal tercihleri
    email_enabled: bool = Field(default=True, description="E-posta bildirimleri")
    sms_enabled: bool = Field(default=False, description="SMS bildirimleri")
    push_enabled: bool = Field(default=True, description="Push bildirimleri")
    in_app_enabled: bool = Field(default=True, description="Uygulama içi bildirimler")
    
    # Tür bazlı tercihler
    payment_reminders: bool = Field(default=True, description="Ödeme hatırlatmaları")
    approval_notifications: bool = Field(default=True, description="Onay bildirimleri")
    system_notifications: bool = Field(default=True, description="Sistem bildirimleri")
    marketing_notifications: bool = Field(default=False, description="Pazarlama bildirimleri")
    
    # Zamanlama tercihleri
    quiet_hours_start: Optional[str] = Field(None, description="Sessiz saatlerin başlangıcı (HH:MM)")
    quiet_hours_end: Optional[str] = Field(None, description="Sessiz saatlerin bitişi (HH:MM)")
    weekend_notifications: bool = Field(default=False, description="Hafta sonu bildirimleri")
    
    # Frequency limits
    max_daily_notifications: int = Field(default=50, description="Günlük maksimum bildirim sayısı")
    digest_mode: bool = Field(default=False, description="Özet modu (toplu bildirim)")
    
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class NotificationTemplate(BaseModel):
    """Bildirim şablonu"""
    id: Optional[str] = Field(default=None, alias="_id")
    name: str = Field(..., description="Şablon adı")
    type: NotificationType = Field(..., description="Bildirim türü")
    
    # Template content
    title_template: str = Field(..., description="Başlık şablonu")
    message_template: str = Field(..., description="Mesaj şablonu")
    
    # Channel specific templates
    email_subject_template: Optional[str] = Field(None, description="E-posta konu şablonu")
    email_body_template: Optional[str] = Field(None, description="E-posta içerik şablonu")
    sms_template: Optional[str] = Field(None, description="SMS şablonu")
    
    # Configuration
    default_priority: NotificationPriority = Field(default=NotificationPriority.MEDIUM)
    default_channels: List[NotificationChannel] = Field(default_factory=lambda: [NotificationChannel.IN_APP])
    
    # Metadata
    variables: List[str] = Field(default_factory=list, description="Kullanılabilir değişkenler")
    is_active: bool = Field(default=True, description="Aktif durumu")
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True