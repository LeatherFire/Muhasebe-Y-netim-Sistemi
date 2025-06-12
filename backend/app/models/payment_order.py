from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum

class PaymentStatus(str, Enum):
    PENDING = "pending"      # Bekliyor
    APPROVED = "approved"    # Onaylandı
    COMPLETED = "completed"  # Tamamlandı
    REJECTED = "rejected"    # Reddedildi
    CANCELLED = "cancelled"  # İptal edildi

class PaymentCategory(str, Enum):
    OFFICE_SUPPLIES = "office_supplies"     # Ofis malzemeleri
    UTILITIES = "utilities"                 # Faturalar
    SALARY = "salary"                       # Maaş
    RENT = "rent"                          # Kira
    INSURANCE = "insurance"                 # Sigorta
    TAX = "tax"                            # Vergi
    LOAN = "loan"                          # Kredi
    SUPPLIER = "supplier"                   # Tedarikçi
    SERVICE = "service"                     # Hizmet
    OTHER = "other"                        # Diğer

class PaymentOrderBase(BaseModel):
    recipient_name: str = Field(..., description="Alıcı adı")
    recipient_iban: str = Field(..., description="Alıcı IBAN", min_length=26, max_length=34)
    amount: float = Field(..., gt=0, description="Tutar")
    currency: str = Field(default="TRY", description="Para birimi")
    description: str = Field(..., description="Açıklama", max_length=500)
    category: Optional[PaymentCategory] = Field(default=PaymentCategory.OTHER, description="Kategori")
    due_date: Optional[datetime] = Field(default=None, description="Ödeme tarihi")

class PaymentOrderCreate(PaymentOrderBase):
    pass

class PaymentOrderUpdate(BaseModel):
    recipient_name: Optional[str] = None
    recipient_iban: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0)
    currency: Optional[str] = None
    description: Optional[str] = Field(None, max_length=500)
    category: Optional[PaymentCategory] = None
    due_date: Optional[datetime] = None
    status: Optional[PaymentStatus] = None

class PaymentOrder(PaymentOrderBase):
    id: Optional[str] = Field(default=None, alias="_id")
    created_by: str = Field(..., description="Oluşturan kullanıcı ID")
    status: PaymentStatus = Field(default=PaymentStatus.PENDING, description="Durum")
    ai_processed_description: Optional[str] = Field(None, description="AI tarafından işlenmiş açıklama")
    ai_suggested_category: Optional[PaymentCategory] = Field(None, description="AI tarafından önerilen kategori")
    receipt_url: Optional[str] = Field(None, description="Dekont dosya yolu")
    bank_account_id: Optional[str] = Field(None, description="Kullanılan banka hesabı ID")
    approved_by: Optional[str] = Field(None, description="Onaylayan kullanıcı ID")
    completed_at: Optional[datetime] = Field(None, description="Tamamlanma tarihi")
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {datetime: lambda v: v.isoformat()}

class PaymentOrderSummary(BaseModel):
    """Özet bilgiler için kullanılacak model"""
    id: str
    recipient_name: str
    amount: float
    currency: str
    status: PaymentStatus
    category: Optional[PaymentCategory]
    created_at: datetime
    due_date: Optional[datetime]