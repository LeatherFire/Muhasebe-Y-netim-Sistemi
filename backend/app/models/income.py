from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class IncomeType(str, Enum):
    RECURRING = "recurring"  # Düzenli gelir
    ONE_TIME = "one_time"   # Tek seferlik
    PROJECT_BASED = "project_based"  # Proje bazlı
    COMMISSION = "commission"  # Komisyon
    INVESTMENT = "investment"  # Yatırım getirisi
    OTHER = "other"  # Diğer

class IncomeStatus(str, Enum):
    PLANNED = "planned"      # Planlandı
    INVOICED = "invoiced"    # Faturalandı
    PAID = "paid"           # Ödendi
    OVERDUE = "overdue"     # Gecikmiş
    CANCELLED = "cancelled"  # İptal edildi

class RecurrenceType(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"

class IncomeSourceBase(BaseModel):
    name: str = Field(..., description="Gelir kaynağı adı")
    description: Optional[str] = Field(None, description="Açıklama")
    person_id: Optional[str] = Field(None, description="İlgili kişi/kurum ID")
    income_type: IncomeType = Field(..., description="Gelir türü")
    category: str = Field(..., description="Gelir kategorisi")
    expected_amount: float = Field(..., gt=0, description="Beklenen tutar")
    currency: str = Field(default="TRY", description="Para birimi")
    is_recurring: bool = Field(False, description="Tekrarlayan gelir mi")
    recurrence_type: Optional[RecurrenceType] = Field(None, description="Tekrar türü")
    recurrence_interval: Optional[int] = Field(None, description="Tekrar aralığı")
    start_date: datetime = Field(..., description="Başlangıç tarihi")
    end_date: Optional[datetime] = Field(None, description="Bitiş tarihi")
    is_active: bool = Field(True, description="Aktif mi")
    notes: Optional[str] = Field(None, description="Notlar")

class IncomeSourceCreate(IncomeSourceBase):
    pass

class IncomeSourceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    person_id: Optional[str] = None
    income_type: Optional[IncomeType] = None
    category: Optional[str] = None
    expected_amount: Optional[float] = Field(None, gt=0)
    currency: Optional[str] = None
    is_recurring: Optional[bool] = None
    recurrence_type: Optional[RecurrenceType] = None
    recurrence_interval: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None

class IncomeSource(IncomeSourceBase):
    id: Optional[str] = Field(default=None, alias="_id")
    total_received: float = Field(0.0, description="Toplam alınan tutar")
    total_expected: float = Field(0.0, description="Toplam beklenen tutar")
    income_count: int = Field(0, description="Gelir sayısı")
    last_income_date: Optional[datetime] = Field(None, description="Son gelir tarihi")
    next_expected_date: Optional[datetime] = Field(None, description="Sonraki beklenen tarih")
    created_by: str = Field(..., description="Oluşturan kullanıcı")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {datetime: lambda v: v.isoformat()}

class IncomeRecordBase(BaseModel):
    income_source_id: str = Field(..., description="Gelir kaynağı ID")
    amount: float = Field(..., gt=0, description="Gelir tutarı")
    currency: str = Field(default="TRY", description="Para birimi")
    description: str = Field(..., description="Gelir açıklaması")
    expected_date: datetime = Field(..., description="Beklenen tarih")
    actual_date: Optional[datetime] = Field(None, description="Gerçekleşen tarih")
    status: IncomeStatus = Field(IncomeStatus.PLANNED, description="Durum")
    invoice_number: Optional[str] = Field(None, description="Fatura numarası")
    transaction_id: Optional[str] = Field(None, description="İlgili işlem ID")
    bank_account_id: Optional[str] = Field(None, description="Banka hesabı ID")
    payment_method: Optional[str] = Field(None, description="Ödeme yöntemi")
    late_fee: float = Field(0.0, description="Gecikme ücreti")
    discount: float = Field(0.0, description="İndirim")
    tax_amount: float = Field(0.0, description="Vergi tutarı")
    net_amount: float = Field(0.0, description="Net tutar")
    notes: Optional[str] = Field(None, description="Notlar")

class IncomeRecordCreate(IncomeRecordBase):
    pass

class IncomeRecordUpdate(BaseModel):
    amount: Optional[float] = Field(None, gt=0)
    currency: Optional[str] = None
    description: Optional[str] = None
    expected_date: Optional[datetime] = None
    actual_date: Optional[datetime] = None
    status: Optional[IncomeStatus] = None
    invoice_number: Optional[str] = None
    transaction_id: Optional[str] = None
    bank_account_id: Optional[str] = None
    payment_method: Optional[str] = None
    late_fee: Optional[float] = None
    discount: Optional[float] = None
    tax_amount: Optional[float] = None
    net_amount: Optional[float] = None
    notes: Optional[str] = None

class IncomeRecord(IncomeRecordBase):
    id: Optional[str] = Field(default=None, alias="_id")
    created_by: str = Field(..., description="Oluşturan kullanıcı")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {datetime: lambda v: v.isoformat()}

class IncomeSourceSummary(BaseModel):
    """Gelir kaynağı özeti"""
    id: str
    name: str
    income_type: IncomeType
    category: str
    expected_amount: float
    currency: str
    total_received: float
    total_expected: float
    income_count: int
    last_income_date: Optional[datetime]
    next_expected_date: Optional[datetime]
    status: str  # "active", "overdue", "upcoming"
    person_name: Optional[str]
    completion_rate: float  # Gerçekleşme oranı

class IncomeRecordSummary(BaseModel):
    """Gelir kaydı özeti"""
    id: str
    income_source_name: str
    amount: float
    currency: str
    description: str
    expected_date: datetime
    actual_date: Optional[datetime]
    status: IncomeStatus
    invoice_number: Optional[str]
    days_overdue: Optional[int]
    person_name: Optional[str]

class IncomeStatistics(BaseModel):
    """Gelir istatistikleri"""
    total_sources: int = Field(0, description="Toplam gelir kaynağı")
    active_sources: int = Field(0, description="Aktif gelir kaynakları")
    recurring_sources: int = Field(0, description="Tekrarlayan gelir kaynakları")
    total_expected_this_month: float = Field(0.0, description="Bu ay beklenen toplam")
    total_received_this_month: float = Field(0.0, description="Bu ay alınan toplam")
    total_overdue: float = Field(0.0, description="Toplam gecikmiş")
    overdue_count: int = Field(0, description="Gecikmiş gelir sayısı")
    upcoming_week: float = Field(0.0, description="Gelecek hafta beklenen")
    upcoming_month: float = Field(0.0, description="Gelecek ay beklenen")
    top_sources: List[Dict[str, Any]] = Field(default_factory=list, description="En büyük gelir kaynakları")
    monthly_trends: List[Dict[str, Any]] = Field(default_factory=list, description="Aylık trendler")
    by_category: List[Dict[str, Any]] = Field(default_factory=list, description="Kategoriye göre dağılım")
    by_status: List[Dict[str, Any]] = Field(default_factory=list, description="Duruma göre dağılım")

class IncomeProjection(BaseModel):
    """Gelir projeksiyonu"""
    month: str = Field(..., description="Ay (YYYY-MM)")
    expected_total: float = Field(0.0, description="Beklenen toplam")
    confirmed_total: float = Field(0.0, description="Kesinleşen toplam")
    recurring_total: float = Field(0.0, description="Tekrarlayan toplam")
    one_time_total: float = Field(0.0, description="Tek seferlik toplam")
    confidence_level: float = Field(0.0, description="Güven seviyesi (0-100)")

class IncomeForecast(BaseModel):
    """Gelir tahmini"""
    next_6_months: List[IncomeProjection] = Field(default_factory=list, description="Sonraki 6 ay")
    yearly_projection: float = Field(0.0, description="Yıllık projeksiyon")
    growth_rate: float = Field(0.0, description="Büyüme oranı")
    seasonality_factor: float = Field(1.0, description="Mevsimsellik faktörü")
    risk_level: str = Field("medium", description="Risk seviyesi")  # low, medium, high