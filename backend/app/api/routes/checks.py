from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile
from typing import List, Optional
from datetime import datetime, date, timedelta
from bson import ObjectId
import os
import aiofiles

from app.models.check import (
    Check,
    CheckCreate,
    CheckUpdate,
    CheckSummary,
    CheckStatus,
    CheckType,
    CheckOperation,
    CheckOperationCreate,
    CheckStatistics,
    CheckAnalysisResult
)
from app.models.user import User
from app.api.routes.auth import get_current_user
from app.core.database import get_database
from app.core.config import settings
from app.services.ai_service import ai_service

router = APIRouter()

def calculate_days_to_due(due_date: datetime) -> tuple[int, bool]:
    """Vadeye kaç gün kaldığını hesaplar"""
    today = date.today()
    due_date_only = due_date.date() if isinstance(due_date, datetime) else due_date
    
    days_diff = (due_date_only - today).days
    is_overdue = days_diff < 0
    
    return abs(days_diff) if is_overdue else days_diff, is_overdue

def calculate_early_cash_amount(amount: float, discount_rate: float) -> float:
    """Erken bozdurma tutarını hesaplar"""
    if discount_rate and discount_rate > 0:
        discount_amount = amount * (discount_rate / 100)
        return amount - discount_amount
    return amount

def update_check_status(check_dict: dict) -> dict:
    """Çek durumunu güncelleştirir"""
    days_to_due, is_overdue = calculate_days_to_due(check_dict["due_date"])
    check_dict["days_to_due"] = days_to_due
    check_dict["is_overdue"] = is_overdue
    
    # Erken bozdurma hesaplama
    if check_dict.get("early_discount_rate"):
        check_dict["early_cash_amount"] = calculate_early_cash_amount(
            check_dict["amount"], 
            check_dict["early_discount_rate"]
        )
    
    return check_dict

@router.get("/", response_model=List[Check])
async def get_checks(
    check_type: Optional[CheckType] = Query(None, description="Çek türüne göre filtrele"),
    status: Optional[CheckStatus] = Query(None, description="Duruma göre filtrele"),
    bank_name: Optional[str] = Query(None, description="Bankaya göre filtrele"),
    overdue_only: bool = Query(False, description="Sadece vadesi geçmiş çekler"),
    due_soon: bool = Query(False, description="Yakın vadeli çekler (30 gün)"),
    limit: int = Query(50, le=100, description="Maksimum kayıt sayısı"),
    skip: int = Query(0, ge=0, description="Atlanacak kayıt sayısı"),
    current_user: User = Depends(get_current_user)
):
    """Çekleri listele"""
    db = get_database()
    
    # Filtre oluştur
    filter_query = {}
    if check_type:
        filter_query["check_type"] = check_type
    if status:
        filter_query["status"] = status
    if bank_name:
        filter_query["bank_name"] = {"$regex": bank_name, "$options": "i"}
    if overdue_only:
        filter_query["due_date"] = {"$lt": datetime.utcnow()}
    if due_soon:
        future_date = datetime.utcnow() + timedelta(days=30)
        filter_query["due_date"] = {"$gte": datetime.utcnow(), "$lte": future_date}
    
    checks = []
    cursor = db.checks.find(filter_query).sort("due_date", 1).skip(skip).limit(limit)
    
    async for check in cursor:
        check["_id"] = str(check["_id"])
        check = update_check_status(check)
        checks.append(Check(**check))
    
    return checks

@router.get("/summary", response_model=List[CheckSummary])
async def get_checks_summary(
    current_user: User = Depends(get_current_user)
):
    """Çeklerin özet bilgilerini getir"""
    db = get_database()
    
    summaries = []
    cursor = db.checks.find().sort("due_date", 1)
    
    async for check in cursor:
        check = update_check_status(check)
        
        # Potansiyel erken bozdurma tutarını hesapla
        potential_early_amount = None
        if check.get("early_discount_rate") and check["status"] == "active":
            potential_early_amount = calculate_early_cash_amount(
                check["amount"], 
                check["early_discount_rate"]
            )
        
        summary = CheckSummary(
            id=str(check["_id"]),
            amount=check["amount"],
            currency=check["currency"],
            check_number=check["check_number"],
            bank_name=check["bank_name"],
            drawer_name=check["drawer_name"],
            due_date=check["due_date"],
            check_type=check["check_type"],
            status=check["status"],
            days_to_due=check["days_to_due"],
            is_overdue=check["is_overdue"],
            early_discount_rate=check.get("early_discount_rate"),
            potential_early_amount=potential_early_amount
        )
        summaries.append(summary)
    
    return summaries

@router.get("/statistics", response_model=CheckStatistics)
async def get_check_statistics(
    current_user: User = Depends(get_current_user)
):
    """Çek istatistiklerini getir"""
    db = get_database()
    
    # Toplam çek sayıları
    total_checks = await db.checks.count_documents({})
    total_received = await db.checks.count_documents({"check_type": "received"})
    total_issued = await db.checks.count_documents({"check_type": "issued"})
    
    # Toplam değerler
    pipeline_total_value = [
        {
            "$group": {
                "_id": None,
                "total_value": {"$sum": "$amount"}
            }
        }
    ]
    
    total_value = 0
    async for doc in db.checks.aggregate(pipeline_total_value):
        total_value = doc["total_value"]
    
    # Aktif çekler
    active_checks = await db.checks.count_documents({"status": "active"})
    
    pipeline_active_value = [
        {
            "$match": {"status": "active"}
        },
        {
            "$group": {
                "_id": None,
                "active_value": {"$sum": "$amount"}
            }
        }
    ]
    
    active_value = 0
    async for doc in db.checks.aggregate(pipeline_active_value):
        active_value = doc["active_value"]
    
    # Vadesi geçmiş çekler
    overdue_filter = {
        "due_date": {"$lt": datetime.utcnow()},
        "status": "active"
    }
    
    overdue_checks = await db.checks.count_documents(overdue_filter)
    
    pipeline_overdue_value = [
        {"$match": overdue_filter},
        {
            "$group": {
                "_id": None,
                "overdue_value": {"$sum": "$amount"}
            }
        }
    ]
    
    overdue_value = 0
    async for doc in db.checks.aggregate(pipeline_overdue_value):
        overdue_value = doc["overdue_value"]
    
    # Bu ay tahsil edilen çekler
    start_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    pipeline_monthly_cashed = [
        {
            "$match": {
                "cash_date": {"$gte": start_of_month},
                "status": {"$in": ["cashed", "early_cashed"]}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_cashed": {"$sum": "$amount"}
            }
        }
    ]
    
    cashed_this_month = 0
    async for doc in db.checks.aggregate(pipeline_monthly_cashed):
        cashed_this_month = doc["total_cashed"]
    
    # Yaklaşan vadeli çekler (gelecek 30 gün)
    future_date = datetime.utcnow() + timedelta(days=30)
    upcoming_filter = {
        "due_date": {"$gte": datetime.utcnow(), "$lte": future_date},
        "status": "active"
    }
    
    upcoming_due = []
    cursor = db.checks.find(upcoming_filter).sort("due_date", 1).limit(10)
    
    async for check in cursor:
        check = update_check_status(check)
        upcoming_due.append({
            "id": str(check["_id"]),
            "check_number": check["check_number"],
            "drawer_name": check["drawer_name"],
            "amount": check["amount"],
            "due_date": check["due_date"],
            "days_until_due": check["days_to_due"]
        })
    
    return CheckStatistics(
        total_checks=total_checks,
        total_received=total_received,
        total_issued=total_issued,
        total_value=total_value,
        active_checks=active_checks,
        active_value=active_value,
        overdue_checks=overdue_checks,
        overdue_value=overdue_value,
        cashed_this_month=cashed_this_month,
        upcoming_due=upcoming_due
    )

@router.get("/{check_id}", response_model=Check)
async def get_check(
    check_id: str,
    current_user: User = Depends(get_current_user)
):
    """Tek bir çekin detaylarını getir"""
    db = get_database()
    
    if not ObjectId.is_valid(check_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz çek ID"
        )
    
    check = await db.checks.find_one({"_id": ObjectId(check_id)})
    if not check:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Çek bulunamadı"
        )
    
    check["_id"] = str(check["_id"])
    check = update_check_status(check)
    
    return Check(**check)

@router.post("/", response_model=Check)
async def create_check(
    check_data: CheckCreate,
    current_user: User = Depends(get_current_user)
):
    """Yeni çek oluştur"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    # Aynı numarada çek var mı kontrol et
    existing_check = await db.checks.find_one({"check_number": check_data.check_number})
    if existing_check:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu numarada bir çek zaten var"
        )
    
    now = datetime.utcnow()
    check_dict = check_data.model_dump()
    check_dict.update({
        "created_by": current_user.id,
        "created_at": now,
        "updated_at": now
    })
    
    check_dict = update_check_status(check_dict)
    
    result = await db.checks.insert_one(check_dict)
    
    # Oluşturulan çeki getir
    created_check = await db.checks.find_one({"_id": result.inserted_id})
    created_check["_id"] = str(created_check["_id"])
    created_check = update_check_status(created_check)
    
    return Check(**created_check)

@router.put("/{check_id}", response_model=Check)
async def update_check(
    check_id: str,
    check_data: CheckUpdate,
    current_user: User = Depends(get_current_user)
):
    """Çek bilgilerini güncelle"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    if not ObjectId.is_valid(check_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz çek ID"
        )
    
    # Mevcut çeki kontrol et
    existing_check = await db.checks.find_one({"_id": ObjectId(check_id)})
    if not existing_check:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Çek bulunamadı"
        )
    
    # Güncelleme verilerini hazırla
    update_data = check_data.model_dump(exclude_unset=True)
    if update_data:
        # Çek numarası değişikliği kontrolü
        if "check_number" in update_data and update_data["check_number"] != existing_check["check_number"]:
            number_exists = await db.checks.find_one({
                "check_number": update_data["check_number"],
                "_id": {"$ne": ObjectId(check_id)}
            })
            if number_exists:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Bu numarada başka bir çek var"
                )
        
        update_data["updated_at"] = datetime.utcnow()
        
        await db.checks.update_one(
            {"_id": ObjectId(check_id)},
            {"$set": update_data}
        )
    
    # Güncellenmiş çeki getir ve durumu hesapla
    updated_check = await db.checks.find_one({"_id": ObjectId(check_id)})
    updated_check["_id"] = str(updated_check["_id"])
    updated_check = update_check_status(updated_check)
    
    # Durumu veritabanında da güncelle
    await db.checks.update_one(
        {"_id": ObjectId(check_id)},
        {"$set": {
            "days_to_due": updated_check["days_to_due"],
            "is_overdue": updated_check["is_overdue"]
        }}
    )
    
    return Check(**updated_check)

@router.delete("/{check_id}")
async def delete_check(
    check_id: str,
    current_user: User = Depends(get_current_user)
):
    """Çeki sil"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    if not ObjectId.is_valid(check_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz çek ID"
        )
    
    check = await db.checks.find_one({"_id": ObjectId(check_id)})
    if not check:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Çek bulunamadı"
        )
    
    # İlişkili işlemleri kontrol et
    operation_count = await db.check_operations.count_documents({"check_id": check_id})
    if operation_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu çeke ait işlemler var. Önce işlemleri silmelisiniz."
        )
    
    # Çek resmi varsa sil
    if check.get("receipt_url"):
        try:
            os.remove(check["receipt_url"])
        except:
            pass
    
    await db.checks.delete_one({"_id": ObjectId(check_id)})
    
    return {"message": "Çek silindi"}

# Çek işlemleri endpoints'leri

@router.get("/{check_id}/operations", response_model=List[CheckOperation])
async def get_check_operations(
    check_id: str,
    limit: int = Query(50, le=100, description="Maksimum kayıt sayısı"),
    skip: int = Query(0, ge=0, description="Atlanacak kayıt sayısı"),
    current_user: User = Depends(get_current_user)
):
    """Çekin işlemlerini listele"""
    db = get_database()
    
    if not ObjectId.is_valid(check_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz çek ID"
        )
    
    operations = []
    cursor = db.check_operations.find(
        {"check_id": check_id}
    ).sort("operation_date", -1).skip(skip).limit(limit)
    
    async for operation in cursor:
        operation["_id"] = str(operation["_id"])
        operations.append(CheckOperation(**operation))
    
    return operations

@router.post("/{check_id}/operations", response_model=CheckOperation)
async def create_check_operation(
    check_id: str,
    operation_data: CheckOperationCreate,
    current_user: User = Depends(get_current_user)
):
    """Çek işlemi oluştur (tahsil, erken bozdurma vb.)"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    if not ObjectId.is_valid(check_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz çek ID"
        )
    
    # Çeki kontrol et
    check = await db.checks.find_one({"_id": ObjectId(check_id)})
    if not check:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Çek bulunamadı"
        )
    
    # Çek durumu kontrolü
    if check["status"] not in ["active"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu çek üzerinde işlem yapılamaz"
        )
    
    now = datetime.utcnow()
    
    operation_dict = operation_data.model_dump()
    operation_dict.update({
        "created_by": current_user.id,
        "created_at": now
    })
    
    # İşlemi kaydet
    result = await db.check_operations.insert_one(operation_dict)
    
    # Çek durumunu güncelle
    update_data = {"updated_at": now}
    
    if operation_data.operation_type == "cash":
        update_data["status"] = CheckStatus.CASHED
        update_data["cash_date"] = operation_data.operation_date
    elif operation_data.operation_type == "early_cash":
        update_data["status"] = CheckStatus.EARLY_CASHED
        update_data["cash_date"] = operation_data.operation_date
        if operation_data.discount_rate:
            update_data["early_discount_rate"] = operation_data.discount_rate
    elif operation_data.operation_type == "return":
        update_data["status"] = CheckStatus.RETURNED
        if operation_data.description:
            update_data["return_reason"] = operation_data.description
    elif operation_data.operation_type == "cancel":
        update_data["status"] = CheckStatus.CANCELLED
    
    await db.checks.update_one(
        {"_id": ObjectId(check_id)},
        {"$set": update_data}
    )
    
    # Banka hesabına para girişi (tahsil işlemlerinde)
    if operation_data.bank_account_id and operation_data.operation_type in ["cash", "early_cash"]:
        if ObjectId.is_valid(operation_data.bank_account_id):
            bank_account = await db.bank_accounts.find_one({"_id": ObjectId(operation_data.bank_account_id)})
            if bank_account:
                cash_amount = operation_data.amount or check["amount"]
                if operation_data.fees:
                    cash_amount -= operation_data.fees
                
                new_balance = bank_account["current_balance"] + cash_amount
                await db.bank_accounts.update_one(
                    {"_id": ObjectId(operation_data.bank_account_id)},
                    {"$set": {
                        "current_balance": new_balance,
                        "updated_at": now
                    }}
                )
    
    # Oluşturulan işlemi getir
    created_operation = await db.check_operations.find_one({"_id": result.inserted_id})
    created_operation["_id"] = str(created_operation["_id"])
    
    return CheckOperation(**created_operation)

@router.post("/analyze-image", response_model=CheckAnalysisResult)
async def analyze_check_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Çek resmini AI ile analiz et"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )

    # Dosya türü kontrolü
    allowed_types = ["image/jpeg", "image/png"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sadece JPEG ve PNG dosyaları desteklenir"
        )

    # Dosya boyutu kontrolü
    if file.size > settings.max_file_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dosya boyutu çok büyük (maksimum 10MB)"
        )

    try:
        # Dosyayı geçici olarak kaydet
        file_extension = file.filename.split(".")[-1]
        temp_filename = f"temp_check_{int(datetime.utcnow().timestamp())}.{file_extension}"
        temp_file_path = os.path.join(settings.upload_dir, temp_filename)

        async with aiofiles.open(temp_file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)

        # AI analizi
        ai_result = await ai_service.analyze_check(temp_file_path)

        # Geçici dosyayı sil
        try:
            os.remove(temp_file_path)
        except:
            pass

        # Sonucu CheckAnalysisResult formatına dönüştür
        if ai_result.get("success"):
            result = CheckAnalysisResult(
                success=True,
                extracted_amount=ai_result.get("amount"),
                extracted_check_number=ai_result.get("check_number"),
                extracted_bank=ai_result.get("bank_name"),
                extracted_date=datetime.fromisoformat(ai_result.get("date")) if ai_result.get("date") else None,
                extracted_due_date=datetime.fromisoformat(ai_result.get("due_date")) if ai_result.get("due_date") else None,
                extracted_drawer=ai_result.get("drawer_name"),
                extracted_payee=ai_result.get("payee_name"),
                confidence_score=ai_result.get("confidence_score", 0.0),
                raw_text=str(ai_result)
            )
        else:
            result = CheckAnalysisResult(
                success=False,
                error_message=ai_result.get("error", "Çek analizi başarısız"),
                confidence_score=0.0
            )

        return result

    except Exception as e:
        # Geçici dosyayı temizle
        try:
            os.remove(temp_file_path)
        except:
            pass
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Çek analizi başarısız: {str(e)}"
        )