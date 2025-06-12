from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
import os
from io import BytesIO

from app.models.report import (
    Report,
    ReportRequest,
    ReportSummary,
    ReportType,
    ReportPeriod,
    DashboardStats,
    IncomeExpenseReportData,
    CashFlowReportData,
    BankAccountSummaryData,
    PersonSummaryData,
    PaymentMethodAnalysisData,
    ReportData
)
from app.models.user import User
from app.api.routes.auth import get_current_user
from app.core.database import get_database
from app.core.config import settings

router = APIRouter()

@router.get("/dashboard-stats", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user)
):
    """Dashboard için temel istatistikleri getir"""
    db = get_database()
    
    # Bu ayın başlangıcı
    now = datetime.utcnow()
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Bu ayın gelir/gider hesaplama
    monthly_income_pipeline = [
        {
            "$match": {
                "type": "income",
                "transaction_date": {"$gte": start_of_month},
                "status": "completed"
            }
        },
        {
            "$group": {
                "_id": None,
                "total": {"$sum": "$amount"}
            }
        }
    ]
    
    monthly_expense_pipeline = [
        {
            "$match": {
                "type": "expense",
                "transaction_date": {"$gte": start_of_month},
                "status": "completed"
            }
        },
        {
            "$group": {
                "_id": None,
                "total": {"$sum": "$amount"}
            }
        }
    ]
    
    current_month_income = 0.0
    async for doc in db.transactions.aggregate(monthly_income_pipeline):
        current_month_income = doc["total"]
    
    current_month_expense = 0.0
    async for doc in db.transactions.aggregate(monthly_expense_pipeline):
        current_month_expense = doc["total"]
    
    current_month_profit = current_month_income - current_month_expense
    
    # Toplam banka bakiyesi
    bank_balance_pipeline = [
        {
            "$group": {
                "_id": None,
                "total": {"$sum": "$current_balance"}
            }
        }
    ]
    
    total_bank_balance = 0.0
    async for doc in db.bank_accounts.aggregate(bank_balance_pipeline):
        total_bank_balance = doc["total"]
    
    # Bekleyen ödemeler
    pending_payments = await db.payment_orders.count_documents({"status": "pending"})
    
    # Aktif borçlar
    active_debts = await db.debts.count_documents({"status": "active"})
    
    # Son 10 işlem
    recent_transactions_pipeline = [
        {
            "$lookup": {
                "from": "bank_accounts",
                "localField": "bank_account_id",
                "foreignField": "_id",
                "as": "bank_account"
            }
        },
        {
            "$lookup": {
                "from": "people",
                "localField": "person_id",
                "foreignField": "_id",
                "as": "person"
            }
        },
        {"$sort": {"transaction_date": -1}},
        {"$limit": 10},
        {
            "$project": {
                "type": 1,
                "amount": 1,
                "description": 1,
                "transaction_date": 1,
                "bank_account_name": {"$arrayElemAt": ["$bank_account.name", 0]},
                "person_name": {"$arrayElemAt": ["$person.name", 0]}
            }
        }
    ]
    
    recent_transactions = []
    async for doc in db.transactions.aggregate(recent_transactions_pipeline):
        recent_transactions.append({
            "id": str(doc["_id"]),
            "type": doc["type"],
            "amount": doc["amount"],
            "description": doc["description"],
            "transaction_date": doc["transaction_date"],
            "bank_account_name": doc.get("bank_account_name"),
            "person_name": doc.get("person_name")
        })
    
    # Son 6 ayın aylık trendleri
    six_months_ago = now - timedelta(days=180)
    monthly_trends_pipeline = [
        {
            "$match": {
                "transaction_date": {"$gte": six_months_ago},
                "status": "completed"
            }
        },
        {
            "$group": {
                "_id": {
                    "year": {"$year": "$transaction_date"},
                    "month": {"$month": "$transaction_date"},
                    "type": "$type"
                },
                "total": {"$sum": "$amount"}
            }
        },
        {"$sort": {"_id.year": 1, "_id.month": 1}}
    ]
    
    monthly_trends_data = {}
    async for doc in db.transactions.aggregate(monthly_trends_pipeline):
        key = f"{doc['_id']['year']}-{doc['_id']['month']:02d}"
        if key not in monthly_trends_data:
            monthly_trends_data[key] = {"month": key, "income": 0, "expense": 0}
        
        if doc["_id"]["type"] == "income":
            monthly_trends_data[key]["income"] = doc["total"]
        elif doc["_id"]["type"] == "expense":
            monthly_trends_data[key]["expense"] = doc["total"]
    
    monthly_trends = list(monthly_trends_data.values())
    
    # En büyük giderler (bu ay)
    top_expenses_pipeline = [
        {
            "$match": {
                "type": "expense",
                "transaction_date": {"$gte": start_of_month},
                "status": "completed"
            }
        },
        {
            "$lookup": {
                "from": "people",
                "localField": "person_id",
                "foreignField": "_id",
                "as": "person"
            }
        },
        {"$sort": {"amount": -1}},
        {"$limit": 5},
        {
            "$project": {
                "amount": 1,
                "description": 1,
                "transaction_date": 1,
                "person_name": {"$arrayElemAt": ["$person.name", 0]}
            }
        }
    ]
    
    top_expenses = []
    async for doc in db.transactions.aggregate(top_expenses_pipeline):
        top_expenses.append({
            "amount": doc["amount"],
            "description": doc["description"],
            "transaction_date": doc["transaction_date"],
            "person_name": doc.get("person_name")
        })
    
    # Haftalık bakiye trendi (son 7 gün)
    seven_days_ago = now - timedelta(days=7)
    weekly_balance_trend = []
    
    for i in range(7):
        day = seven_days_ago + timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        # O günün işlemlerini topla
        daily_pipeline = [
            {
                "$match": {
                    "transaction_date": {"$gte": day_start, "$lt": day_end},
                    "status": "completed"
                }
            },
            {
                "$group": {
                    "_id": None,
                    "balance_change": {"$sum": "$balance_impact"}
                }
            }
        ]
        
        daily_change = 0.0
        async for doc in db.transactions.aggregate(daily_pipeline):
            daily_change = doc["balance_change"]
        
        # Kümülatif bakiye hesapla (basitleştirilmiş)
        base_balance = total_bank_balance if i == 0 else weekly_balance_trend[-1]["balance"]
        current_balance = base_balance + daily_change
        
        weekly_balance_trend.append({
            "date": day.strftime("%d/%m"),
            "balance": current_balance
        })
    
    # Gider kategorileri dağılımı
    expense_categories_pipeline = [
        {
            "$match": {
                "type": "expense",
                "transaction_date": {"$gte": start_of_month},
                "status": "completed"
            }
        },
        {
            "$lookup": {
                "from": "payment_orders",
                "localField": "payment_order_id",
                "foreignField": "_id", 
                "as": "payment_order"
            }
        },
        {
            "$group": {
                "_id": {"$arrayElemAt": ["$payment_order.category", 0]},
                "amount": {"$sum": "$amount"}
            }
        },
        {"$sort": {"amount": -1}}
    ]
    
    expense_categories = []
    async for doc in db.transactions.aggregate(expense_categories_pipeline):
        category = doc["_id"] or "Diğer"
        expense_categories.append({
            "name": category,
            "amount": doc["amount"]
        })
    
    # Son 3 ayın ortalaması
    three_months_ago = now - timedelta(days=90)
    monthly_average_pipeline = [
        {
            "$match": {
                "type": "income",
                "transaction_date": {"$gte": three_months_ago},
                "status": "completed"
            }
        },
        {
            "$group": {
                "_id": {
                    "year": {"$year": "$transaction_date"},
                    "month": {"$month": "$transaction_date"}
                },
                "monthly_total": {"$sum": "$amount"}
            }
        },
        {
            "$group": {
                "_id": None,
                "average": {"$avg": "$monthly_total"}
            }
        }
    ]
    
    monthly_average = 0.0
    async for doc in db.transactions.aggregate(monthly_average_pipeline):
        monthly_average = doc["average"]
    
    # En iyi gün bulma
    best_day_pipeline = [
        {
            "$match": {
                "type": "income",
                "status": "completed"
            }
        },
        {
            "$group": {
                "_id": {
                    "$dateToString": {
                        "format": "%Y-%m-%d",
                        "date": "$transaction_date"
                    }
                },
                "daily_total": {"$sum": "$amount"}
            }
        },
        {"$sort": {"daily_total": -1}},
        {"$limit": 1}
    ]
    
    best_day_amount = 0.0
    best_day_date = None
    async for doc in db.transactions.aggregate(best_day_pipeline):
        best_day_amount = doc["daily_total"]
        best_day_date = doc["_id"]
    
    # Bekleyen işlemler
    pending_transactions_pipeline = [
        {
            "$match": {
                "status": {"$in": ["pending", "planned"]}
            }
        },
        {
            "$group": {
                "_id": None,
                "count": {"$sum": 1},
                "total_amount": {"$sum": "$amount"}
            }
        }
    ]
    
    pending_transactions_count = 0
    pending_transactions_amount = 0.0
    async for doc in db.transactions.aggregate(pending_transactions_pipeline):
        pending_transactions_count = doc["count"]
        pending_transactions_amount = doc["total_amount"]
    
    return DashboardStats(
        current_month_income=current_month_income,
        current_month_expense=current_month_expense,
        current_month_profit=current_month_profit,
        total_bank_balance=total_bank_balance,
        pending_payments=pending_payments,
        active_debts=active_debts,
        recent_transactions=recent_transactions,
        monthly_trends=monthly_trends,
        top_expenses=top_expenses,
        weekly_balance_trend=weekly_balance_trend,
        expense_categories=expense_categories,
        monthly_average=monthly_average,
        best_day_amount=best_day_amount,
        best_day_date=best_day_date,
        pending_transactions_count=pending_transactions_count,
        pending_transactions_amount=pending_transactions_amount
    )

@router.post("/generate", response_model=Report)
async def generate_report(
    report_request: ReportRequest,
    current_user: User = Depends(get_current_user)
):
    """Rapor oluştur"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    # Rapor verilerini hazırla
    report_data = ReportData()
    
    # Tarih filtresi
    date_filter = {
        "transaction_date": {
            "$gte": report_request.start_date,
            "$lte": report_request.end_date
        }
    }
    
    if not report_request.include_pending:
        date_filter["status"] = "completed"
    
    # Banka hesabı filtresi
    if report_request.bank_account_ids:
        date_filter["bank_account_id"] = {
            "$in": [ObjectId(id) for id in report_request.bank_account_ids if ObjectId.is_valid(id)]
        }
    
    if report_request.report_type == ReportType.INCOME_EXPENSE:
        report_data.income_expense = await _generate_income_expense_report(db, date_filter)
    elif report_request.report_type == ReportType.CASH_FLOW:
        report_data.cash_flow = await _generate_cash_flow_report(db, date_filter, report_request)
    elif report_request.report_type == ReportType.BANK_ACCOUNT_SUMMARY:
        report_data.bank_accounts = await _generate_bank_account_summary(db, date_filter)
    elif report_request.report_type == ReportType.PERSON_SUMMARY:
        report_data.people = await _generate_person_summary(db, date_filter, report_request.person_ids)
    elif report_request.report_type == ReportType.PAYMENT_METHOD_ANALYSIS:
        report_data.payment_methods = await _generate_payment_method_analysis(db, date_filter)
    
    # Rapor başlığı oluştur
    title = _generate_report_title(report_request.report_type, report_request.period, report_request.start_date, report_request.end_date)
    
    # Raporu kaydet
    now = datetime.utcnow()
    report_dict = {
        "report_type": report_request.report_type,
        "title": title,
        "period": report_request.period,
        "start_date": report_request.start_date,
        "end_date": report_request.end_date,
        "generated_at": now,
        "generated_by": current_user.id,
        "data": report_data.model_dump(),
        "metadata": {
            "bank_account_ids": report_request.bank_account_ids,
            "person_ids": report_request.person_ids,
            "include_pending": report_request.include_pending,
            "group_by_currency": report_request.group_by_currency
        },
        "status": "completed",
        "created_at": now,
        "updated_at": now
    }
    
    result = await db.reports.insert_one(report_dict)
    
    # Oluşturulan raporu getir
    created_report = await db.reports.find_one({"_id": result.inserted_id})
    created_report["_id"] = str(created_report["_id"])
    
    return Report(**created_report)

async def _generate_income_expense_report(db, date_filter) -> IncomeExpenseReportData:
    """Gelir-Gider raporu oluştur"""
    # Toplam gelir
    income_pipeline = [
        {"$match": {**date_filter, "type": "income"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    
    total_income = 0.0
    income_count = 0
    async for doc in db.transactions.aggregate(income_pipeline):
        total_income = doc["total"]
        income_count = doc["count"]
    
    # Toplam gider
    expense_pipeline = [
        {"$match": {**date_filter, "type": "expense"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    
    total_expense = 0.0
    expense_count = 0
    async for doc in db.transactions.aggregate(expense_pipeline):
        total_expense = doc["total"]
        expense_count = doc["count"]
    
    net_profit = total_income - total_expense
    
    # Aylık gelir/gider
    monthly_pipeline = [
        {"$match": date_filter},
        {
            "$group": {
                "_id": {
                    "year": {"$year": "$transaction_date"},
                    "month": {"$month": "$transaction_date"},
                    "type": "$type"
                },
                "total": {"$sum": "$amount"}
            }
        },
        {"$sort": {"_id.year": 1, "_id.month": 1}}
    ]
    
    monthly_data = {}
    async for doc in db.transactions.aggregate(monthly_pipeline):
        key = f"{doc['_id']['year']}-{doc['_id']['month']:02d}"
        if key not in monthly_data:
            monthly_data[key] = {"month": key, "income": 0, "expense": 0}
        
        monthly_data[key][doc["_id"]["type"]] = doc["total"]
    
    income_by_month = [{"month": k, "amount": v["income"]} for k, v in monthly_data.items()]
    expense_by_month = [{"month": k, "amount": v["expense"]} for k, v in monthly_data.items()]
    
    return IncomeExpenseReportData(
        total_income=total_income,
        total_expense=total_expense,
        net_profit=net_profit,
        transaction_count=income_count + expense_count,
        income_by_month=income_by_month,
        expense_by_month=expense_by_month
    )

async def _generate_cash_flow_report(db, date_filter, report_request) -> CashFlowReportData:
    """Nakit akış raporu oluştur"""
    # Toplam giriş/çıkış
    inflow_pipeline = [
        {"$match": {**date_filter, "type": "income"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    
    outflow_pipeline = [
        {"$match": {**date_filter, "type": "expense"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    
    total_inflow = 0.0
    async for doc in db.transactions.aggregate(inflow_pipeline):
        total_inflow = doc["total"]
    
    total_outflow = 0.0
    async for doc in db.transactions.aggregate(outflow_pipeline):
        total_outflow = doc["total"]
    
    net_cash_flow = total_inflow - total_outflow
    
    return CashFlowReportData(
        total_inflow=total_inflow,
        total_outflow=total_outflow,
        net_cash_flow=net_cash_flow
    )

async def _generate_bank_account_summary(db, date_filter) -> List[BankAccountSummaryData]:
    """Banka hesap özeti raporu"""
    pipeline = [
        {
            "$lookup": {
                "from": "transactions",
                "localField": "_id",
                "foreignField": "bank_account_id",
                "as": "transactions"
            }
        },
        {
            "$addFields": {
                "filtered_transactions": {
                    "$filter": {
                        "input": "$transactions",
                        "cond": {
                            "$and": [
                                {"$gte": ["$$this.transaction_date", date_filter["transaction_date"]["$gte"]]},
                                {"$lte": ["$$this.transaction_date", date_filter["transaction_date"]["$lte"]]}
                            ]
                        }
                    }
                }
            }
        },
        {
            "$addFields": {
                "total_income": {
                    "$sum": {
                        "$map": {
                            "input": {"$filter": {"input": "$filtered_transactions", "cond": {"$eq": ["$$this.type", "income"]}}},
                            "as": "t",
                            "in": "$$t.amount"
                        }
                    }
                },
                "total_expense": {
                    "$sum": {
                        "$map": {
                            "input": {"$filter": {"input": "$filtered_transactions", "cond": {"$eq": ["$$this.type", "expense"]}}},
                            "as": "t",
                            "in": "$$t.amount"
                        }
                    }
                },
                "transaction_count": {"$size": "$filtered_transactions"}
            }
        }
    ]
    
    summaries = []
    async for doc in db.bank_accounts.aggregate(pipeline):
        summaries.append(BankAccountSummaryData(
            account_id=str(doc["_id"]),
            account_name=doc["name"],
            currency=doc.get("currency", "TRY"),
            closing_balance=doc["current_balance"],
            total_income=doc.get("total_income", 0),
            total_expense=doc.get("total_expense", 0),
            transaction_count=doc.get("transaction_count", 0)
        ))
    
    return summaries

async def _generate_person_summary(db, date_filter, person_ids=None) -> List[PersonSummaryData]:
    """Kişi özeti raporu"""
    match_filter = {}
    if person_ids:
        match_filter["_id"] = {"$in": [ObjectId(id) for id in person_ids if ObjectId.is_valid(id)]}
    
    pipeline = [
        {"$match": match_filter},
        {
            "$lookup": {
                "from": "transactions",
                "localField": "_id",
                "foreignField": "person_id",
                "as": "transactions"
            }
        },
        {
            "$addFields": {
                "filtered_transactions": {
                    "$filter": {
                        "input": "$transactions",
                        "cond": {
                            "$and": [
                                {"$gte": ["$$this.transaction_date", date_filter["transaction_date"]["$gte"]]},
                                {"$lte": ["$$this.transaction_date", date_filter["transaction_date"]["$lte"]]}
                            ]
                        }
                    }
                }
            }
        },
        {
            "$addFields": {
                "total_sent": {
                    "$sum": {
                        "$map": {
                            "input": {"$filter": {"input": "$filtered_transactions", "cond": {"$eq": ["$$this.type", "expense"]}}},
                            "as": "t",
                            "in": "$$t.amount"
                        }
                    }
                },
                "total_received": {
                    "$sum": {
                        "$map": {
                            "input": {"$filter": {"input": "$filtered_transactions", "cond": {"$eq": ["$$this.type", "income"]}}},
                            "as": "t",
                            "in": "$$t.amount"
                        }
                    }
                },
                "transaction_count": {"$size": "$filtered_transactions"},
                "last_transaction_date": {"$max": "$filtered_transactions.transaction_date"}
            }
        }
    ]
    
    summaries = []
    async for doc in db.people.aggregate(pipeline):
        total_sent = doc.get("total_sent", 0)
        total_received = doc.get("total_received", 0)
        summaries.append(PersonSummaryData(
            person_id=str(doc["_id"]),
            person_name=doc["name"],
            person_type=doc.get("person_type", "individual"),
            total_sent=total_sent,
            total_received=total_received,
            net_balance=total_received - total_sent,
            transaction_count=doc.get("transaction_count", 0),
            last_transaction_date=doc.get("last_transaction_date")
        ))
    
    return summaries

async def _generate_payment_method_analysis(db, date_filter) -> List[PaymentMethodAnalysisData]:
    """Ödeme yöntemi analiz raporu"""
    pipeline = [
        {"$match": date_filter},
        {
            "$group": {
                "_id": "$payment_method",
                "count": {"$sum": 1},
                "total_amount": {"$sum": "$amount"}
            }
        },
        {"$sort": {"total_amount": -1}}
    ]
    
    # Toplam tutar hesapla
    total_amount = 0
    method_data = []
    async for doc in db.transactions.aggregate(pipeline):
        method_data.append(doc)
        total_amount += doc["total_amount"]
    
    # Yüzde hesapla
    analysis = []
    for doc in method_data:
        percentage = (doc["total_amount"] / total_amount * 100) if total_amount > 0 else 0
        average_amount = doc["total_amount"] / doc["count"] if doc["count"] > 0 else 0
        
        analysis.append(PaymentMethodAnalysisData(
            method=doc["_id"] or "Bilinmeyen",
            transaction_count=doc["count"],
            total_amount=doc["total_amount"],
            percentage=percentage,
            average_amount=average_amount
        ))
    
    return analysis

def _generate_report_title(report_type: ReportType, period: ReportPeriod, start_date: datetime, end_date: datetime) -> str:
    """Rapor başlığı oluştur"""
    type_names = {
        ReportType.INCOME_EXPENSE: "Gelir-Gider Raporu",
        ReportType.CASH_FLOW: "Nakit Akış Raporu",
        ReportType.BANK_ACCOUNT_SUMMARY: "Banka Hesap Özeti",
        ReportType.PERSON_SUMMARY: "Kişi/Kurum Özeti",
        ReportType.PAYMENT_METHOD_ANALYSIS: "Ödeme Yöntemi Analizi"
    }
    
    period_names = {
        ReportPeriod.DAILY: "Günlük",
        ReportPeriod.WEEKLY: "Haftalık",
        ReportPeriod.MONTHLY: "Aylık",
        ReportPeriod.QUARTERLY: "Çeyreklik",
        ReportPeriod.YEARLY: "Yıllık",
        ReportPeriod.CUSTOM: "Özel Dönem"
    }
    
    type_name = type_names.get(report_type, "Rapor")
    period_name = period_names.get(period, "")
    
    if period == ReportPeriod.CUSTOM:
        date_range = f"{start_date.strftime('%d.%m.%Y')} - {end_date.strftime('%d.%m.%Y')}"
        return f"{type_name} ({date_range})"
    else:
        return f"{period_name} {type_name}"

@router.get("/", response_model=List[ReportSummary])
async def get_reports(
    limit: int = Query(50, le=100, description="Maksimum kayıt sayısı"),
    skip: int = Query(0, ge=0, description="Atlanacak kayıt sayısı"),
    current_user: User = Depends(get_current_user)
):
    """Raporları listele"""
    db = get_database()
    
    reports = []
    cursor = db.reports.find({}).sort("generated_at", -1).skip(skip).limit(limit)
    
    async for report in cursor:
        reports.append(ReportSummary(
            id=str(report["_id"]),
            title=report["title"],
            report_type=report["report_type"],
            period=report["period"],
            start_date=report["start_date"],
            end_date=report["end_date"],
            generated_at=report["generated_at"],
            status=report["status"],
            file_path=report.get("file_path")
        ))
    
    return reports

@router.get("/{report_id}", response_model=Report)
async def get_report(
    report_id: str,
    current_user: User = Depends(get_current_user)
):
    """Tek rapor detayını getir"""
    db = get_database()
    
    if not ObjectId.is_valid(report_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz rapor ID"
        )
    
    report = await db.reports.find_one({"_id": ObjectId(report_id)})
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rapor bulunamadı"
        )
    
    report["_id"] = str(report["_id"])
    return Report(**report)

@router.delete("/{report_id}")
async def delete_report(
    report_id: str,
    current_user: User = Depends(get_current_user)
):
    """Raporu sil"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    if not ObjectId.is_valid(report_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz rapor ID"
        )
    
    report = await db.reports.find_one({"_id": ObjectId(report_id)})
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rapor bulunamadı"
        )
    
    # Dosya varsa sil
    if report.get("file_path") and os.path.exists(report["file_path"]):
        try:
            os.remove(report["file_path"])
        except:
            pass
    
    await db.reports.delete_one({"_id": ObjectId(report_id)})
    
    return {"message": "Rapor silindi"}