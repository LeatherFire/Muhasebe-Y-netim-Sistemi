from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum

class AccountType(str, Enum):
    CHECKING = "checking"  # Vadesiz
    SAVINGS = "savings"    # Vadeli
    BUSINESS = "business"  # Ticari
    FOREIGN = "foreign"    # Döviz

class BankAccountBase(BaseModel):
    name: str = Field(..., description="Hesap adı")
    iban: str = Field(..., description="IBAN numarası", min_length=26, max_length=34)
    bank_name: str = Field(..., description="Banka adı")
    account_type: AccountType = Field(default=AccountType.CHECKING, description="Hesap türü")
    currency: str = Field(default="TRY", description="Para birimi")
    initial_balance: float = Field(default=0.0, description="Başlangıç bakiyesi")

class BankAccountCreate(BankAccountBase):
    pass

class BankAccountUpdate(BaseModel):
    name: Optional[str] = None
    bank_name: Optional[str] = None
    account_type: Optional[AccountType] = None
    currency: Optional[str] = None

class BankAccount(BankAccountBase):
    id: Optional[str] = Field(default=None, alias="_id")
    current_balance: float = Field(default=0.0, description="Güncel bakiye")
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {datetime: lambda v: v.isoformat()}

class BankAccountSummary(BaseModel):
    """Özet bilgiler için kullanılacak model"""
    id: str
    name: str
    bank_name: str
    current_balance: float
    currency: str
    account_type: AccountType