from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
from dateutil.relativedelta import relativedelta

from app.models.income import (
    IncomeSource,
    IncomeSourceCreate,
    IncomeSourceUpdate,
    IncomeSourceSummary,
    IncomeRecord,
    IncomeRecordCreate,
    IncomeRecordUpdate,
    IncomeRecordSummary,
    IncomeStatistics,
    IncomeForecast,
    IncomeProjection,
    IncomeType,
    IncomeStatus,
    RecurrenceType
)
from app.models.user import User
from app.api.routes.auth import get_current_user
from app.core.database import get_database

router = APIRouter()

@router.get("/sources", response_model=List[IncomeSource])
async def get_income_sources(
    income_type: Optional[IncomeType] = Query(None, description="Gelir türüne göre filtrele"),
    category: Optional[str] = Query(None, description="Kategoriye göre filtrele"),
    active_only: bool = Query(True, description="Sadece aktif kaynaklar"),
    limit: int = Query(50, le=100, description="Maksimum kayıt sayısı"),
    skip: int = Query(0, ge=0, description="Atlanacak kayıt sayısı"),
    current_user: User = Depends(get_current_user)
):
    """Gelir kaynaklarını listele"""
    db = get_database()
    
    # Filtre oluştur
    filter_query = {}
    if income_type:
        filter_query["income_type"] = income_type
    if category:
        filter_query["category"] = category
    if active_only:
        filter_query["is_active"] = True
    
    sources = []
    cursor = db.income_sources.find(filter_query).sort("name", 1).skip(skip).limit(limit)
    
    async for source in cursor:
        source["_id"] = str(source["_id"])
        sources.append(IncomeSource(**source))
    
    return sources

@router.get("/sources/summary", response_model=List[IncomeSourceSummary])
async def get_income_sources_summary(
    current_user: User = Depends(get_current_user)
):
    """Gelir kaynaklarının özet bilgilerini getir"""
    db = get_database()
    
    # Aggregate pipeline ile income records'ları join et
    pipeline = [
        {
            "$lookup": {
                "from": "income_records",
                "localField": "_id",
                "foreignField": "income_source_id",
                "as": "records"
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
        {
            "$addFields": {
                "total_received": {
                    "$sum": {
                        "$map": {
                            "input": {"$filter": {"input": "$records", "cond": {"$eq": ["$$this.status", "paid"]}}},
                            "as": "record",
                            "in": "$$record.amount"
                        }
                    }
                },
                "total_expected": {
                    "$sum": {
                        "$map": {
                            "input": "$records",
                            "as": "record",
                            "in": "$$record.amount"
                        }
                    }
                },
                "income_count": {"$size": "$records"},
                "last_income_date": {
                    "$max": {
                        "$map": {
                            "input": {"$filter": {"input": "$records", "cond": {"$eq": ["$$this.status", "paid"]}}},
                            "as": "record",
                            "in": "$$record.actual_date"
                        }
                    }
                },
                "person_name": {"$arrayElemAt": ["$person.name", 0]}
            }
        },
        {
            "$addFields": {
                "completion_rate": {
                    "$cond": {
                        "if": {"$gt": ["$total_expected", 0]},
                        "then": {"$multiply": [{"$divide": ["$total_received", "$total_expected"]}, 100]},
                        "else": 0
                    }
                },
                "status": {
                    "$cond": {
                        "if": {"$eq": ["$is_active", False]},
                        "then": "inactive",
                        "else": "active"
                    }
                }
            }
        },
        {"$sort": {"name": 1}}
    ]
    
    summaries = []
    async for doc in db.income_sources.aggregate(pipeline):
        summary = IncomeSourceSummary(
            id=str(doc["_id"]),
            name=doc["name"],
            income_type=doc["income_type"],
            category=doc["category"],
            expected_amount=doc["expected_amount"],
            currency=doc["currency"],
            total_received=doc.get("total_received", 0),
            total_expected=doc.get("total_expected", 0),
            income_count=doc.get("income_count", 0),
            last_income_date=doc.get("last_income_date"),
            next_expected_date=doc.get("next_expected_date"),
            status=doc.get("status", "active"),
            person_name=doc.get("person_name"),
            completion_rate=doc.get("completion_rate", 0)
        )
        summaries.append(summary)
    
    return summaries

@router.get("/statistics", response_model=IncomeStatistics)
async def get_income_statistics(
    current_user: User = Depends(get_current_user)
):
    """Gelir istatistiklerini getir"""
    db = get_database()
    
    # Bu ayın başlangıcı ve sonu
    now = datetime.utcnow()
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    end_of_month = (start_of_month + relativedelta(months=1)) - timedelta(seconds=1)
    
    # Toplam kaynak sayıları
    total_sources = await db.income_sources.count_documents({})
    active_sources = await db.income_sources.count_documents({"is_active": True})
    recurring_sources = await db.income_sources.count_documents({"is_recurring": True, "is_active": True})
    
    # Bu ayın beklenen ve alınan tutarlar
    monthly_expected_pipeline = [
        {
            "$match": {
                "expected_date": {"$gte": start_of_month, "$lte": end_of_month}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_expected": {"$sum": "$amount"},
                "total_received": {
                    "$sum": {
                        "$cond": [{"$eq": ["$status", "paid"]}, "$amount", 0]
                    }
                }
            }
        }
    ]
    
    monthly_result = []
    async for doc in db.income_records.aggregate(monthly_expected_pipeline):
        monthly_result.append(doc)
    
    total_expected_this_month = monthly_result[0]["total_expected"] if monthly_result else 0
    total_received_this_month = monthly_result[0]["total_received"] if monthly_result else 0
    
    # Gecikmiş gelirler
    overdue_pipeline = [
        {
            "$match": {
                "status": {"$in": ["planned", "invoiced"]},
                "expected_date": {"$lt": now}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_overdue": {"$sum": "$amount"},
                "overdue_count": {"$sum": 1}
            }
        }
    ]
    
    overdue_result = []
    async for doc in db.income_records.aggregate(overdue_pipeline):
        overdue_result.append(doc)
    
    total_overdue = overdue_result[0]["total_overdue"] if overdue_result else 0
    overdue_count = overdue_result[0]["overdue_count"] if overdue_result else 0
    
    # Gelecek hafta ve ay
    next_week = now + timedelta(days=7)
    next_month = now + relativedelta(months=1)
    
    upcoming_week_pipeline = [
        {
            "$match": {
                "status": {"$in": ["planned", "invoiced"]},
                "expected_date": {"$gte": now, "$lte": next_week}
            }
        },
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    
    upcoming_week_result = []
    async for doc in db.income_records.aggregate(upcoming_week_pipeline):
        upcoming_week_result.append(doc)
    
    upcoming_week = upcoming_week_result[0]["total"] if upcoming_week_result else 0
    
    # En büyük gelir kaynakları
    top_sources_pipeline = [
        {
            "$lookup": {
                "from": "income_records",
                "localField": "_id",
                "foreignField": "income_source_id",
                "as": "records"
            }
        },
        {
            "$addFields": {
                "total_received": {
                    "$sum": {
                        "$map": {
                            "input": {"$filter": {"input": "$records", "cond": {"$eq": ["$$this.status", "paid"]}}},
                            "as": "record",
                            "in": "$$record.amount"
                        }
                    }
                }
            }
        },
        {"$match": {"total_received": {"$gt": 0}}},
        {"$sort": {"total_received": -1}},
        {"$limit": 5},
        {
            "$project": {
                "name": 1,
                "total_received": 1,
                "income_type": 1
            }
        }
    ]
    
    top_sources = []
    async for doc in db.income_sources.aggregate(top_sources_pipeline):
        top_sources.append({
            "id": str(doc["_id"]),
            "name": doc["name"],
            "total_received": doc["total_received"],
            "income_type": doc["income_type"]
        })
    
    # Son 6 ayın aylık trendleri
    six_months_ago = now - relativedelta(months=6)
    monthly_trends_pipeline = [
        {
            "$match": {
                "expected_date": {"$gte": six_months_ago},
                "status": "paid"
            }
        },
        {
            "$group": {
                "_id": {
                    "year": {"$year": "$expected_date"},
                    "month": {"$month": "$expected_date"}
                },
                "total": {"$sum": "$amount"},
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id.year": 1, "_id.month": 1}}
    ]
    
    monthly_trends = []
    async for doc in db.income_records.aggregate(monthly_trends_pipeline):
        monthly_trends.append({
            "month": f"{doc['_id']['year']}-{doc['_id']['month']:02d}",
            "total": doc["total"],
            "count": doc["count"]
        })
    
    # Kategoriye göre dağılım
    category_pipeline = [
        {
            "$group": {
                "_id": "$category",
                "count": {"$sum": 1},
                "total_expected": {"$sum": "$expected_amount"}
            }
        },
        {"$sort": {"total_expected": -1}}
    ]
    
    by_category = []
    async for doc in db.income_sources.aggregate(category_pipeline):
        by_category.append({
            "category": doc["_id"],
            "count": doc["count"],
            "total_expected": doc["total_expected"]
        })
    
    return IncomeStatistics(
        total_sources=total_sources,
        active_sources=active_sources,
        recurring_sources=recurring_sources,
        total_expected_this_month=total_expected_this_month,
        total_received_this_month=total_received_this_month,
        total_overdue=total_overdue,
        overdue_count=overdue_count,
        upcoming_week=upcoming_week,
        upcoming_month=0,  # Bu hesaplama için ayrı pipeline gerekli
        top_sources=top_sources,
        monthly_trends=monthly_trends,
        by_category=by_category,
        by_status=[]
    )

@router.post("/sources", response_model=IncomeSource)
async def create_income_source(
    source_data: IncomeSourceCreate,
    current_user: User = Depends(get_current_user)
):
    """Yeni gelir kaynağı oluştur"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    # Aynı isimde kaynak var mı kontrol et
    existing_source = await db.income_sources.find_one({"name": source_data.name})
    if existing_source:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu isimde bir gelir kaynağı zaten var"
        )
    
    now = datetime.utcnow()
    source_dict = source_data.model_dump()
    source_dict.update({
        "total_received": 0.0,
        "total_expected": 0.0,
        "income_count": 0,
        "created_by": current_user.id,
        "created_at": now,
        "updated_at": now
    })
    
    result = await db.income_sources.insert_one(source_dict)
    
    # Oluşturulan kaynağı getir
    created_source = await db.income_sources.find_one({"_id": result.inserted_id})
    created_source["_id"] = str(created_source["_id"])
    
    return IncomeSource(**created_source)

@router.get("/sources/{source_id}", response_model=IncomeSource)
async def get_income_source(
    source_id: str,
    current_user: User = Depends(get_current_user)
):
    """Tek gelir kaynağını getir"""
    db = get_database()
    
    if not ObjectId.is_valid(source_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz gelir kaynağı ID"
        )
    
    source = await db.income_sources.find_one({"_id": ObjectId(source_id)})
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gelir kaynağı bulunamadı"
        )
    
    source["_id"] = str(source["_id"])
    return IncomeSource(**source)

@router.put("/sources/{source_id}", response_model=IncomeSource)
async def update_income_source(
    source_id: str,
    source_data: IncomeSourceUpdate,
    current_user: User = Depends(get_current_user)
):
    """Gelir kaynağını güncelle"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    if not ObjectId.is_valid(source_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz gelir kaynağı ID"
        )
    
    # Mevcut kaynağı kontrol et
    existing_source = await db.income_sources.find_one({"_id": ObjectId(source_id)})
    if not existing_source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gelir kaynağı bulunamadı"
        )
    
    # Güncelleme verilerini hazırla
    update_data = source_data.model_dump(exclude_unset=True)
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        
        await db.income_sources.update_one(
            {"_id": ObjectId(source_id)},
            {"$set": update_data}
        )
    
    # Güncellenmiş kaynağı getir
    updated_source = await db.income_sources.find_one({"_id": ObjectId(source_id)})
    updated_source["_id"] = str(updated_source["_id"])
    
    return IncomeSource(**updated_source)

@router.delete("/sources/{source_id}")
async def delete_income_source(
    source_id: str,
    current_user: User = Depends(get_current_user)
):
    """Gelir kaynağını sil"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    if not ObjectId.is_valid(source_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz gelir kaynağı ID"
        )
    
    source = await db.income_sources.find_one({"_id": ObjectId(source_id)})
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gelir kaynağı bulunamadı"
        )
    
    # İlişkili kayıtları kontrol et
    record_count = await db.income_records.count_documents({"income_source_id": source_id})
    if record_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu gelir kaynağına ait kayıtlar var. Önce kayıtları silmelisiniz."
        )
    
    await db.income_sources.delete_one({"_id": ObjectId(source_id)})
    
    return {"message": "Gelir kaynağı silindi"}

# Income Records endpoints
@router.get("/records", response_model=List[IncomeRecord])
async def get_income_records(
    source_id: Optional[str] = Query(None, description="Gelir kaynağına göre filtrele"),
    status_filter: Optional[IncomeStatus] = Query(None, description="Duruma göre filtrele"),
    start_date: Optional[datetime] = Query(None, description="Başlangıç tarihi"),
    end_date: Optional[datetime] = Query(None, description="Bitiş tarihi"),
    limit: int = Query(50, le=100, description="Maksimum kayıt sayısı"),
    skip: int = Query(0, ge=0, description="Atlanacak kayıt sayısı"),
    current_user: User = Depends(get_current_user)
):
    """Gelir kayıtlarını listele"""
    db = get_database()
    
    # Filtre oluştur
    filter_query = {}
    if source_id:
        filter_query["income_source_id"] = source_id
    if status_filter:
        filter_query["status"] = status_filter
    if start_date or end_date:
        date_filter = {}
        if start_date:
            date_filter["$gte"] = start_date
        if end_date:
            date_filter["$lte"] = end_date
        filter_query["expected_date"] = date_filter
    
    records = []
    cursor = db.income_records.find(filter_query).sort("expected_date", -1).skip(skip).limit(limit)
    
    async for record in cursor:
        record["_id"] = str(record["_id"])
        records.append(IncomeRecord(**record))
    
    return records

@router.post("/records", response_model=IncomeRecord)
async def create_income_record(
    record_data: IncomeRecordCreate,
    current_user: User = Depends(get_current_user)
):
    """Yeni gelir kaydı oluştur"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    # Gelir kaynağını kontrol et
    if not ObjectId.is_valid(record_data.income_source_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz gelir kaynağı ID"
        )
    
    source = await db.income_sources.find_one({"_id": ObjectId(record_data.income_source_id)})
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gelir kaynağı bulunamadı"
        )
    
    now = datetime.utcnow()
    record_dict = record_data.model_dump()
    
    # Net tutarı hesapla
    net_amount = record_data.amount - record_data.discount - record_data.tax_amount + record_data.late_fee
    record_dict["net_amount"] = net_amount
    
    record_dict.update({
        "created_by": current_user.id,
        "created_at": now,
        "updated_at": now
    })
    
    result = await db.income_records.insert_one(record_dict)
    
    # Gelir kaynağı istatistiklerini güncelle
    await _update_income_source_stats(db, record_data.income_source_id)
    
    # Oluşturulan kaydı getir
    created_record = await db.income_records.find_one({"_id": result.inserted_id})
    created_record["_id"] = str(created_record["_id"])
    
    return IncomeRecord(**created_record)

async def _update_income_source_stats(db, source_id: str):
    """Gelir kaynağı istatistiklerini güncelle"""
    pipeline = [
        {"$match": {"income_source_id": source_id}},
        {
            "$group": {
                "_id": None,
                "total_received": {
                    "$sum": {
                        "$cond": [{"$eq": ["$status", "paid"]}, "$amount", 0]
                    }
                },
                "total_expected": {"$sum": "$amount"},
                "income_count": {"$sum": 1},
                "last_income_date": {
                    "$max": {
                        "$cond": [{"$eq": ["$status", "paid"]}, "$actual_date", None]
                    }
                }
            }
        }
    ]
    
    result = []
    async for doc in db.income_records.aggregate(pipeline):
        result.append(doc)
    
    if result:
        stats = result[0]
        await db.income_sources.update_one(
            {"_id": ObjectId(source_id)},
            {
                "$set": {
                    "total_received": stats.get("total_received", 0),
                    "total_expected": stats.get("total_expected", 0),
                    "income_count": stats.get("income_count", 0),
                    "last_income_date": stats.get("last_income_date"),
                    "updated_at": datetime.utcnow()
                }
            }
        )

@router.get("/forecast", response_model=IncomeForecast)
async def get_income_forecast(
    current_user: User = Depends(get_current_user)
):
    """Gelir tahminini getir"""
    db = get_database()
    
    # Basit forecast algoritması - gelecekte ML ile geliştirilebilir
    now = datetime.utcnow()
    projections = []
    
    for i in range(6):
        month_start = now + relativedelta(months=i)
        month_start = month_start.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_end = (month_start + relativedelta(months=1)) - timedelta(seconds=1)
        
        # O ay için planlanan gelirler
        planned_pipeline = [
            {
                "$match": {
                    "expected_date": {"$gte": month_start, "$lte": month_end}
                }
            },
            {
                "$group": {
                    "_id": None,
                    "expected_total": {"$sum": "$amount"},
                    "confirmed_total": {
                        "$sum": {
                            "$cond": [{"$in": ["$status", ["invoiced", "paid"]]}, "$amount", 0]
                        }
                    }
                }
            }
        ]
        
        month_result = []
        async for doc in db.income_records.aggregate(planned_pipeline):
            month_result.append(doc)
        
        expected_total = month_result[0]["expected_total"] if month_result else 0
        confirmed_total = month_result[0]["confirmed_total"] if month_result else 0
        
        # Tekrarlayan gelirler için otomatik projeksiyon
        recurring_pipeline = [
            {
                "$match": {
                    "is_recurring": True,
                    "is_active": True,
                    "$or": [
                        {"end_date": None},
                        {"end_date": {"$gte": month_start}}
                    ]
                }
            },
            {
                "$group": {
                    "_id": None,
                    "recurring_total": {"$sum": "$expected_amount"}
                }
            }
        ]
        
        recurring_result = []
        async for doc in db.income_sources.aggregate(recurring_pipeline):
            recurring_result.append(doc)
        
        recurring_total = recurring_result[0]["recurring_total"] if recurring_result else 0
        
        projection = IncomeProjection(
            month=month_start.strftime("%Y-%m"),
            expected_total=expected_total + recurring_total,
            confirmed_total=confirmed_total,
            recurring_total=recurring_total,
            one_time_total=expected_total,
            confidence_level=min(90, 50 + (confirmed_total / max(expected_total, 1)) * 40)
        )
        projections.append(projection)
    
    # Yıllık projeksiyon
    yearly_projection = sum(p.expected_total for p in projections) * 2  # 6 ay * 2
    
    return IncomeForecast(
        next_6_months=projections,
        yearly_projection=yearly_projection,
        growth_rate=5.0,  # Varsayılan büyüme oranı
        seasonality_factor=1.0,
        risk_level="medium"
    )