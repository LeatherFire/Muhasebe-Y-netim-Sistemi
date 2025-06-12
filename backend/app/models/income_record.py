from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from bson import ObjectId
from enum import Enum

class IncomeRecordStatus(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"

class IncomeRecord(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    company_name: str = Field(..., description="Ödeme yapan şirket adı")
    amount: float = Field(..., gt=0, description="Gelir tutarı")
    currency: str = Field(default="TRY", description="Para birimi")
    bank_account_id: str = Field(..., description="Para yatırılan banka hesabı ID")
    receipt_file: Optional[str] = Field(None, description="Dekont dosya yolu")
    description: Optional[str] = Field(None, description="Gelir açıklaması")
    income_date: datetime = Field(..., description="Gelir tarihi")
    status: IncomeRecordStatus = Field(default=IncomeRecordStatus.PENDING, description="Kayıt durumu")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Oluşturulma tarihi")
    created_by: str = Field(..., description="Kaydı oluşturan kullanıcı ID")
    verified_at: Optional[datetime] = Field(None, description="Onaylanma tarihi")
    verified_by: Optional[str] = Field(None, description="Onaylayan kullanıcı ID")
    rejection_reason: Optional[str] = Field(None, description="Red nedeni")

    class Config:
        allow_population_by_field_name = True
        populate_by_name = True
        json_encoders = {
            ObjectId: str,
            datetime: lambda dt: dt.isoformat()
        }

class IncomeRecordCreate(BaseModel):
    company_name: str
    amount: float = Field(..., gt=0)
    currency: str = Field(default="TRY")
    bank_account_id: str
    description: Optional[str] = None
    income_date: datetime

class IncomeRecordUpdate(BaseModel):
    company_name: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0)
    currency: Optional[str] = None
    bank_account_id: Optional[str] = None
    description: Optional[str] = None
    income_date: Optional[datetime] = None
    status: Optional[IncomeRecordStatus] = None
    rejection_reason: Optional[str] = None

class IncomeRecordSummary(BaseModel):
    id: str
    company_name: str
    amount: float
    currency: str
    bank_account_name: str
    status: IncomeRecordStatus
    income_date: datetime
    created_at: datetime
    has_receipt: bool

class IncomeStatistics(BaseModel):
    total_records: int = Field(description="Toplam kayıt sayısı")
    pending_count: int = Field(description="Bekleyen kayıt sayısı")
    verified_count: int = Field(description="Onaylanan kayıt sayısı")
    rejected_count: int = Field(description="Reddedilen kayıt sayısı")
    total_verified_amount: float = Field(description="Onaylanan toplam tutar")
    current_month_income: float = Field(description="Bu ay geliri")
    previous_month_income: float = Field(description="Geçen ay geliri")
    monthly_growth_rate: float = Field(description="Aylık büyüme oranı")
    top_companies: list = Field(description="En çok ödeme yapan şirketler")
    monthly_trend: list = Field(description="Aylık trend verileri")