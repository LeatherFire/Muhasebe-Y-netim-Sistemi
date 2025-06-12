from pydantic import BaseModel, Field, validator
from typing import Optional, List, Union
from datetime import datetime, date
from enum import Enum

class EmployeeStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    PROBATION = "probation"

class EmployeePosition(str, Enum):
    CHEF = "chef"
    SOUS_CHEF = "sous_chef"
    COOK = "cook"
    KITCHEN_HELPER = "kitchen_helper"
    DISHWASHER = "dishwasher"
    SERVER = "server"
    CASHIER = "cashier"
    MANAGER = "manager"
    CLEANER = "cleaner"
    OTHER = "other"

class DocumentType(str, Enum):
    ID_CARD = "id_card"
    HEALTH_CERTIFICATE = "health_certificate"
    WORK_PERMIT = "work_permit"
    CONTRACT = "contract"
    DIPLOMA = "diploma"
    REFERENCE = "reference"
    OTHER = "other"

class EmployeeDocument(BaseModel):
    type: DocumentType
    filename: str
    file_path: str
    upload_date: datetime
    description: Optional[str] = None

class EmployeeBase(BaseModel):
    first_name: str = Field(..., description="Ad")
    last_name: str = Field(..., description="Soyad")
    tc_number: str = Field(..., description="TC Kimlik Numarası")
    phone: str = Field(..., description="Telefon numarası")
    email: Optional[str] = Field(None, description="E-posta adresi")
    address: str = Field(..., description="Adres")
    birth_date: Union[datetime, date, str] = Field(..., description="Doğum tarihi")
    
    # İş bilgileri
    position: EmployeePosition = Field(..., description="Pozisyon")
    department: str = Field(default="Mutfak", description="Departman")
    hire_date: Union[datetime, date, str] = Field(..., description="İşe giriş tarihi")
    salary: float = Field(..., description="Maaş")
    
    # İletişim ve acil durum
    emergency_contact_name: Optional[str] = Field(None, description="Acil durum iletişim kişisi")
    emergency_contact_phone: Optional[str] = Field(None, description="Acil durum telefonu")
    
    # Çalışma koşulları
    work_schedule: Optional[str] = Field(None, description="Çalışma programı")
    contract_type: Optional[str] = Field(default="full_time", description="Sözleşme türü")
    
    # Notlar
    notes: Optional[str] = Field(None, description="Notlar")
    
    @validator('birth_date', 'hire_date', pre=True)
    def parse_date(cls, v):
        if isinstance(v, str):
            try:
                return datetime.fromisoformat(v.replace('Z', '+00:00'))
            except:
                return datetime.fromisoformat(v)
        return v

class EmployeeCreate(EmployeeBase):
    pass

class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    tc_number: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    birth_date: Optional[datetime] = None
    position: Optional[EmployeePosition] = None
    department: Optional[str] = None
    hire_date: Optional[datetime] = None
    salary: Optional[float] = None
    status: Optional[EmployeeStatus] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    work_schedule: Optional[str] = None
    contract_type: Optional[str] = None
    notes: Optional[str] = None

class Employee(EmployeeBase):
    id: Optional[str] = Field(default=None, alias="_id")
    status: EmployeeStatus = Field(default=EmployeeStatus.ACTIVE, description="Çalışma durumu")
    documents: List[EmployeeDocument] = Field(default=[], description="Belgeler")
    
    # AI ile oluşturulan alanlar
    ai_profile_summary: Optional[str] = Field(None, description="AI ile oluşturulan profil özeti")
    ai_generated_avatar: Optional[str] = Field(None, description="AI ile oluşturulan profil resmi URL")
    ai_analysis_date: Optional[datetime] = Field(None, description="AI analiz tarihi")
    
    # Sistem alanları
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: str = Field(..., description="Oluşturan kullanıcı ID")

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {datetime: lambda v: v.isoformat()}

class EmployeeSummary(BaseModel):
    """Çalışan özet modeli"""
    id: str
    first_name: str
    last_name: str
    full_name: str
    position: EmployeePosition
    department: str
    status: EmployeeStatus
    hire_date: datetime
    salary: float
    phone: str
    has_avatar: bool
    document_count: int

class EmployeeStatistics(BaseModel):
    """Çalışan istatistikleri"""
    total_employees: int
    active_employees: int
    inactive_employees: int
    probation_employees: int
    total_monthly_salary: float
    average_salary: float
    departments: dict  # departman -> çalışan sayısı
    positions: dict    # pozisyon -> çalışan sayısı
    recent_hires: List[EmployeeSummary]  # Son işe alınanlar

class AIProfileRequest(BaseModel):
    """AI profil analizi isteği"""
    employee_data: dict
    generate_avatar: bool = True
    
class AIProfileResponse(BaseModel):
    """AI profil analizi yanıtı"""
    profile_summary: str
    avatar_url: Optional[str] = None
    confidence_score: float
    analysis_points: List[str]