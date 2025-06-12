from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class CreditCardBase(BaseModel):
    name: str = Field(..., description="Kart adı")
    bank_name: str = Field(..., description="Banka adı")
    limit: float = Field(..., gt=0, description="Kart limiti")
    used_amount: float = Field(default=0.0, ge=0, description="Kullanılan tutar")
    statement_date: int = Field(..., ge=1, le=31, description="Hesap kesim günü (ayın kaçıncı günü)")
    due_date: int = Field(..., ge=1, le=31, description="Son ödeme günü (ayın kaçıncı günü)")
    flexible_account: bool = Field(default=False, description="Esnek hesap özelliği var mı")

class CreditCardCreate(CreditCardBase):
    pass

class CreditCardUpdate(BaseModel):
    name: Optional[str] = None
    bank_name: Optional[str] = None
    limit: Optional[float] = Field(None, gt=0)
    used_amount: Optional[float] = Field(None, ge=0)
    statement_date: Optional[int] = Field(None, ge=1, le=31)
    due_date: Optional[int] = Field(None, ge=1, le=31)
    flexible_account: Optional[bool] = None

class CreditCard(CreditCardBase):
    id: Optional[str] = Field(default=None, alias="_id")
    available_limit: float = Field(default=0.0, description="Kullanılabilir limit")
    usage_percentage: float = Field(default=0.0, description="Kullanım yüzdesi")
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {datetime: lambda v: v.isoformat()}

class CreditCardSummary(BaseModel):
    """Kredi kartı özet modeli"""
    id: str
    name: str
    bank_name: str
    limit: float
    used_amount: float
    available_limit: float
    usage_percentage: float
    statement_date: int
    due_date: int
    flexible_account: bool
    days_to_statement: int
    days_to_due: int

class CreditCardTransaction(BaseModel):
    """Kredi kartı işlem modeli"""
    id: Optional[str] = Field(default=None, alias="_id")
    credit_card_id: str = Field(..., description="Kredi kartı ID")
    amount: float = Field(..., gt=0, description="İşlem tutarı")
    description: str = Field(..., description="İşlem açıklaması")
    category: Optional[str] = Field(None, description="İşlem kategorisi")
    merchant: Optional[str] = Field(None, description="Satıcı adı")
    transaction_date: datetime = Field(..., description="İşlem tarihi")
    installments: int = Field(default=1, ge=1, description="Taksit sayısı")
    installment_amount: Optional[float] = Field(None, description="Taksit tutarı")
    created_by: str = Field(..., description="Oluşturan kullanıcı ID")
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {datetime: lambda v: v.isoformat()}

class CreditCardTransactionCreate(BaseModel):
    credit_card_id: str
    amount: float = Field(..., gt=0)
    description: str
    category: Optional[str] = None
    merchant: Optional[str] = None
    transaction_date: datetime
    installments: int = Field(default=1, ge=1)

class CreditCardPayment(BaseModel):
    """Kredi kartı ödeme modeli"""
    id: Optional[str] = Field(default=None, alias="_id")
    credit_card_id: str = Field(..., description="Kredi kartı ID")
    amount: float = Field(..., gt=0, description="Ödeme tutarı")
    payment_date: datetime = Field(..., description="Ödeme tarihi")
    payment_type: str = Field(..., description="Ödeme türü") # "minimum", "full", "partial"
    bank_account_id: Optional[str] = Field(None, description="Ödemenin yapıldığı banka hesabı")
    description: Optional[str] = Field(None, description="Ödeme açıklaması")
    created_by: str = Field(..., description="Oluşturan kullanıcı ID")
    created_at: datetime

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {datetime: lambda v: v.isoformat()}

class CreditCardPaymentCreate(BaseModel):
    credit_card_id: str
    amount: float = Field(..., gt=0)
    payment_date: datetime
    payment_type: str
    bank_account_id: Optional[str] = None
    description: Optional[str] = None