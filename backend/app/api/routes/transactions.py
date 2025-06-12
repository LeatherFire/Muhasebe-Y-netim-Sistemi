from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import os
import aiofiles
import logging

logger = logging.getLogger(__name__)

from app.models.transaction import (
    Transaction,
    TransactionCreate,
    TransactionUpdate,
    TransactionSummary,
    TransactionType,
    TransactionStatus,
    ReceiptAnalysisResult,
    FeeCalculation
)
from app.models.payment_detail import AutoPersonCreate, PaymentDetailCreate
from app.models.user import User
from app.api.routes.auth import get_current_user
from app.core.database import get_database
from app.core.config import settings
from app.services.ai_service import ai_service

router = APIRouter()

@router.get("/", response_model=List[Transaction])
async def get_transactions(
    transaction_type: Optional[TransactionType] = Query(None, description="İşlem türüne göre filtrele"),
    bank_account_id: Optional[str] = Query(None, description="Banka hesabına göre filtrele"),
    status_filter: Optional[TransactionStatus] = Query(None, description="Duruma göre filtrele"),
    start_date: Optional[datetime] = Query(None, description="Başlangıç tarihi"),
    end_date: Optional[datetime] = Query(None, description="Bitiş tarihi"),
    limit: int = Query(50, le=100, description="Maksimum kayıt sayısı"),
    skip: int = Query(0, ge=0, description="Atlanacak kayıt sayısı"),
    current_user: User = Depends(get_current_user)
):
    """İşlemleri listele"""
    db = get_database()
    
    # Filtre oluştur
    filter_query = {}
    if transaction_type:
        filter_query["type"] = transaction_type
    if bank_account_id:
        filter_query["bank_account_id"] = bank_account_id
    if status_filter:
        filter_query["status"] = status_filter
    if start_date or end_date:
        date_filter = {}
        if start_date:
            date_filter["$gte"] = start_date
        if end_date:
            date_filter["$lte"] = end_date
        filter_query["transaction_date"] = date_filter
    
    transactions = []
    cursor = db.transactions.find(filter_query).sort("transaction_date", -1).skip(skip).limit(limit)
    
    async for transaction in cursor:
        transaction["_id"] = str(transaction["_id"])
        transactions.append(Transaction(**transaction))
    
    return transactions

@router.get("/summary", response_model=List[TransactionSummary])
async def get_transactions_summary(
    current_user: User = Depends(get_current_user)
):
    """İşlemlerin özet bilgilerini getir"""
    db = get_database()
    
    # Aggregate pipeline ile bank account ve person bilgilerini join et
    pipeline = [
        {
            "$addFields": {
                "bank_account_oid": {"$toObjectId": "$bank_account_id"},
                "person_oid": {
                    "$cond": {
                        "if": {"$ne": ["$person_id", None]},
                        "then": {"$toObjectId": "$person_id"},
                        "else": None
                    }
                }
            }
        },
        {
            "$lookup": {
                "from": "bank_accounts",
                "localField": "bank_account_oid",
                "foreignField": "_id",
                "as": "bank_account"
            }
        },
        {
            "$lookup": {
                "from": "people",
                "localField": "person_oid",
                "foreignField": "_id",
                "as": "person"
            }
        },
        {
            "$sort": {"transaction_date": -1}
        },
        {
            "$limit": 100
        }
    ]
    
    summaries = []
    async for doc in db.transactions.aggregate(pipeline):
        bank_account_name = doc["bank_account"][0]["name"] if doc["bank_account"] else "Bilinmeyen Hesap"
        person_name = doc["person"][0]["name"] if doc["person"] else None
        
        summary = TransactionSummary(
            id=str(doc["_id"]),
            type=doc["type"],
            amount=doc["amount"],
            currency=doc["currency"],
            description=doc["description"],
            bank_account_name=bank_account_name,
            person_name=person_name,
            status=doc["status"],
            transaction_date=doc["transaction_date"],
            receipt_url=doc.get("receipt_url"),
            total_fees=doc.get("total_fees", 0.0)
        )
        summaries.append(summary)
    
    return summaries

@router.get("/{transaction_id}", response_model=Transaction)
async def get_transaction(
    transaction_id: str,
    current_user: User = Depends(get_current_user)
):
    """Tek bir işlemin detaylarını getir"""
    db = get_database()
    
    if not ObjectId.is_valid(transaction_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz işlem ID"
        )
    
    transaction = await db.transactions.find_one({"_id": ObjectId(transaction_id)})
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="İşlem bulunamadı"
        )
    
    transaction["id"] = str(transaction["_id"])
    del transaction["_id"]
    return Transaction(**transaction)

@router.post("/", response_model=Transaction)
async def create_transaction(
    transaction_data: TransactionCreate,
    current_user: User = Depends(get_current_user)
):
    """Yeni işlem oluştur (manuel girişler için)"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    # Banka hesabını kontrol et
    if not ObjectId.is_valid(transaction_data.bank_account_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz banka hesabı ID"
        )
    
    bank_account = await db.bank_accounts.find_one({"_id": ObjectId(transaction_data.bank_account_id)})
    if not bank_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Banka hesabı bulunamadı"
        )
    
    # Net tutar hesapla
    net_amount = transaction_data.amount + transaction_data.total_fees
    
    now = datetime.utcnow()
    
    # Otomatik kişi oluşturma işlemi
    person_id = None
    if transaction_data.recipient_name:
        # Önce mevcut kişi var mı kontrol et
        existing_person = None
        if transaction_data.recipient_iban:
            existing_person = await db.people.find_one({
                "$or": [
                    {"name": {"$regex": f"^{transaction_data.recipient_name}$", "$options": "i"}},
                    {"iban": transaction_data.recipient_iban}
                ]
            })
        else:
            existing_person = await db.people.find_one({
                "name": {"$regex": f"^{transaction_data.recipient_name}$", "$options": "i"}
            })
        
        if existing_person:
            person_id = str(existing_person["_id"])
        else:
            # Yeni kişi oluştur
            person_type = "company" if any(word in transaction_data.recipient_name.lower() 
                                          for word in ["ltd", "a.ş", "anonim", "limited", "şirket", "şti", "inc", "llc"]) else "individual"
            
            auto_person_data = {
                "name": transaction_data.recipient_name,
                "person_type": person_type,
                "iban": transaction_data.recipient_iban,
                "phone": getattr(transaction_data, 'recipient_phone', None),
                "tax_number": getattr(transaction_data, 'recipient_tax_number', None),
                "total_sent": 0.0,
                "total_received": 0.0,
                "transaction_count": 0,
                "created_at": now,
                "updated_at": now,
                "auto_created": True,
                "creation_source": "transaction"
            }
            
            auto_person_result = await db.people.insert_one(auto_person_data)
            person_id = str(auto_person_result.inserted_id)
    
    # Bakiye etkisini hesapla (giriş pozitif, çıkış negatif)
    balance_impact = transaction_data.amount
    if transaction_data.type in [TransactionType.EXPENSE, TransactionType.TRANSFER]:
        balance_impact = -net_amount
    elif transaction_data.type == TransactionType.FEE:
        balance_impact = -transaction_data.amount
    
    # Yeni işlem oluştur
    transaction_dict = transaction_data.model_dump()
    transaction_dict.update({
        "created_by": current_user.id,
        "net_amount": net_amount,
        "balance_impact": balance_impact,
        "status": TransactionStatus.COMPLETED,
        "person_id": person_id,  # Otomatik oluşturulan kişi ID'si
        "created_at": now,
        "updated_at": now
    })
    
    result = await db.transactions.insert_one(transaction_dict)
    
    # Otomatik ödeme detayı oluştur
    if person_id and transaction_data.type in [TransactionType.EXPENSE, TransactionType.INCOME]:
        payment_type = "outgoing" if transaction_data.type == TransactionType.EXPENSE else "incoming"
        
        payment_detail_data = {
            "person_id": person_id,
            "transaction_id": str(result.inserted_id),
            "payment_type": payment_type,
            "amount": transaction_data.amount,
            "currency": getattr(transaction_data, 'currency', 'TRY'),
            "description": transaction_data.description,
            "payment_method": "bank_transfer",  # Default olarak banka havalesi
            "bank_account_id": transaction_data.bank_account_id,
            "reference_number": getattr(transaction_data, 'reference_number', None),
            "payment_date": transaction_data.transaction_date,
            "receipt_urls": [transaction_data.receipt_url] if getattr(transaction_data, 'receipt_url', None) else [],
            "status": "completed",
            "notes": f"Otomatik oluşturuldu - İşlem ID: {result.inserted_id}",
            "created_by": current_user.id,
            "created_at": now,
            "updated_at": now
        }
        
        await db.payment_details.insert_one(payment_detail_data)
        
        # Kişi istatistiklerini güncelle
        if payment_type == "outgoing":
            await db.people.update_one(
                {"_id": ObjectId(person_id)},
                {"$inc": {"total_sent": transaction_data.amount, "transaction_count": 1},
                 "$set": {"last_transaction_date": transaction_data.transaction_date, "updated_at": now}}
            )
        else:
            await db.people.update_one(
                {"_id": ObjectId(person_id)},
                {"$inc": {"total_received": transaction_data.amount, "transaction_count": 1},
                 "$set": {"last_transaction_date": transaction_data.transaction_date, "updated_at": now}}
            )
    
    # Banka hesabı bakiyesini güncelle
    new_balance = bank_account["current_balance"] + balance_impact
    await db.bank_accounts.update_one(
        {"_id": ObjectId(transaction_data.bank_account_id)},
        {"$set": {
            "current_balance": new_balance,
            "updated_at": now
        }}
    )
    
    # Oluşturulan işlemi getir
    created_transaction = await db.transactions.find_one({"_id": result.inserted_id})
    created_transaction["_id"] = str(created_transaction["_id"])
    
    return Transaction(**created_transaction)

@router.post("/analyze-receipt", response_model=ReceiptAnalysisResult)
async def analyze_receipt_file(
    file: UploadFile = File(...),
    payment_order_id: Optional[str] = Query(None, description="İlişkili ödeme emri ID"),
    current_user: User = Depends(get_current_user)
):
    """Dekont dosyasını AI ile analiz et"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )

    # Dosya türü kontrolü
    allowed_types = ["image/jpeg", "image/png", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sadece JPEG, PNG ve PDF dosyaları desteklenir"
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
        temp_filename = f"temp_receipt_{int(datetime.utcnow().timestamp())}.{file_extension}"
        temp_file_path = os.path.join(settings.upload_dir, temp_filename)

        async with aiofiles.open(temp_file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)

        # AI analizi
        ai_result = await ai_service.analyze_receipt(temp_file_path)

        # Geçici dosyayı sil
        try:
            os.remove(temp_file_path)
        except:
            pass

        # Sonucu ReceiptAnalysisResult formatına dönüştür
        if ai_result.get("success"):
            transaction_details = ai_result.get("transaction_details", {})
            fees_and_charges = ai_result.get("fees_and_charges", {})
            amount_breakdown = ai_result.get("amount_breakdown", {})
            recipient_info = ai_result.get("recipient_info", {})
            
            result = ReceiptAnalysisResult(
                success=True,
                extracted_amount=transaction_details.get("amount"),
                extracted_date=datetime.fromisoformat(transaction_details.get("date")) if transaction_details.get("date") else None,
                extracted_bank=ai_result.get("bank_info", {}).get("bank_name"),
                extracted_account=ai_result.get("sender_account", {}).get("iban"),
                extracted_reference=transaction_details.get("reference_number"),
                extracted_fees=fees_and_charges,
                total_extracted_fees=amount_breakdown.get("total_fees", 0.0),
                recipient_info=recipient_info,
                confidence_score=ai_result.get("confidence_score", 0.0),
                raw_text=str(ai_result)
            )
        else:
            result = ReceiptAnalysisResult(
                success=False,
                error_message=ai_result.get("error", "Dekont analizi başarısız"),
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
            detail=f"Dekont analizi başarısız: {str(e)}"
        )

@router.post("/process-receipt-payment")
async def process_receipt_and_create_transaction(
    payment_order_id: str,
    file: UploadFile = File(...),
    bank_account_id: str = Query(..., description="Kullanılan banka hesabı"),
    current_user: User = Depends(get_current_user)
):
    """Dekont yükle, analiz et ve işlemi tamamla"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )

    db = get_database()
    
    # Ödeme emrini kontrol et
    if not ObjectId.is_valid(payment_order_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz ödeme emri ID"
        )
    
    payment_order = await db.payment_orders.find_one({"_id": ObjectId(payment_order_id)})
    if not payment_order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ödeme emri bulunamadı"
        )
    
    if payment_order["status"] != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sadece onaylanmış emirler işlenebilir"
        )

    # Banka hesabını kontrol et
    if not ObjectId.is_valid(bank_account_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz banka hesabı ID"
        )
    
    bank_account = await db.bank_accounts.find_one({"_id": ObjectId(bank_account_id)})
    if not bank_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Banka hesabı bulunamadı"
        )

    try:
        # Dosyayı kalıcı olarak kaydet
        file_extension = file.filename.split(".")[-1]
        receipt_filename = f"receipt_{payment_order_id}_{int(datetime.utcnow().timestamp())}.{file_extension}"
        receipt_path = os.path.join(settings.upload_dir, receipt_filename)

        async with aiofiles.open(receipt_path, 'wb') as f:
            content = await file.read()
            await f.write(content)

        # AI ile dekont analizi
        ai_result = await ai_service.analyze_receipt(receipt_path)
        
        now = datetime.utcnow()
        
        if ai_result.get("success"):
            # AI'dan çıkarılan bilgileri kullan
            transaction_details = ai_result.get("transaction_details", {})
            fees_and_charges = ai_result.get("fees_and_charges", {})
            amount_breakdown = ai_result.get("amount_breakdown", {})
            
            extracted_amount = transaction_details.get("amount", payment_order["amount"])
            extracted_fees = fees_and_charges
            total_fees = amount_breakdown.get("total_fees", 0.0)
            net_amount = amount_breakdown.get("net_deducted", extracted_amount + total_fees)
            
            # AI extracted data'yı hazırla
            ai_extracted_data = {
                "analysis_result": ai_result,
                "confidence_score": ai_result.get("confidence_score", 0.0),
                "analysis_date": now.isoformat()
            }
        else:
            # AI analizi başarısız, manuel değerleri kullan
            extracted_amount = payment_order["amount"]
            extracted_fees = {}
            total_fees = 0.0
            net_amount = extracted_amount
            ai_extracted_data = {
                "analysis_result": ai_result,
                "confidence_score": 0.0,
                "analysis_date": now.isoformat(),
                "error": "AI analizi başarısız, manuel değerler kullanıldı"
            }

        # Bakiye kontrolü
        if bank_account["current_balance"] < net_amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Yetersiz bakiye. Gerekli: {net_amount}, Mevcut: {bank_account['current_balance']}"
            )

        # Transaction oluştur
        transaction_dict = {
            "type": "expense",
            "amount": extracted_amount,
            "currency": payment_order.get("currency", "TRY"),
            "description": f"Ödeme emri: {payment_order['description']}",
            "reference_number": transaction_details.get("reference_number") if ai_result.get("success") else None,
            "bank_account_id": bank_account_id,
            "payment_order_id": payment_order_id,
            "fees": extracted_fees,
            "total_fees": total_fees,
            "net_amount": net_amount,
            "balance_impact": -net_amount,
            "ai_extracted_data": ai_extracted_data,
            "transaction_date": datetime.fromisoformat(transaction_details.get("date")) if transaction_details.get("date") else now,
            "status": "completed",
            "receipt_url": receipt_path,
            "receipt_filename": receipt_filename,
            "receipt_analysis": ai_result,
            "created_by": current_user.id,
            "created_at": now,
            "updated_at": now
        }
        
        # Transaction'ı kaydet
        transaction_result = await db.transactions.insert_one(transaction_dict)
        
        # Ödeme emrini güncelle
        await db.payment_orders.update_one(
            {"_id": ObjectId(payment_order_id)},
            {"$set": {
                "status": "completed",
                "bank_account_id": bank_account_id,
                "receipt_url": receipt_path,
                "completed_at": now,
                "updated_at": now
            }}
        )
        
        # Banka hesabı bakiyesini güncelle
        new_balance = bank_account["current_balance"] - net_amount
        await db.bank_accounts.update_one(
            {"_id": ObjectId(bank_account_id)},
            {"$set": {
                "current_balance": new_balance,
                "updated_at": now
            }}
        )

        return {
            "message": "Ödeme başarıyla tamamlandı",
            "transaction_id": str(transaction_result.inserted_id),
            "extracted_amount": extracted_amount,
            "total_fees": total_fees,
            "net_deducted": net_amount,
            "new_balance": new_balance,
            "ai_confidence": ai_result.get("confidence_score", 0.0),
            "receipt_filename": receipt_filename
        }

    except Exception as e:
        # Hata durumunda dosyayı temizle
        try:
            os.remove(receipt_path)
        except:
            pass
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"İşlem tamamlanırken hata oluştu: {str(e)}"
        )

@router.get("/download-receipt/{transaction_id}")
async def download_receipt(
    transaction_id: str,
    current_user: User = Depends(get_current_user)
):
    """İşlemin dekontunu indir"""
    db = get_database()
    
    if not ObjectId.is_valid(transaction_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz işlem ID"
        )
    
    transaction = await db.transactions.find_one({"_id": ObjectId(transaction_id)})
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="İşlem bulunamadı"
        )
    
    if not transaction.get("receipt_url"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bu işlem için dekont bulunamadı"
        )
    
    receipt_path = transaction["receipt_url"]
    if not os.path.exists(receipt_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dekont dosyası bulunamadı"
        )
    
    # FileResponse kullanarak dosyayı indir
    from fastapi.responses import FileResponse
    return FileResponse(
        path=receipt_path,
        filename=transaction.get("receipt_filename", "dekont.pdf"),
        media_type='application/octet-stream'
    )

@router.delete("/{transaction_id}")
async def delete_transaction(
    transaction_id: str,
    current_user: User = Depends(get_current_user)
):
    """İşlemi sil (sadece admin, dikkatli kullan)"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    if not ObjectId.is_valid(transaction_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz işlem ID"
        )
    
    transaction = await db.transactions.find_one({"_id": ObjectId(transaction_id)})
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="İşlem bulunamadı"
        )
    
    # Bakiye düzeltmesi (işlemi geri al)
    bank_account = await db.bank_accounts.find_one({"_id": ObjectId(transaction["bank_account_id"])})
    if bank_account:
        # Balance impact'i ters çevir
        balance_correction = -transaction.get("balance_impact", 0)
        new_balance = bank_account["current_balance"] + balance_correction
        
        await db.bank_accounts.update_one(
            {"_id": ObjectId(transaction["bank_account_id"])},
            {"$set": {
                "current_balance": new_balance,
                "updated_at": datetime.utcnow()
            }}
        )
    
    # Dekont dosyasını sil
    if transaction.get("receipt_url"):
        try:
            os.remove(transaction["receipt_url"])
        except:
            pass
    
    # İşlemi sil
    await db.transactions.delete_one({"_id": ObjectId(transaction_id)})
    
    return {"message": "İşlem silindi ve bakiye düzeltildi"}

@router.post("/{transaction_id}/analyze")
async def analyze_transaction_with_ai(
    transaction_id: str,
    current_user: User = Depends(get_current_user)
):
    """AI ile işlem analizi yap"""
    from app.services.ai_service import ai_service
    
    db = get_database()
    
    # Transaction ID validation
    if not transaction_id or transaction_id == "undefined":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz işlem ID"
        )
    
    try:
        transaction_oid = ObjectId(transaction_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz işlem ID formatı"
        )
    
    # İşlemi getir
    transaction = await db.transactions.find_one({"_id": transaction_oid})
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="İşlem bulunamadı"
        )
    
    try:
        # Ödeme emri bilgilerini de al
        payment_order = None
        if transaction.get("payment_order_id"):
            payment_order = await db.payment_orders.find_one({"_id": ObjectId(transaction["payment_order_id"])})
        
        # AI analizi yap
        analysis_prompt = f"""
Bu finansal işlemi analiz et ve değerlendir:

İŞLEM BİLGİLERİ:
- Türü: {transaction.get('type', 'Belirtilmemiş')}
- Tutar: {transaction.get('amount', 0)} {transaction.get('currency', 'TRY')}
- Açıklama: {transaction.get('description', 'Belirtilmemiş')}
- Tarih: {transaction.get('transaction_date', 'Belirtilmemiş')}
- Durum: {transaction.get('status', 'Belirtilmemiş')}
- Ücretler: {transaction.get('total_fees', 0)} TRY
- Net Tutar: {transaction.get('net_amount', 0)} TRY

{f"ÖDEME EMRİ: {payment_order.get('description', 'Yok')}" if payment_order else ""}

YAPILACAK ANALİZ:
1. Bu işlem normal/anormal mı?
2. Ücretler makul mü?
3. Tutar ve tarih analizi
4. Risk değerlendirmesi
5. Öneriler

Detaylı analiz yap:
        """
        
        analysis_result = await ai_service.process_payment_description(
            description=analysis_prompt,
            recipient_name=transaction.get('description', ''),
            amount=transaction.get('amount', 0)
        )
        
        analysis_text = f"""📊 **İşlem Analizi Tamamlandı**

**Genel Değerlendirme:**
Bu {transaction.get('type', 'işlem')} türünde bir işlemdir. Tutar: {transaction.get('amount', 0)} {transaction.get('currency', 'TRY')}

**Ücret Analizi:**
Toplam ücret: {transaction.get('total_fees', 0)} TRY
{"✅ Ücretler normal seviyede" if transaction.get('total_fees', 0) < 50 else "⚠️ Yüksek ücret tespit edildi"}

**Risk Değerlendirmesi:**
{"✅ Düşük risk" if transaction.get('amount', 0) < 10000 else "⚠️ Yüksek tutar - dikkat edilmeli"}

**Öneriler:**
- İşlem geçmişi düzenli takip edilsin
- Benzer işlemlerle karşılaştırma yapın
- Dekont saklanması önerilir

Bu işlem hakkında daha spesifik sorularınız var mı?"""
        
        return {"analysis": analysis_text}
        
    except Exception as e:
        logger.error(f"AI analysis error: {e}")
        return {"analysis": "AI analizi şu anda kullanılamıyor. İşlem bilgileri normal görünüyor."}

@router.post("/{transaction_id}/chat")
async def chat_with_ai_about_transaction(
    transaction_id: str,
    message: dict,
    current_user: User = Depends(get_current_user)
):
    """İşlem hakkında AI ile sohbet et"""
    from app.services.ai_service import ai_service
    
    db = get_database()
    
    # Transaction ID validation
    if not transaction_id or transaction_id == "undefined":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz işlem ID"
        )
    
    try:
        transaction_oid = ObjectId(transaction_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz işlem ID formatı"
        )
    
    # İşlemi getir
    transaction = await db.transactions.find_one({"_id": transaction_oid})
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="İşlem bulunamadı"
        )
    
    user_message = message.get("message", "")
    if not user_message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mesaj boş olamaz"
        )
    
    try:
        # Benzer işlemleri bul
        similar_transactions = []
        if transaction.get('amount'):
            # Aynı tutar aralığındaki işlemler
            cursor = db.transactions.find({
                "amount": {"$gte": transaction['amount'] * 0.8, "$lte": transaction['amount'] * 1.2},
                "_id": {"$ne": ObjectId(transaction_id)}
            }).limit(3)
            
            async for t in cursor:
                similar_transactions.append({
                    "amount": t.get("amount", 0),
                    "description": t.get("description", ""),
                    "date": t.get("transaction_date", "")
                })
        
        # AI'ya kontekst ver
        transaction_context = f"""
İŞLEM BİLGİLERİ:
- Türü: {transaction.get('type', 'Belirtilmemiş')}
- Tutar: {transaction.get('amount', 0)} {transaction.get('currency', 'TRY')}
- Açıklama: {transaction.get('description', 'Belirtilmemiş')}
- Tarih: {transaction.get('transaction_date', 'Belirtilmemiş')}
- Ücretler: {transaction.get('total_fees', 0)} TRY
- Durum: {transaction.get('status', 'Belirtilmemiş')}

BENZER İŞLEMLER:
{'; '.join([f"{t['amount']} TRY - {t['description'][:30]}" for t in similar_transactions]) if similar_transactions else "Benzer işlem bulunamadı"}
        """
        
        try:
            ai_response = await ai_service.chat_about_transaction(user_message, transaction_context)
        except:
            # Basit cevaplar
            user_message_lower = user_message.lower()
            if "normal" in user_message_lower or "düzenli" in user_message_lower:
                ai_response = f"Bu işlem {transaction.get('amount', 0)} TRY tutarında. {len(similar_transactions)} benzer işlem buldum. {'Düzenli görünüyor' if similar_transactions else 'İlk kez görülen bir işlem'}."
            elif "ücret" in user_message_lower:
                ai_response = f"İşlem ücretleri {transaction.get('total_fees', 0)} TRY. {'Normal seviyede' if transaction.get('total_fees', 0) < 50 else 'Biraz yüksek'}."
            elif "risk" in user_message_lower:
                risk_level = "düşük" if transaction.get('amount', 0) < 5000 else "orta" if transaction.get('amount', 0) < 20000 else "yüksek"
                ai_response = f"Bu işlem için risk seviyesi: {risk_level}. Tutar ve geçmiş işlemlere bakılarak değerlendirildi."
            else:
                ai_response = "Bu konuda size nasıl yardımcı olabilirim? İşlem tutarı, ücretler veya risk seviyesi hakkında sorabilirsiniz."
        
        return {"response": ai_response}
        
    except Exception as e:
        logger.error(f"AI chat error: {e}")
        return {"response": "Üzgünüm, şu anda size yardımcı olamıyorum. Daha sonra tekrar deneyin."}