from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum

class TransactionType(str, Enum):
    INCOME = "income"           # Para girişi
    EXPENSE = "expense"         # Para çıkışı  
    TRANSFER = "transfer"       # Hesaplar arası transfer
    FEE = "fee"                # İşlem ücreti
    INTEREST = "interest"       # Faiz
    REFUND = "refund"          # İade

class TransactionStatus(str, Enum):
    PENDING = "pending"         # Bekliyor
    COMPLETED = "completed"     # Tamamlandı
    FAILED = "failed"          # Başarısız
    CANCELLED = "cancelled"     # İptal edildi

class FeeType(str, Enum):
    TRANSFER_FEE = "transfer_fee"           # Transfer ücreti
    COMMISSION = "commission"               # Komisyon
    BANK_FEE = "bank_fee"                  # Banka ücreti
    CURRENCY_CONVERSION = "currency_conversion"  # Döviz çevrim ücreti
    OTHER = "other"                        # Diğer

class TransactionBase(BaseModel):
    type: TransactionType
    amount: float = Field(..., gt=0, description="İşlem tutarı")
    currency: str = Field(default="TRY", description="Para birimi")
    description: str = Field(..., description="İşlem açıklaması")
    reference_number: Optional[str] = Field(None, description="Referans numarası")
    
    # İlişkili kayıtlar
    bank_account_id: str = Field(..., description="Banka hesabı ID")
    payment_order_id: Optional[str] = Field(None, description="Ödeme emri ID")
    person_id: Optional[str] = Field(None, description="Kişi/kurum ID")
    
    # Fees - İşlem ücretleri
    fees: Optional[Dict[str, float]] = Field(default_factory=dict, description="İşlem ücretleri")
    total_fees: float = Field(default=0.0, description="Toplam ücret")
    
    # AI extracted data from receipt
    ai_extracted_data: Optional[Dict[str, Any]] = Field(None, description="AI'dan çıkarılan veriler")
    
    transaction_date: datetime = Field(..., description="İşlem tarihi")

class TransactionCreate(TransactionBase):
    pass

class TransactionUpdate(BaseModel):
    type: Optional[TransactionType] = None
    amount: Optional[float] = Field(None, gt=0)
    currency: Optional[str] = None
    description: Optional[str] = None
    reference_number: Optional[str] = None
    person_id: Optional[str] = None
    fees: Optional[Dict[str, float]] = None
    total_fees: Optional[float] = None
    ai_extracted_data: Optional[Dict[str, Any]] = None
    transaction_date: Optional[datetime] = None
    status: Optional[TransactionStatus] = None

class Transaction(TransactionBase):
    id: str
    status: TransactionStatus = Field(default=TransactionStatus.COMPLETED)
    
    # Calculated fields
    net_amount: float = Field(default=0.0, description="Net tutar (fees dahil)")
    balance_impact: float = Field(default=0.0, description="Bakiye etkisi")
    
    # Receipt/document info
    receipt_url: Optional[str] = Field(None, description="Dekont dosya yolu")
    receipt_filename: Optional[str] = Field(None, description="Dekont dosya adı")
    receipt_analysis: Optional[Dict[str, Any]] = Field(None, description="Dekont AI analizi")
    
    # Audit trail
    created_by: str = Field(..., description="Oluşturan kullanıcı ID")
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {datetime: lambda v: v.isoformat()}

class TransactionSummary(BaseModel):
    """İşlem özet modeli"""
    id: str
    type: TransactionType
    amount: float
    currency: str
    description: str
    bank_account_name: str
    person_name: Optional[str]
    status: TransactionStatus
    transaction_date: datetime
    receipt_url: Optional[str]
    total_fees: float

class ReceiptAnalysisResult(BaseModel):
    """Dekont analiz sonucu"""
    success: bool
    extracted_amount: Optional[float] = None
    extracted_date: Optional[datetime] = None
    extracted_bank: Optional[str] = None
    extracted_account: Optional[str] = None
    extracted_reference: Optional[str] = None
    extracted_fees: Optional[Dict[str, float]] = None
    total_extracted_fees: Optional[float] = None
    recipient_info: Optional[Dict[str, str]] = None
    confidence_score: Optional[float] = None
    raw_text: Optional[str] = None
    error_message: Optional[str] = None

class FeeCalculation(BaseModel):
    """Ücret hesaplama modeli"""
    base_amount: float
    fees: Dict[str, float]
    total_fees: float
    net_amount: float
    description: str