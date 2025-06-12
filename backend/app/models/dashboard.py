from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
from bson import ObjectId
from enum import Enum

class WidgetType(str, Enum):
    BALANCE_OVERVIEW = "balance_overview"
    RECENT_TRANSACTIONS = "recent_transactions"
    PAYMENT_ORDERS = "payment_orders"
    EXPENSE_CHART = "expense_chart"
    INCOME_CHART = "income_chart"
    AI_INSIGHTS = "ai_insights"
    NOTIFICATIONS = "notifications"
    QUICK_ACTIONS = "quick_actions"
    PERFORMANCE_METRICS = "performance_metrics"
    UPCOMING_PAYMENTS = "upcoming_payments"
    CATEGORY_BREAKDOWN = "category_breakdown"
    BANK_ACCOUNTS = "bank_accounts"

class WidgetSize(str, Enum):
    SMALL = "small"      # 1x1
    MEDIUM = "medium"    # 2x1
    LARGE = "large"      # 2x2
    WIDE = "wide"        # 3x1
    EXTRA_LARGE = "extra_large"  # 3x2

class DashboardWidget(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()))
    type: WidgetType
    title: str
    size: WidgetSize
    position: Dict[str, int] = Field(description="x, y coordinates on grid")
    config: Dict[str, Any] = Field(default_factory=dict, description="Widget-specific configuration")
    is_visible: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {
            ObjectId: str,
            datetime: lambda dt: dt.isoformat()
        }

class DashboardLayout(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    name: str = Field(default="Varsayılan Dashboard")
    widgets: List[DashboardWidget] = Field(default_factory=list)
    grid_columns: int = Field(default=12, description="Grid column count")
    is_default: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            ObjectId: str,
            datetime: lambda dt: dt.isoformat()
        }

class DashboardLayoutSummary(BaseModel):
    id: str
    name: str
    is_default: bool
    widget_count: int
    created_at: datetime
    updated_at: datetime

class DashboardWidgetCreate(BaseModel):
    type: WidgetType
    title: str
    size: WidgetSize
    position: Dict[str, int]
    config: Dict[str, Any] = Field(default_factory=dict)

class DashboardWidgetUpdate(BaseModel):
    title: Optional[str] = None
    size: Optional[WidgetSize] = None
    position: Optional[Dict[str, int]] = None
    config: Optional[Dict[str, Any]] = None
    is_visible: Optional[bool] = None

class DashboardLayoutCreate(BaseModel):
    name: str
    widgets: List[DashboardWidgetCreate] = Field(default_factory=list)
    grid_columns: int = Field(default=12)

class DashboardLayoutUpdate(BaseModel):
    name: Optional[str] = None
    widgets: Optional[List[DashboardWidget]] = None
    grid_columns: Optional[int] = None
    is_default: Optional[bool] = None

# Default widget configurations
DEFAULT_WIDGET_CONFIGS = {
    WidgetType.BALANCE_OVERVIEW: {
        "show_total_balance": True,
        "show_account_breakdown": True,
        "currency_filter": ["TRY"]
    },
    WidgetType.RECENT_TRANSACTIONS: {
        "limit": 5,
        "show_categories": True,
        "transaction_types": ["income", "expense"]
    },
    WidgetType.PAYMENT_ORDERS: {
        "limit": 5,
        "status_filter": ["pending", "approved"],
        "show_amounts": True
    },
    WidgetType.EXPENSE_CHART: {
        "chart_type": "pie",
        "time_period": "monthly",
        "show_categories": True
    },
    WidgetType.AI_INSIGHTS: {
        "show_predictions": True,
        "show_anomalies": True,
        "insight_limit": 3
    },
    WidgetType.NOTIFICATIONS: {
        "limit": 5,
        "show_unread_only": False,
        "types": ["payment_due", "approval_pending"]
    },
    WidgetType.PERFORMANCE_METRICS: {
        "metrics": ["monthly_income", "monthly_expense", "savings_rate"],
        "comparison_period": "previous_month"
    }
}

# Default dashboard layout for new users
DEFAULT_DASHBOARD_LAYOUT = {
    "name": "Varsayılan Dashboard",
    "grid_columns": 12,
    "widgets": [
        {
            "type": WidgetType.BALANCE_OVERVIEW,
            "title": "Bakiye Özeti",
            "size": WidgetSize.MEDIUM,
            "position": {"x": 0, "y": 0},
            "config": DEFAULT_WIDGET_CONFIGS[WidgetType.BALANCE_OVERVIEW]
        },
        {
            "type": WidgetType.RECENT_TRANSACTIONS,
            "title": "Son İşlemler",
            "size": WidgetSize.MEDIUM,
            "position": {"x": 6, "y": 0},
            "config": DEFAULT_WIDGET_CONFIGS[WidgetType.RECENT_TRANSACTIONS]
        },
        {
            "type": WidgetType.AI_INSIGHTS,
            "title": "AI Öngörüleri",
            "size": WidgetSize.LARGE,
            "position": {"x": 0, "y": 2},
            "config": DEFAULT_WIDGET_CONFIGS[WidgetType.AI_INSIGHTS]
        },
        {
            "type": WidgetType.PAYMENT_ORDERS,
            "title": "Bekleyen Ödemeler",
            "size": WidgetSize.MEDIUM,
            "position": {"x": 6, "y": 2},
            "config": DEFAULT_WIDGET_CONFIGS[WidgetType.PAYMENT_ORDERS]
        },
        {
            "type": WidgetType.EXPENSE_CHART,
            "title": "Harcama Analizi",
            "size": WidgetSize.WIDE,
            "position": {"x": 0, "y": 4},
            "config": DEFAULT_WIDGET_CONFIGS[WidgetType.EXPENSE_CHART]
        }
    ]
}