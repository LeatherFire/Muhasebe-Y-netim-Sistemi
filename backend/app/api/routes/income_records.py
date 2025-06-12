from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from typing import List, Optional
import os
import aiofiles
import logging
from datetime import datetime, timedelta
from bson import ObjectId

from app.models.user import User
from app.models.income_record import (
    IncomeRecord, IncomeRecordCreate, IncomeRecordUpdate, 
    IncomeRecordSummary, IncomeRecordStatus, IncomeStatistics
)
from app.api.routes.auth import get_current_user
from app.core.database import get_database
from app.core.config import settings

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/")
async def create_income_record(
    company_name: str = Form(...),
    amount: float = Form(...),
    currency: str = Form(default="TRY"),
    bank_account_id: str = Form(...),
    description: Optional[str] = Form(None),
    income_date: str = Form(...),
    receipt_file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user)
):
    """Yeni gelir kaydı oluştur"""
    # Sadece admin'ler gelir kaydı oluşturabilir
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    logger.info(f"Creating income record for user {current_user.username}")
    logger.info(f"Request data: company_name={company_name}, amount={amount}, currency={currency}")
    logger.info(f"Bank account ID: {bank_account_id}, income_date={income_date}")
    logger.info(f"Receipt file: {receipt_file.filename if receipt_file else 'None'}")
    try:
        db = get_database()
        
        # Banka hesabının varlığını kontrol et
        logger.info(f"Looking for bank account with ID: {bank_account_id}")
        logger.info(f"Current user ID: {current_user.id}")
        
        bank_account = await db.bank_accounts.find_one({
            "_id": ObjectId(bank_account_id)
        })
        
        if not bank_account:
            logger.error(f"Bank account not found: {bank_account_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Banka hesabı bulunamadı"
            )
        
        logger.info(f"Found bank account: {bank_account.get('name', 'Unknown')}")
        logger.info(f"Bank account user_id: {bank_account.get('user_id', 'None')}")
        
        # Check if bank account belongs to user (optional check for now)
        if bank_account.get("user_id") and bank_account.get("user_id") != current_user.id:
            logger.warning(f"Bank account belongs to different user: {bank_account.get('user_id')} vs {current_user.id}")
            # For now, we'll allow it and just log a warning
        
        # Dosya yükleme işlemi
        file_path = None
        if receipt_file and receipt_file.filename:
            # Dosya türü kontrolü
            allowed_types = ["image/jpeg", "image/png", "image/jpg", "application/pdf"]
            if receipt_file.content_type not in allowed_types:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Sadece JPG, PNG ve PDF dosyaları desteklenir"
                )
            
            # Dosya boyutu kontrolü (10MB)
            if receipt_file.size > 10 * 1024 * 1024:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Dosya boyutu 10MB'dan büyük olamaz"
                )
            
            # Dosyayı kaydet
            file_extension = receipt_file.filename.split(".")[-1]
            filename = f"income_receipt_{int(datetime.utcnow().timestamp())}.{file_extension}"
            file_path = os.path.join("uploads/income_receipts", filename)
            
            # Klasörü oluştur
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            
            async with aiofiles.open(file_path, 'wb') as f:
                content = await receipt_file.read()
                await f.write(content)
        
        # Gelir kaydını oluştur
        try:
            # Date parsing with better error handling
            if 'T' in income_date:
                parsed_date = datetime.fromisoformat(income_date)
            else:
                # Assume YYYY-MM-DD format
                parsed_date = datetime.strptime(income_date, '%Y-%m-%d')
        except ValueError as e:
            logger.error(f"Date parsing error: {income_date}, error: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid date format: {income_date}"
            )
        
        # Admin kullanıcıları için otomatik verified durumu
        initial_status = IncomeRecordStatus.VERIFIED if current_user.role == "admin" else IncomeRecordStatus.PENDING
        logger.info(f"User role: {current_user.role}, Setting initial status to: {initial_status}")
        
        income_record = IncomeRecord(
            company_name=company_name,
            amount=amount,
            currency=currency,
            bank_account_id=bank_account_id,
            description=description,
            income_date=parsed_date,
            receipt_file=file_path,
            created_by=current_user.id,
            status=initial_status
        )
        
        # Admin tarafından oluşturulan kayıtları hemen onaylanmış olarak işaretle
        if current_user.role == "admin":
            income_record.verified_at = datetime.utcnow()
            income_record.verified_by = current_user.id
        
        # Veritabanına kaydet (ID'yi çıkar, MongoDB otomatik ekleyecek)
        income_record_dict = income_record.dict(by_alias=True, exclude={'id'})
        if '_id' in income_record_dict:
            del income_record_dict['_id']
        result = await db.income_records.insert_one(income_record_dict)
        
        # Eğer status verified ise banka hesabı bakiyesini güncelle ve transaction oluştur
        if income_record.status == IncomeRecordStatus.VERIFIED:
            await update_bank_account_balance(db, bank_account_id, amount, currency)
            await create_income_transaction(db, income_record, result.inserted_id, current_user.id)
        
        # Veritabanından güncel kaydı getir (ID ile birlikte)
        created_record = await db.income_records.find_one({"_id": result.inserted_id})
        if created_record:
            # ObjectId'yi string'e çevir ve id field'ını set et
            record_id = str(created_record["_id"])
            created_record["id"] = record_id
            # _id field'ını çıkar ve IncomeRecord oluştur
            del created_record["_id"]
            income_record_response = IncomeRecord(**created_record)
            income_record_response.id = record_id
            
            # Manuel response dict oluştur
            return {
                "id": record_id,
                "company_name": created_record["company_name"],
                "amount": created_record["amount"],
                "currency": created_record["currency"],
                "bank_account_id": created_record["bank_account_id"],
                "receipt_file": created_record.get("receipt_file"),
                "description": created_record.get("description"),
                "income_date": created_record["income_date"].isoformat() if isinstance(created_record["income_date"], datetime) else created_record["income_date"],
                "status": created_record["status"],
                "created_at": created_record["created_at"].isoformat() if isinstance(created_record["created_at"], datetime) else created_record["created_at"],
                "created_by": created_record["created_by"],
                "verified_at": created_record.get("verified_at").isoformat() if created_record.get("verified_at") else None,
                "verified_by": created_record.get("verified_by"),
                "rejection_reason": created_record.get("rejection_reason")
            }
        else:
            # Fallback - manuel ID set
            income_record.id = str(result.inserted_id)
            return income_record
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Income record creation failed: {str(e)}")
        logger.error(f"Exception type: {type(e).__name__}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        # Hata durumunda dosyayı sil
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gelir kaydı oluşturulurken hata: {str(e)}"
        )

@router.get("/", response_model=List[IncomeRecordSummary])
async def get_income_records(
    status_filter: Optional[IncomeRecordStatus] = None,
    company_name: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    current_user: User = Depends(get_current_user)
):
    """Gelir kayıtlarını listele"""
    try:
        db = get_database()
        
        # Query oluştur
        # Tüm kullanıcılar tüm kayıtları görebilir
        query = {}
        
        if status_filter:
            query["status"] = status_filter.value
        
        if company_name:
            query["company_name"] = {"$regex": company_name, "$options": "i"}
        
        if start_date and end_date:
            query["income_date"] = {
                "$gte": datetime.fromisoformat(start_date),
                "$lte": datetime.fromisoformat(end_date)
            }
        
        # Kayıtları getir
        cursor = db.income_records.find(query).sort("created_at", -1).skip(skip).limit(limit)
        records = []
        
        async for record in cursor:
            # Banka hesabı bilgisini getir
            bank_account = await db.bank_accounts.find_one({"_id": ObjectId(record["bank_account_id"])})
            bank_account_name = bank_account.get("bank_name", "Bilinmiyor") if bank_account else "Bilinmiyor"
            
            summary = IncomeRecordSummary(
                id=str(record["_id"]),
                company_name=record["company_name"],
                amount=record["amount"],
                currency=record["currency"],
                bank_account_name=bank_account_name,
                status=record["status"],
                income_date=record["income_date"],
                created_at=record["created_at"],
                has_receipt=bool(record.get("receipt_file"))
            )
            records.append(summary)
        
        return records
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gelir kayıtları getirilirken hata: {str(e)}"
        )

@router.get("/statistics", response_model=IncomeStatistics)
async def get_income_statistics(
    current_user: User = Depends(get_current_user)
):
    """Gelir istatistiklerini getir"""
    try:
        db = get_database()
        
        # Temel istatistikler
        total_records = await db.income_records.count_documents({})
        pending_count = await db.income_records.count_documents({
            "status": IncomeRecordStatus.PENDING.value
        })
        verified_count = await db.income_records.count_documents({
            "status": IncomeRecordStatus.VERIFIED.value
        })
        rejected_count = await db.income_records.count_documents({
            "status": IncomeRecordStatus.REJECTED.value
        })
        
        # Onaylanan toplam tutar
        verified_pipeline = [
            {"$match": {"status": IncomeRecordStatus.VERIFIED.value}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]
        verified_result = await db.income_records.aggregate(verified_pipeline).to_list(1)
        total_verified_amount = verified_result[0]["total"] if verified_result else 0
        
        # Bu ay ve geçen ay geliri
        now = datetime.utcnow()
        current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        previous_month_start = (current_month_start - timedelta(days=1)).replace(day=1)
        
        current_month_pipeline = [
            {
                "$match": {
                    "status": IncomeRecordStatus.VERIFIED.value,
                    "income_date": {"$gte": current_month_start}
                }
            },
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]
        current_month_result = await db.income_records.aggregate(current_month_pipeline).to_list(1)
        current_month_income = current_month_result[0]["total"] if current_month_result else 0
        
        previous_month_pipeline = [
            {
                "$match": {
                    "status": IncomeRecordStatus.VERIFIED.value,
                    "income_date": {
                        "$gte": previous_month_start,
                        "$lt": current_month_start
                    }
                }
            },
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]
        previous_month_result = await db.income_records.aggregate(previous_month_pipeline).to_list(1)
        previous_month_income = previous_month_result[0]["total"] if previous_month_result else 0
        
        # Büyüme oranı hesapla
        if previous_month_income > 0:
            monthly_growth_rate = ((current_month_income - previous_month_income) / previous_month_income) * 100
        else:
            monthly_growth_rate = 100.0 if current_month_income > 0 else 0.0
        
        # En çok ödeme yapan şirketler
        top_companies_pipeline = [
            {
                "$match": {
                    "status": IncomeRecordStatus.VERIFIED.value
                }
            },
            {
                "$group": {
                    "_id": "$company_name",
                    "total_amount": {"$sum": "$amount"},
                    "payment_count": {"$sum": 1}
                }
            },
            {"$sort": {"total_amount": -1}},
            {"$limit": 5}
        ]
        top_companies_cursor = db.income_records.aggregate(top_companies_pipeline)
        top_companies = []
        async for company in top_companies_cursor:
            top_companies.append({
                "company_name": company["_id"],
                "total_amount": company["total_amount"],
                "payment_count": company["payment_count"]
            })
        
        # Aylık trend (son 6 ay)
        monthly_trend = []
        for i in range(6):
            month_start = (now.replace(day=1) - timedelta(days=i*30)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            month_end = (month_start + timedelta(days=32)).replace(day=1) - timedelta(seconds=1)
            
            month_pipeline = [
                {
                    "$match": {
                        "status": IncomeRecordStatus.VERIFIED.value,
                        "income_date": {"$gte": month_start, "$lte": month_end}
                    }
                },
                {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
            ]
            month_result = await db.income_records.aggregate(month_pipeline).to_list(1)
            month_data = month_result[0] if month_result else {"total": 0, "count": 0}
            
            monthly_trend.insert(0, {
                "month": month_start.strftime("%Y-%m"),
                "total_amount": month_data["total"],
                "record_count": month_data["count"]
            })
        
        return IncomeStatistics(
            total_records=total_records,
            pending_count=pending_count,
            verified_count=verified_count,
            rejected_count=rejected_count,
            total_verified_amount=total_verified_amount,
            current_month_income=current_month_income,
            previous_month_income=previous_month_income,
            monthly_growth_rate=monthly_growth_rate,
            top_companies=top_companies,
            monthly_trend=monthly_trend
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"İstatistikler hesaplanırken hata: {str(e)}"
        )

@router.put("/{record_id}/verify", response_model=IncomeRecord)
async def verify_income_record(
    record_id: str,
    current_user: User = Depends(get_current_user)
):
    """Gelir kaydını onayla ve banka hesabı bakiyesini güncelle"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    try:
        db = get_database()
        
        # Kaydı getir
        record = await db.income_records.find_one({"_id": ObjectId(record_id)})
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Gelir kaydı bulunamadı"
            )
        
        # Eğer zaten onaylanmışsa hata ver
        if record["status"] == IncomeRecordStatus.VERIFIED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bu kayıt zaten onaylanmış"
            )
        
        # Kaydı onayla
        update_data = {
            "status": IncomeRecordStatus.VERIFIED.value,
            "verified_at": datetime.utcnow(),
            "verified_by": current_user.id
        }
        
        await db.income_records.update_one(
            {"_id": ObjectId(record_id)},
            {"$set": update_data}
        )
        
        # Banka hesabı bakiyesini güncelle ve transaction oluştur
        await update_bank_account_balance(
            db, 
            record["bank_account_id"], 
            record["amount"], 
            record["currency"]
        )
        
        # Transaction oluştur
        from app.models.income_record import IncomeRecord as IncomeRecordModel
        income_record_obj = IncomeRecordModel(**record)
        await create_income_transaction(db, income_record_obj, ObjectId(record_id), current_user.id)
        
        # Güncellenmiş kaydı getir
        updated_record = await db.income_records.find_one({"_id": ObjectId(record_id)})
        updated_record["id"] = str(updated_record["_id"])
        
        return IncomeRecord(**updated_record)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Kayıt onaylanırken hata: {str(e)}"
        )

@router.put("/{record_id}/reject", response_model=IncomeRecord)
async def reject_income_record(
    record_id: str,
    rejection_reason: str = Form(...),
    current_user: User = Depends(get_current_user)
):
    """Gelir kaydını reddet"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    try:
        db = get_database()
        
        # Kaydı getir
        record = await db.income_records.find_one({"_id": ObjectId(record_id)})
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Gelir kaydı bulunamadı"
            )
        
        # Kaydı reddet
        update_data = {
            "status": IncomeRecordStatus.REJECTED.value,
            "rejection_reason": rejection_reason,
            "verified_at": datetime.utcnow(),
            "verified_by": current_user.id
        }
        
        await db.income_records.update_one(
            {"_id": ObjectId(record_id)},
            {"$set": update_data}
        )
        
        # Güncellenmiş kaydı getir
        updated_record = await db.income_records.find_one({"_id": ObjectId(record_id)})
        updated_record["id"] = str(updated_record["_id"])
        
        return IncomeRecord(**updated_record)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Kayıt reddedilirken hata: {str(e)}"
        )

@router.delete("/{record_id}")
async def delete_income_record(
    record_id: str,
    current_user: User = Depends(get_current_user)
):
    """Gelir kaydını sil"""
    try:
        db = get_database()
        
        # Kaydı getir
        record = await db.income_records.find_one({
            "_id": ObjectId(record_id),
            "created_by": current_user.id
        })
        
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Gelir kaydı bulunamadı"
            )
        
        # Eğer onaylanmış kayıtsa admin yetkisi gerekli
        if record["status"] == IncomeRecordStatus.VERIFIED.value and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Onaylanmış kayıtları silmek için admin yetkisi gerekli"
            )
        
        # Dosyayı sil
        if record.get("receipt_file") and os.path.exists(record["receipt_file"]):
            try:
                os.remove(record["receipt_file"])
            except:
                pass
        
        # Kaydı sil
        await db.income_records.delete_one({"_id": ObjectId(record_id)})
        
        return {"message": "Gelir kaydı başarıyla silindi"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Kayıt silinirken hata: {str(e)}"
        )

async def update_bank_account_balance(db, bank_account_id: str, amount: float, currency: str):
    """Banka hesabı bakiyesini güncelle"""
    try:
        logger.info(f"Updating bank account balance: account_id={bank_account_id}, amount={amount}, currency={currency}")
        
        # Banka hesabını getir
        bank_account = await db.bank_accounts.find_one({"_id": ObjectId(bank_account_id)})
        if not bank_account:
            logger.warning(f"Bank account not found: {bank_account_id}")
            return
        
        logger.info(f"Current bank account: {bank_account.get('bank_name', 'Unknown')}, current_balance={bank_account.get('current_balance', 0)}, currency={bank_account.get('currency', 'Unknown')}")
        
        # Aynı para birimindeyse direkt ekle, değilse dönüştürme gerekli
        if bank_account.get("currency") == currency:
            old_balance = bank_account.get("current_balance", 0)
            new_balance = old_balance + amount
            logger.info(f"Updating balance from {old_balance} to {new_balance}")
            
            result = await db.bank_accounts.update_one(
                {"_id": ObjectId(bank_account_id)},
                {"$set": {"current_balance": new_balance}}
            )
            
            if result.modified_count > 0:
                logger.info(f"Bank account balance updated successfully")
            else:
                logger.warning(f"Bank account balance update failed - no documents modified")
        else:
            logger.warning(f"Currency mismatch: bank account currency {bank_account.get('currency')} vs income currency {currency}")
        
        # TODO: Farklı para birimleri için döviz çevirme mantığı eklenebilir
        
    except Exception as e:
        logger.error(f"Banka hesabı bakiyesi güncellenirken hata: {e}")
        # Bakiye güncellemede hata olsa bile gelir kaydı başarılı olsun

async def create_income_transaction(db, income_record, income_record_id, created_by: str):
    """Gelir kaydı için transaction oluştur"""
    try:
        # Kişi/şirket kaydını kontrol et veya oluştur
        person_id = None
        if income_record.company_name:
            # Mevcut şirket kaydını ara
            existing_person = await db.people.find_one({
                "name": {"$regex": f"^{income_record.company_name}$", "$options": "i"}
            })
            
            if existing_person:
                person_id = str(existing_person["_id"])
                # İstatistikleri güncelle
                await db.people.update_one(
                    {"_id": ObjectId(person_id)},
                    {
                        "$inc": {"total_received": income_record.amount, "transaction_count": 1},
                        "$set": {"last_transaction_date": income_record.income_date, "updated_at": datetime.utcnow()}
                    }
                )
            else:
                # Yeni şirket kaydı oluştur
                person_data = {
                    "name": income_record.company_name,
                    "person_type": "company",
                    "total_sent": 0.0,
                    "total_received": income_record.amount,
                    "transaction_count": 1,
                    "last_transaction_date": income_record.income_date,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                    "auto_created": True,
                    "creation_source": "income_record"
                }
                
                person_result = await db.people.insert_one(person_data)
                person_id = str(person_result.inserted_id)
        
        # Transaction kaydı oluştur
        transaction_data = {
            "type": "income",
            "amount": income_record.amount,
            "currency": income_record.currency,
            "description": f"Gelir Kaydı: {income_record.company_name} - {income_record.description or 'Ödeme alındı'}",
            "bank_account_id": income_record.bank_account_id,
            "person_id": person_id,
            "income_record_id": str(income_record_id),
            "fees": {},
            "total_fees": 0.0,
            "net_amount": income_record.amount,
            "balance_impact": income_record.amount,
            "status": "completed",
            "transaction_date": income_record.income_date,
            "receipt_url": income_record.receipt_file,
            "created_by": created_by,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await db.transactions.insert_one(transaction_data)
        logger.info(f"Income transaction created: {result.inserted_id}")
        return result.inserted_id
        
    except Exception as e:
        logger.error(f"Failed to create income transaction: {e}")
        return None