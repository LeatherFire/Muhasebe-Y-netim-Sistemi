from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime, date, timedelta
from bson import ObjectId

from app.models.debt import (
    Debt,
    DebtCreate,
    DebtUpdate,
    DebtSummary,
    DebtStatus,
    DebtCategory,
    DebtType,
    DebtPayment,
    DebtPaymentCreate,
    DebtStatistics
)
from app.models.user import User
from app.api.routes.auth import get_current_user
from app.core.database import get_database

router = APIRouter()

def calculate_days_overdue(due_date: datetime) -> int:
    """Vade tarihinden bugüne kaç gün geçtiğini hesaplar"""
    today = date.today()
    due_date_only = due_date.date() if isinstance(due_date, datetime) else due_date
    
    if due_date_only < today:
        return (today - due_date_only).days
    return 0

def update_debt_status(debt_dict: dict) -> dict:
    """Borç durumunu güncelleştirir"""
    remaining_amount = debt_dict["amount"] - debt_dict.get("paid_amount", 0)
    debt_dict["remaining_amount"] = remaining_amount
    
    days_overdue = calculate_days_overdue(debt_dict["due_date"])
    debt_dict["days_overdue"] = days_overdue
    
    # Durum güncelleme
    if remaining_amount <= 0:
        debt_dict["status"] = DebtStatus.PAID
    elif debt_dict.get("paid_amount", 0) > 0:
        if days_overdue > 0:
            debt_dict["status"] = DebtStatus.OVERDUE
        else:
            debt_dict["status"] = DebtStatus.PARTIAL
    elif days_overdue > 0:
        debt_dict["status"] = DebtStatus.OVERDUE
    else:
        debt_dict["status"] = DebtStatus.ACTIVE
    
    return debt_dict

@router.get("/", response_model=List[Debt])
async def get_debts(
    debt_type: Optional[DebtType] = Query(None, description="Borç türüne göre filtrele"),
    status: Optional[DebtStatus] = Query(None, description="Duruma göre filtrele"),
    category: Optional[DebtCategory] = Query(None, description="Kategoriye göre filtrele"),
    overdue_only: bool = Query(False, description="Sadece vadesi geçmiş borçlar"),
    limit: int = Query(50, le=100, description="Maksimum kayıt sayısı"),
    skip: int = Query(0, ge=0, description="Atlanacak kayıt sayısı"),
    current_user: User = Depends(get_current_user)
):
    """Borçları listele"""
    db = get_database()
    
    # Filtre oluştur
    filter_query = {}
    if debt_type:
        filter_query["debt_type"] = debt_type
    if status:
        filter_query["status"] = status
    if category:
        filter_query["category"] = category
    if overdue_only:
        filter_query["due_date"] = {"$lt": datetime.utcnow()}
    
    debts = []
    cursor = db.debts.find(filter_query).sort("due_date", 1).skip(skip).limit(limit)
    
    async for debt in cursor:
        debt["_id"] = str(debt["_id"])
        debt = update_debt_status(debt)
        debts.append(Debt(**debt))
    
    return debts

@router.get("/summary", response_model=List[DebtSummary])
async def get_debts_summary(
    current_user: User = Depends(get_current_user)
):
    """Borçların özet bilgilerini getir"""
    db = get_database()
    
    summaries = []
    cursor = db.debts.find().sort("due_date", 1)
    
    async for debt in cursor:
        debt = update_debt_status(debt)
        
        summary = DebtSummary(
            id=str(debt["_id"]),
            creditor_name=debt["creditor_name"],
            debtor_name=debt.get("debtor_name"),
            amount=debt["amount"],
            paid_amount=debt.get("paid_amount", 0),
            remaining_amount=debt["remaining_amount"],
            currency=debt["currency"],
            category=debt["category"],
            debt_type=debt["debt_type"],
            status=debt["status"],
            due_date=debt["due_date"],
            days_overdue=debt["days_overdue"],
            interest_rate=debt.get("interest_rate"),
            payment_count=debt.get("payment_count", 0)
        )
        summaries.append(summary)
    
    return summaries

@router.get("/statistics", response_model=DebtStatistics)
async def get_debt_statistics(
    current_user: User = Depends(get_current_user)
):
    """Borç istatistiklerini getir"""
    db = get_database()
    
    # Toplam borç sayıları
    total_debts = await db.debts.count_documents({"debt_type": "payable"})
    total_receivables = await db.debts.count_documents({"debt_type": "receivable"})
    
    # Toplam tutarlar
    pipeline_amounts = [
        {
            "$group": {
                "_id": "$debt_type",
                "total_amount": {"$sum": "$amount"},
                "total_remaining": {"$sum": {"$subtract": ["$amount", {"$ifNull": ["$paid_amount", 0]}]}}
            }
        }
    ]
    
    amounts_by_type = {}
    async for doc in db.debts.aggregate(pipeline_amounts):
        amounts_by_type[doc["_id"]] = doc
    
    total_debt_amount = amounts_by_type.get("payable", {}).get("total_remaining", 0)
    total_receivable_amount = amounts_by_type.get("receivable", {}).get("total_remaining", 0)
    
    # Vadesi geçmiş borçlar
    overdue_filter = {
        "due_date": {"$lt": datetime.utcnow()},
        "status": {"$nin": ["paid", "cancelled"]}
    }
    
    overdue_debts = await db.debts.count_documents(overdue_filter)
    
    pipeline_overdue_amount = [
        {"$match": overdue_filter},
        {
            "$group": {
                "_id": None,
                "total_overdue": {"$sum": {"$subtract": ["$amount", {"$ifNull": ["$paid_amount", 0]}]}}
            }
        }
    ]
    
    overdue_amount = 0
    async for doc in db.debts.aggregate(pipeline_overdue_amount):
        overdue_amount = doc["total_overdue"]
    
    # Bu ay yapılan ödemeler
    start_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    pipeline_monthly_payments = [
        {
            "$match": {
                "payment_date": {"$gte": start_of_month}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_paid": {"$sum": "$amount"}
            }
        }
    ]
    
    paid_this_month = 0
    async for doc in db.debt_payments.aggregate(pipeline_monthly_payments):
        paid_this_month = doc["total_paid"]
    
    # Yaklaşan ödemeler (gelecek 30 gün)
    future_date = datetime.utcnow() + timedelta(days=30)
    upcoming_filter = {
        "due_date": {"$gte": datetime.utcnow(), "$lte": future_date},
        "status": {"$nin": ["paid", "cancelled"]}
    }
    
    upcoming_payments = []
    cursor = db.debts.find(upcoming_filter).sort("due_date", 1).limit(10)
    
    async for debt in cursor:
        debt = update_debt_status(debt)
        upcoming_payments.append({
            "id": str(debt["_id"]),
            "creditor_name": debt["creditor_name"],
            "amount": debt["remaining_amount"],
            "due_date": debt["due_date"],
            "days_until_due": (debt["due_date"].date() - date.today()).days
        })
    
    return DebtStatistics(
        total_debts=total_debts,
        total_receivables=total_receivables,
        total_debt_amount=total_debt_amount,
        total_receivable_amount=total_receivable_amount,
        overdue_debts=overdue_debts,
        overdue_amount=overdue_amount,
        paid_this_month=paid_this_month,
        upcoming_payments=upcoming_payments
    )

@router.get("/{debt_id}", response_model=Debt)
async def get_debt(
    debt_id: str,
    current_user: User = Depends(get_current_user)
):
    """Tek bir borcun detaylarını getir"""
    db = get_database()
    
    if not ObjectId.is_valid(debt_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz borç ID"
        )
    
    debt = await db.debts.find_one({"_id": ObjectId(debt_id)})
    if not debt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Borç bulunamadı"
        )
    
    debt["_id"] = str(debt["_id"])
    debt = update_debt_status(debt)
    
    return Debt(**debt)

@router.post("/", response_model=Debt)
async def create_debt(
    debt_data: DebtCreate,
    current_user: User = Depends(get_current_user)
):
    """Yeni borç oluştur"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    now = datetime.utcnow()
    debt_dict = debt_data.model_dump()
    debt_dict.update({
        "paid_amount": 0.0,
        "remaining_amount": debt_data.amount,
        "payment_count": 0,
        "created_by": current_user.id,
        "created_at": now,
        "updated_at": now
    })
    
    debt_dict = update_debt_status(debt_dict)
    
    result = await db.debts.insert_one(debt_dict)
    
    # Oluşturulan borcu getir
    created_debt = await db.debts.find_one({"_id": result.inserted_id})
    created_debt["_id"] = str(created_debt["_id"])
    created_debt = update_debt_status(created_debt)
    
    return Debt(**created_debt)

@router.put("/{debt_id}", response_model=Debt)
async def update_debt(
    debt_id: str,
    debt_data: DebtUpdate,
    current_user: User = Depends(get_current_user)
):
    """Borç bilgilerini güncelle"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    if not ObjectId.is_valid(debt_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz borç ID"
        )
    
    # Mevcut borcu kontrol et
    existing_debt = await db.debts.find_one({"_id": ObjectId(debt_id)})
    if not existing_debt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Borç bulunamadı"
        )
    
    # Güncelleme verilerini hazırla
    update_data = debt_data.model_dump(exclude_unset=True)
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        
        await db.debts.update_one(
            {"_id": ObjectId(debt_id)},
            {"$set": update_data}
        )
    
    # Güncellenmiş borcu getir ve durumu hesapla
    updated_debt = await db.debts.find_one({"_id": ObjectId(debt_id)})
    updated_debt["_id"] = str(updated_debt["_id"])
    updated_debt = update_debt_status(updated_debt)
    
    # Durumu veritabanında da güncelle
    await db.debts.update_one(
        {"_id": ObjectId(debt_id)},
        {"$set": {
            "status": updated_debt["status"],
            "remaining_amount": updated_debt["remaining_amount"],
            "days_overdue": updated_debt["days_overdue"]
        }}
    )
    
    return Debt(**updated_debt)

@router.delete("/{debt_id}")
async def delete_debt(
    debt_id: str,
    current_user: User = Depends(get_current_user)
):
    """Borcu sil"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    if not ObjectId.is_valid(debt_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz borç ID"
        )
    
    debt = await db.debts.find_one({"_id": ObjectId(debt_id)})
    if not debt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Borç bulunamadı"
        )
    
    # İlişkili ödemeleri kontrol et
    payment_count = await db.debt_payments.count_documents({"debt_id": debt_id})
    if payment_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu borca ait ödemeler var. Önce ödemeleri silmelisiniz."
        )
    
    await db.debts.delete_one({"_id": ObjectId(debt_id)})
    
    return {"message": "Borç silindi"}

# Borç ödemeleri endpoints'leri

@router.get("/{debt_id}/payments", response_model=List[DebtPayment])
async def get_debt_payments(
    debt_id: str,
    limit: int = Query(50, le=100, description="Maksimum kayıt sayısı"),
    skip: int = Query(0, ge=0, description="Atlanacak kayıt sayısı"),
    current_user: User = Depends(get_current_user)
):
    """Borcun ödemelerini listele"""
    db = get_database()
    
    if not ObjectId.is_valid(debt_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz borç ID"
        )
    
    payments = []
    cursor = db.debt_payments.find(
        {"debt_id": debt_id}
    ).sort("payment_date", -1).skip(skip).limit(limit)
    
    async for payment in cursor:
        payment["_id"] = str(payment["_id"])
        payments.append(DebtPayment(**payment))
    
    return payments

@router.post("/{debt_id}/payments", response_model=DebtPayment)
async def create_debt_payment(
    debt_id: str,
    payment_data: DebtPaymentCreate,
    current_user: User = Depends(get_current_user)
):
    """Borca ödeme yap"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    if not ObjectId.is_valid(debt_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz borç ID"
        )
    
    # Borcu kontrol et
    debt = await db.debts.find_one({"_id": ObjectId(debt_id)})
    if not debt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Borç bulunamadı"
        )
    
    # Ödeme tutarı kontrolü
    remaining_amount = debt["amount"] - debt.get("paid_amount", 0)
    if payment_data.amount > remaining_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ödeme tutarı kalan tutardan fazla olamaz. Kalan: {remaining_amount}"
        )
    
    now = datetime.utcnow()
    
    payment_dict = payment_data.model_dump()
    payment_dict.update({
        "created_by": current_user.id,
        "created_at": now
    })
    
    # Ödemeyi kaydet
    result = await db.debt_payments.insert_one(payment_dict)
    
    # Borcun ödenen tutarını güncelle
    new_paid_amount = debt.get("paid_amount", 0) + payment_data.amount
    new_payment_count = debt.get("payment_count", 0) + 1
    
    await db.debts.update_one(
        {"_id": ObjectId(debt_id)},
        {"$set": {
            "paid_amount": new_paid_amount,
            "last_payment_date": payment_data.payment_date,
            "payment_count": new_payment_count,
            "updated_at": now
        }}
    )
    
    # Banka hesabından para çıkışı (eğer belirtilmişse)
    if payment_data.bank_account_id:
        if ObjectId.is_valid(payment_data.bank_account_id):
            bank_account = await db.bank_accounts.find_one({"_id": ObjectId(payment_data.bank_account_id)})
            if bank_account:
                new_balance = bank_account["current_balance"] - payment_data.amount
                await db.bank_accounts.update_one(
                    {"_id": ObjectId(payment_data.bank_account_id)},
                    {"$set": {
                        "current_balance": new_balance,
                        "updated_at": now
                    }}
                )
    
    # Borç durumunu güncelle
    updated_debt = await db.debts.find_one({"_id": ObjectId(debt_id)})
    updated_debt = update_debt_status(updated_debt)
    
    await db.debts.update_one(
        {"_id": ObjectId(debt_id)},
        {"$set": {
            "status": updated_debt["status"],
            "remaining_amount": updated_debt["remaining_amount"]
        }}
    )
    
    # Oluşturulan ödemeyi getir
    created_payment = await db.debt_payments.find_one({"_id": result.inserted_id})
    created_payment["_id"] = str(created_payment["_id"])
    
    return DebtPayment(**created_payment)