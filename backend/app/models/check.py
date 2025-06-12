from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum

class CheckStatus(str, Enum):
    ACTIVE = "active"           # Aktif çek
    CASHED = "cashed"          # Tahsil edilmiş
    RETURNED = "returned"       # İade edilmiş
    CANCELLED = "cancelled"     # İptal edilmiş
    LOST = "lost"              # Kayıp
    EARLY_CASHED = "early_cashed"  # Erken bozdurulmuş

class CheckType(str, Enum):
    RECEIVED = "received"       # Aldığımız çek
    ISSUED = "issued"          # Verdiğimiz çek

class CheckBase(BaseModel):
    amount: float = Field(..., gt=0, description="Çek tutarı")
    currency: str = Field(default="TRY", description="Para birimi")
    check_number: str = Field(..., description="Çek numarası")
    bank_name: str = Field(..., description="Banka adı")
    branch_name: Optional[str] = Field(None, description="Şube adı")
    account_number: Optional[str] = Field(None, description="Hesap numarası")
    drawer_name: str = Field(..., description="Çeken kişi/kurum adı")
    drawer_id_number: Optional[str] = Field(None, description="Çeken kimlik/vergi numarası")
    payee_name: Optional[str] = Field(None, description="Lehtar adı")
    issue_date: datetime = Field(..., description="Çek tarihi")
    due_date: datetime = Field(..., description="Vade tarihi")
    check_type: CheckType = Field(..., description="Çek türü")
    description: Optional[str] = Field(None, description="Açıklama")
    location: Optional[str] = Field(None, description="Çek yeri")
    notes: Optional[str] = Field(None, description="Notlar")

class CheckCreate(CheckBase):
    pass

class CheckUpdate(BaseModel):
    amount: Optional[float] = Field(None, gt=0)
    currency: Optional[str] = None
    check_number: Optional[str] = None
    bank_name: Optional[str] = None
    branch_name: Optional[str] = None
    account_number: Optional[str] = None
    drawer_name: Optional[str] = None
    drawer_id_number: Optional[str] = None
    payee_name: Optional[str] = None
    issue_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    check_type: Optional[CheckType] = None
    description: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[CheckStatus] = None

class Check(CheckBase):
    id: Optional[str] = Field(default=None, alias="_id")
    status: CheckStatus = Field(default=CheckStatus.ACTIVE)
    early_discount_rate: Optional[float] = Field(None, ge=0, le=100, description="Erken bozdurma indirimi (%)")
    early_cash_amount: Optional[float] = Field(None, description="Erken bozdurma tutarı")
    cash_date: Optional[datetime] = Field(None, description="Tahsil tarihi")
    return_reason: Optional[str] = Field(None, description="İade sebebi")
    days_to_due: int = Field(default=0, description="Vadeye kaç gün kaldı")
    is_overdue: bool = Field(default=False, description="Vadesi geçti mi")
    receipt_url: Optional[str] = Field(None, description="Çek resmi/fotoğrafı")
    created_by: str = Field(..., description="Oluşturan kullanıcı ID")
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {datetime: lambda v: v.isoformat()}

class CheckSummary(BaseModel):
    """Çek özet modeli"""
    id: str
    amount: float
    currency: str
    check_number: str
    bank_name: str
    drawer_name: str
    due_date: datetime
    check_type: CheckType
    status: CheckStatus
    days_to_due: int
    is_overdue: bool
    early_discount_rate: Optional[float]
    potential_early_amount: Optional[float]

class CheckOperation(BaseModel):
    """Çek işlem modeli"""
    id: Optional[str] = Field(default=None, alias="_id")
    check_id: str = Field(..., description="Çek ID")
    operation_type: str = Field(..., description="İşlem türü")  # "cash", "early_cash", "return", "cancel"
    operation_date: datetime = Field(..., description="İşlem tarihi")
    amount: Optional[float] = Field(None, description="İşlem tutarı")
    bank_account_id: Optional[str] = Field(None, description="İlgili banka hesabı")
    discount_rate: Optional[float] = Field(None, description="İndirim oranı")
    fees: Optional[float] = Field(None, description="Masraf")
    description: Optional[str] = Field(None, description="İşlem açıklaması")
    receipt_url: Optional[str] = Field(None, description="İşlem dekontunun yolu")
    created_by: str = Field(..., description="Oluşturan kullanıcı ID")
    created_at: datetime

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {datetime: lambda v: v.isoformat()}

class CheckOperationCreate(BaseModel):
    check_id: str
    operation_type: str
    operation_date: datetime
    amount: Optional[float] = None
    bank_account_id: Optional[str] = None
    discount_rate: Optional[float] = None
    fees: Optional[float] = None
    description: Optional[str] = None

class CheckStatistics(BaseModel):
    """Çek istatistikleri"""
    total_checks: int
    total_received: int
    total_issued: int
    total_value: float
    active_checks: int
    active_value: float
    overdue_checks: int
    overdue_value: float
    cashed_this_month: float
    upcoming_due: list  # Yaklaşan vadeli çekler

class CheckAnalysisResult(BaseModel):
    """AI çek analiz sonucu"""
    success: bool
    extracted_amount: Optional[float] = None
    extracted_check_number: Optional[str] = None
    extracted_bank: Optional[str] = None
    extracted_date: Optional[datetime] = None
    extracted_due_date: Optional[datetime] = None
    extracted_drawer: Optional[str] = None
    extracted_payee: Optional[str] = None
    confidence_score: Optional[float] = None
    raw_text: Optional[str] = None
    error_message: Optional[str] = None