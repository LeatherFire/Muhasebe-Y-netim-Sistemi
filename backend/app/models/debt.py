from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum

class DebtStatus(str, Enum):
    ACTIVE = "active"           # Aktif borç
    PAID = "paid"              # Ödenmiş
    PARTIAL = "partial"        # Kısmi ödenmiş
    OVERDUE = "overdue"        # Vadesi geçmiş
    CANCELLED = "cancelled"    # İptal edilmiş

class DebtCategory(str, Enum):
    SUPPLIER = "supplier"           # Tedarikçi borcu
    TAX = "tax"                    # Vergi borcu
    SALARY = "salary"              # Maaş borcu
    LOAN = "loan"                  # Kredi borcu
    UTILITY = "utility"            # Fatura borcu
    RENT = "rent"                  # Kira borcu
    INSURANCE = "insurance"        # Sigorta borcu
    SERVICE = "service"            # Hizmet borcu
    OTHER = "other"                # Diğer

class DebtType(str, Enum):
    PAYABLE = "payable"         # Ödenecek borç (bizim borcumuz)
    RECEIVABLE = "receivable"   # Alacak (bizden alacakları)

class DebtBase(BaseModel):
    creditor_name: str = Field(..., description="Alacaklı adı")
    debtor_name: Optional[str] = Field(None, description="Borçlu adı")
    amount: float = Field(..., gt=0, description="Borç tutarı")
    currency: str = Field(default="TRY", description="Para birimi")
    description: str = Field(..., description="Borç açıklaması")
    category: DebtCategory = Field(..., description="Borç kategorisi")
    debt_type: DebtType = Field(default=DebtType.PAYABLE, description="Borç türü")
    due_date: datetime = Field(..., description="Vade tarihi")
    interest_rate: Optional[float] = Field(None, ge=0, le=100, description="Faiz oranı (%)")
    payment_terms: Optional[str] = Field(None, description="Ödeme koşulları")
    notes: Optional[str] = Field(None, description="Notlar")

class DebtCreate(DebtBase):
    pass

class DebtUpdate(BaseModel):
    creditor_name: Optional[str] = None
    debtor_name: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0)
    currency: Optional[str] = None
    description: Optional[str] = None
    category: Optional[DebtCategory] = None
    debt_type: Optional[DebtType] = None
    due_date: Optional[datetime] = None
    interest_rate: Optional[float] = Field(None, ge=0, le=100)
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[DebtStatus] = None

class Debt(DebtBase):
    id: Optional[str] = Field(default=None, alias="_id")
    status: DebtStatus = Field(default=DebtStatus.ACTIVE)
    paid_amount: float = Field(default=0.0, description="Ödenen tutar")
    remaining_amount: float = Field(default=0.0, description="Kalan tutar")
    last_payment_date: Optional[datetime] = Field(None, description="Son ödeme tarihi")
    payment_count: int = Field(default=0, description="Ödeme sayısı")
    days_overdue: int = Field(default=0, description="Kaç gün gecikmiş")
    created_by: str = Field(..., description="Oluşturan kullanıcı ID")
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {datetime: lambda v: v.isoformat()}

class DebtSummary(BaseModel):
    """Borç özet modeli"""
    id: str
    creditor_name: str
    debtor_name: Optional[str]
    amount: float
    paid_amount: float
    remaining_amount: float
    currency: str
    category: DebtCategory
    debt_type: DebtType
    status: DebtStatus
    due_date: datetime
    days_overdue: int
    interest_rate: Optional[float]
    payment_count: int

class DebtPayment(BaseModel):
    """Borç ödeme modeli"""
    id: Optional[str] = Field(default=None, alias="_id")
    debt_id: str = Field(..., description="Borç ID")
    amount: float = Field(..., gt=0, description="Ödeme tutarı")
    payment_date: datetime = Field(..., description="Ödeme tarihi")
    payment_method: str = Field(..., description="Ödeme yöntemi")
    bank_account_id: Optional[str] = Field(None, description="Ödemenin yapıldığı banka hesabı")
    description: Optional[str] = Field(None, description="Ödeme açıklaması")
    receipt_url: Optional[str] = Field(None, description="Dekont dosya yolu")
    created_by: str = Field(..., description="Oluşturan kullanıcı ID")
    created_at: datetime

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {datetime: lambda v: v.isoformat()}

class DebtPaymentCreate(BaseModel):
    debt_id: str
    amount: float = Field(..., gt=0)
    payment_date: datetime
    payment_method: str
    bank_account_id: Optional[str] = None
    description: Optional[str] = None

class DebtStatistics(BaseModel):
    """Borç istatistikleri"""
    total_debts: int
    total_receivables: int
    total_debt_amount: float
    total_receivable_amount: float
    overdue_debts: int
    overdue_amount: float
    paid_this_month: float
    upcoming_payments: list  # Yaklaşan ödemeler