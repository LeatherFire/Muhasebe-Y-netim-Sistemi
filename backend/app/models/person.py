from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class PersonBase(BaseModel):
    name: str = Field(..., description="Kişi/kurum adı")
    iban: Optional[str] = Field(None, description="IBAN numarası")
    phone: Optional[str] = Field(None, description="Telefon numarası")
    email: Optional[str] = Field(None, description="E-posta adresi")
    company: Optional[str] = Field(None, description="Şirket adı")
    tax_number: Optional[str] = Field(None, description="Vergi numarası")
    tax_office: Optional[str] = Field(None, description="Vergi dairesi")
    address: Optional[str] = Field(None, description="Adres")
    notes: Optional[str] = Field(None, description="Notlar")
    person_type: str = Field(default="individual", description="Kişi türü") # "individual", "company"

class PersonCreate(PersonBase):
    pass

class PersonUpdate(BaseModel):
    name: Optional[str] = None
    iban: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    company: Optional[str] = None
    tax_number: Optional[str] = None
    tax_office: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    person_type: Optional[str] = None

class Person(PersonBase):
    id: Optional[str] = Field(default=None, alias="_id")
    total_sent: float = Field(default=0.0, description="Toplam gönderilen tutar")
    total_received: float = Field(default=0.0, description="Toplam alınan tutar")
    transaction_count: int = Field(default=0, description="Toplam işlem sayısı")
    last_transaction_date: Optional[datetime] = Field(None, description="Son işlem tarihi")
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {datetime: lambda v: v.isoformat()}

class PersonSummary(BaseModel):
    """Kişi özet modeli"""
    id: str
    name: str
    person_type: str
    company: Optional[str]
    iban: Optional[str]
    total_sent: float
    total_received: float
    transaction_count: int
    last_transaction_date: Optional[datetime]
    net_balance: float  # total_received - total_sent

class PersonTransactionSummary(BaseModel):
    """Kişi işlem özeti"""
    person_id: str
    person_name: str
    transaction_id: str
    transaction_type: str
    amount: float
    description: str
    transaction_date: datetime
    bank_account_name: Optional[str]
    receipt_url: Optional[str]

class PersonStatistics(BaseModel):
    """Kişi istatistikleri"""
    total_people: int
    total_companies: int
    total_transactions: float
    top_recipients: list  # En çok para gönderilen kişiler
    top_senders: list     # En çok para alınan kişiler
    recent_activity: list # Son aktiviteler