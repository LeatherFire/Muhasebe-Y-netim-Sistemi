from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any, Union
from datetime import datetime, date
from enum import Enum

class ReportType(str, Enum):
    INCOME_EXPENSE = "income_expense"
    MONTHLY_SUMMARY = "monthly_summary"
    YEARLY_SUMMARY = "yearly_summary"
    BANK_ACCOUNT_SUMMARY = "bank_account_summary"
    PERSON_SUMMARY = "person_summary"
    PAYMENT_METHOD_ANALYSIS = "payment_method_analysis"
    CASH_FLOW = "cash_flow"

class ReportPeriod(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    CUSTOM = "custom"

class ReportFormat(str, Enum):
    JSON = "json"
    PDF = "pdf"
    EXCEL = "excel"
    CSV = "csv"

class ReportRequest(BaseModel):
    report_type: ReportType = Field(..., description="Rapor türü")
    period: ReportPeriod = Field(..., description="Rapor periyodu")
    start_date: Union[datetime, date, str] = Field(..., description="Başlangıç tarihi")
    end_date: Union[datetime, date, str] = Field(..., description="Bitiş tarihi")
    bank_account_ids: Optional[List[str]] = Field(None, description="Filtrelenecek banka hesapları")
    person_ids: Optional[List[str]] = Field(None, description="Filtrelenecek kişiler")
    include_pending: bool = Field(False, description="Bekleyen işlemleri dahil et")
    format: ReportFormat = Field(ReportFormat.JSON, description="Rapor formatı")
    group_by_currency: bool = Field(True, description="Para birimine göre grupla")
    
    @validator('start_date', 'end_date', pre=True)
    def parse_date(cls, v):
        if isinstance(v, str):
            try:
                return datetime.fromisoformat(v.replace('Z', '+00:00'))
            except:
                return datetime.fromisoformat(v)
        return v

class IncomeExpenseReportData(BaseModel):
    total_income: float = Field(0.0, description="Toplam gelir")
    total_expense: float = Field(0.0, description="Toplam gider")
    net_profit: float = Field(0.0, description="Net kar")
    transaction_count: int = Field(0, description="İşlem sayısı")
    income_by_month: List[Dict[str, Any]] = Field(default_factory=list, description="Aylık gelir")
    expense_by_month: List[Dict[str, Any]] = Field(default_factory=list, description="Aylık gider")
    top_income_sources: List[Dict[str, Any]] = Field(default_factory=list, description="En çok gelir kaynakları")
    top_expense_categories: List[Dict[str, Any]] = Field(default_factory=list, description="En çok gider kategorileri")

class CashFlowReportData(BaseModel):
    opening_balance: float = Field(0.0, description="Açılış bakiyesi")
    closing_balance: float = Field(0.0, description="Kapanış bakiyesi")
    total_inflow: float = Field(0.0, description="Toplam giriş")
    total_outflow: float = Field(0.0, description="Toplam çıkış")
    net_cash_flow: float = Field(0.0, description="Net nakit akışı")
    daily_flows: List[Dict[str, Any]] = Field(default_factory=list, description="Günlük akışlar")
    bank_account_flows: List[Dict[str, Any]] = Field(default_factory=list, description="Hesap bazlı akışlar")

class BankAccountSummaryData(BaseModel):
    account_id: str = Field(..., description="Hesap ID")
    account_name: str = Field(..., description="Hesap adı")
    currency: str = Field(..., description="Para birimi")
    opening_balance: float = Field(0.0, description="Açılış bakiyesi")
    closing_balance: float = Field(0.0, description="Kapanış bakiyesi")
    total_income: float = Field(0.0, description="Toplam gelir")
    total_expense: float = Field(0.0, description="Toplam gider")
    transaction_count: int = Field(0, description="İşlem sayısı")
    average_daily_balance: float = Field(0.0, description="Ortalama günlük bakiye")

class PersonSummaryData(BaseModel):
    person_id: str = Field(..., description="Kişi ID")
    person_name: str = Field(..., description="Kişi adı")
    person_type: str = Field(..., description="Kişi türü")
    total_sent: float = Field(0.0, description="Toplam gönderilen")
    total_received: float = Field(0.0, description="Toplam alınan")
    net_balance: float = Field(0.0, description="Net bakiye")
    transaction_count: int = Field(0, description="İşlem sayısı")
    last_transaction_date: Optional[datetime] = Field(None, description="Son işlem tarihi")

class PaymentMethodAnalysisData(BaseModel):
    method: str = Field(..., description="Ödeme yöntemi")
    transaction_count: int = Field(0, description="İşlem sayısı")
    total_amount: float = Field(0.0, description="Toplam tutar")
    percentage: float = Field(0.0, description="Yüzde oranı")
    average_amount: float = Field(0.0, description="Ortalama tutar")

class ReportData(BaseModel):
    income_expense: Optional[IncomeExpenseReportData] = None
    cash_flow: Optional[CashFlowReportData] = None
    bank_accounts: Optional[List[BankAccountSummaryData]] = None
    people: Optional[List[PersonSummaryData]] = None
    payment_methods: Optional[List[PaymentMethodAnalysisData]] = None
    custom_data: Optional[Dict[str, Any]] = None

class Report(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    report_type: ReportType = Field(..., description="Rapor türü")
    title: str = Field(..., description="Rapor başlığı")
    description: Optional[str] = Field(None, description="Rapor açıklaması")
    period: ReportPeriod = Field(..., description="Rapor periyodu")
    start_date: datetime = Field(..., description="Başlangıç tarihi")
    end_date: datetime = Field(..., description="Bitiş tarihi")
    generated_at: datetime = Field(..., description="Oluşturulma tarihi")
    generated_by: str = Field(..., description="Oluşturan kullanıcı")
    data: ReportData = Field(..., description="Rapor verileri")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Ek veriler")
    file_path: Optional[str] = Field(None, description="Dosya yolu (PDF/Excel için)")
    status: str = Field("completed", description="Rapor durumu")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {datetime: lambda v: v.isoformat()}

class ReportSummary(BaseModel):
    """Rapor özeti"""
    id: str
    title: str
    report_type: ReportType
    period: ReportPeriod
    start_date: datetime
    end_date: datetime
    generated_at: datetime
    status: str
    file_path: Optional[str] = None

class DashboardStats(BaseModel):
    """Dashboard istatistikleri"""
    current_month_income: float = Field(0.0, description="Bu ay gelir")
    current_month_expense: float = Field(0.0, description="Bu ay gider")
    current_month_profit: float = Field(0.0, description="Bu ay kar")
    total_bank_balance: float = Field(0.0, description="Toplam banka bakiyesi")
    pending_payments: int = Field(0, description="Bekleyen ödemeler")
    active_debts: int = Field(0, description="Aktif borçlar")
    recent_transactions: List[Dict[str, Any]] = Field(default_factory=list, description="Son işlemler")
    monthly_trends: List[Dict[str, Any]] = Field(default_factory=list, description="Aylık trendler")
    top_expenses: List[Dict[str, Any]] = Field(default_factory=list, description="En büyük giderler")
    cash_flow_forecast: List[Dict[str, Any]] = Field(default_factory=list, description="Nakit akış tahmini")
    
    # Yeni gelişmiş istatistikler
    weekly_balance_trend: List[Dict[str, Any]] = Field(default_factory=list, description="Haftalık bakiye trendi")
    expense_categories: List[Dict[str, Any]] = Field(default_factory=list, description="Gider kategorileri dağılımı")
    monthly_average: float = Field(0.0, description="Aylık ortalama gelir")
    best_day_amount: float = Field(0.0, description="En iyi günün tutarı")
    best_day_date: Optional[str] = Field(None, description="En iyi günün tarihi")
    pending_transactions_count: int = Field(0, description="Bekleyen işlem sayısı")
    pending_transactions_amount: float = Field(0.0, description="Bekleyen işlem tutarı")