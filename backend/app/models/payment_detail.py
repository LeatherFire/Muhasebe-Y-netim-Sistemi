from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class PaymentDetailBase(BaseModel):
    person_id: str = Field(..., description="Kişi ID")
    transaction_id: Optional[str] = Field(None, description="İlgili işlem ID")
    payment_type: str = Field(..., description="Ödeme türü") # "outgoing", "incoming"
    amount: float = Field(..., gt=0, description="Ödeme tutarı")
    currency: str = Field(default="TRY", description="Para birimi")
    description: str = Field(..., description="Ödeme açıklaması")
    payment_method: str = Field(..., description="Ödeme yöntemi") # "bank_transfer", "cash", "check", "credit_card"
    bank_account_id: Optional[str] = Field(None, description="Kullanılan banka hesabı")
    reference_number: Optional[str] = Field(None, description="Referans numarası")
    payment_date: datetime = Field(..., description="Ödeme tarihi")
    receipt_urls: List[str] = Field(default_factory=list, description="Dekont dosya yolları")
    status: str = Field(default="completed", description="Ödeme durumu") # "completed", "pending", "cancelled"
    notes: Optional[str] = Field(None, description="Ek notlar")

class PaymentDetailCreate(PaymentDetailBase):
    pass

class PaymentDetailUpdate(BaseModel):
    amount: Optional[float] = Field(None, gt=0)
    currency: Optional[str] = None
    description: Optional[str] = None
    payment_method: Optional[str] = None
    bank_account_id: Optional[str] = None
    reference_number: Optional[str] = None
    payment_date: Optional[datetime] = None
    receipt_urls: Optional[List[str]] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class PaymentDetail(PaymentDetailBase):
    id: Optional[str] = Field(default=None, alias="_id")
    created_by: str = Field(..., description="Oluşturan kullanıcı ID")
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {datetime: lambda v: v.isoformat()}

class PaymentDetailSummary(BaseModel):
    """Ödeme detay özeti"""
    id: str
    person_name: str
    payment_type: str
    amount: float
    currency: str
    description: str
    payment_method: str
    payment_date: datetime
    status: str
    receipt_count: int

class PaymentDetailStatistics(BaseModel):
    """Ödeme detayları istatistikleri"""
    total_payments: int
    total_outgoing: float
    total_incoming: float
    net_flow: float
    payments_today: int
    payments_this_month: int
    popular_payment_methods: List[dict]  # En çok kullanılan ödeme yöntemleri
    top_recipients: List[dict]  # En çok ödeme yapılan kişiler
    recent_payments: List[dict]  # Son ödemeler

class AutoPersonCreate(BaseModel):
    """Otomatik kişi oluşturma için model"""
    name: str = Field(..., description="Kişi/kurum adı")
    person_type: str = Field(default="individual", description="Kişi türü")
    phone: Optional[str] = Field(None, description="Telefon numarası")
    iban: Optional[str] = Field(None, description="IBAN numarası")
    tax_number: Optional[str] = Field(None, description="Vergi numarası")
    company: Optional[str] = Field(None, description="Şirket adı")
    source: str = Field(..., description="Oluşturma kaynağı") # "transaction", "payment", "manual"