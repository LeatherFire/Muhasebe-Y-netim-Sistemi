from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile, Form
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import os
import aiofiles
import logging

logger = logging.getLogger(__name__)

from app.models.payment_order import (
    PaymentOrder,
    PaymentOrderCreate,
    PaymentOrderUpdate,
    PaymentOrderSummary,
    PaymentStatus,
    PaymentCategory
)
from app.models.user import User
from app.api.routes.auth import get_current_user, get_admin_user, get_user_or_admin
from app.core.database import get_database
from app.core.config import settings
from app.services.ai_service import ai_service
from app.core.errors import (
    StandardErrors, 
    validate_object_id, 
    validate_admin_role,
    validate_file_size,
    validate_file_type,
    sanitize_filename,
    validate_file_content,
    raise_not_found,
    raise_forbidden,
    raise_bad_request,
    raise_conflict
)

router = APIRouter()

@router.get("/test-ai")
async def test_ai_service():
    """AI servisinin çalışıp çalışmadığını test et"""
    try:
        # Basit bir test
        test_result = {
            "ai_service_available": ai_service.model is not None,
            "vision_model_available": ai_service.vision_model is not None,
            "gemini_configured": hasattr(ai_service, 'model')
        }
        return test_result
    except Exception as e:
        return {
            "error": str(e),
            "ai_service_available": False
        }

@router.get("/", response_model=List[PaymentOrder])
async def get_payment_orders(
    status_filter: Optional[PaymentStatus] = Query(None, description="Duruma göre filtrele"),
    category: Optional[PaymentCategory] = Query(None, description="Kategoriye göre filtrele"),
    limit: int = Query(50, le=100, description="Maksimum kayıt sayısı"),
    skip: int = Query(0, ge=0, description="Atlanacak kayıt sayısı"),
    current_user: User = Depends(get_current_user)
):
    """Ödeme emirlerini listele"""
    db = get_database()
    
    # Filtre oluştur
    filter_query = {}
    if status_filter:
        filter_query["status"] = status_filter
    if category:
        filter_query["category"] = category
    
    # Kullanıcı rolüne göre filtreleme
    if current_user.role == "user":
        filter_query["created_by"] = current_user.id
    
    orders = []
    cursor = db.payment_orders.find(filter_query).sort("created_at", -1).skip(skip).limit(limit)
    
    async for order in cursor:
        order["_id"] = str(order["_id"])
        orders.append(PaymentOrder(**order))
    
    return orders

@router.get("/summary", response_model=List[PaymentOrderSummary])
async def get_payment_orders_summary(
    current_user: User = Depends(get_current_user)
):
    """Ödeme emirlerinin özet bilgilerini getir"""
    db = get_database()
    
    filter_query = {}
    if current_user.role == "user":
        filter_query["created_by"] = current_user.id
    
    orders = []
    cursor = db.payment_orders.find(filter_query).sort("created_at", -1)
    
    async for order in cursor:
        summary = PaymentOrderSummary(
            id=str(order["_id"]),
            recipient_name=order["recipient_name"],
            amount=order["amount"],
            currency=order["currency"],
            status=order["status"],
            category=order.get("category"),
            created_at=order["created_at"],
            due_date=order.get("due_date")
        )
        orders.append(summary)
    
    return orders

@router.get("/pending", response_model=List[PaymentOrder])
async def get_pending_payment_orders(
    current_user: User = Depends(get_current_user)
):
    """Bekleyen ödeme emirlerini getir (admin için)"""
    validate_admin_role(current_user.role)
    
    db = get_database()
    orders = []
    
    cursor = db.payment_orders.find({"status": PaymentStatus.PENDING}).sort("created_at", 1)
    
    async for order in cursor:
        order["_id"] = str(order["_id"])
        orders.append(PaymentOrder(**order))
    
    return orders

@router.get("/{order_id}", response_model=PaymentOrder)
async def get_payment_order(
    order_id: str,
    current_user: User = Depends(get_current_user)
):
    """Tek bir ödeme emrinin detaylarını getir"""
    db = get_database()
    
    validate_object_id(order_id, StandardErrors.INVALID_OBJECT_ID)
    
    order = await db.payment_orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ödeme emri bulunamadı"
        )
    
    # Kullanıcı sadece kendi emirlerini görebilir (admin hariç)
    if current_user.role == "user" and order["created_by"] != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu emre erişim yetkiniz yok"
        )
    
    order["_id"] = str(order["_id"])
    return PaymentOrder(**order)

@router.post("/admin-direct", response_model=PaymentOrder)
async def create_direct_payment_order(
    order_data: PaymentOrderCreate,
    current_user: User = Depends(get_admin_user)
):
    """Admin tarafından direkt onaylanmış ödeme emri oluştur"""
    db = get_database()
    
    # IBAN formatını basit kontrol et
    if len(order_data.recipient_iban) < 26:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz IBAN formatı"
        )
    
    # AI ile açıklama işleme (şimdilik bypass)
    processed_description = order_data.description
    suggested_category = order_data.category
    
    # Admin tarafından oluşturulan emirler otomatik onaylanır
    now = datetime.utcnow()
    order_dict = order_data.model_dump()
    order_dict.update({
        "created_by": current_user.id,
        "created_at": now,
        "updated_at": now,
        "status": PaymentStatus.APPROVED,  # Direkt onaylanmış
        "approved_at": now,
        "approved_by": current_user.id,
        "processed_description": processed_description,
        "ai_suggested_category": suggested_category,
        "category": suggested_category  # AI önerisini kullan
    })
    
    result = await db.payment_orders.insert_one(order_dict)
    order_dict["_id"] = str(result.inserted_id)
    
    return PaymentOrder(**order_dict)

@router.post("/", response_model=PaymentOrder)
async def create_payment_order(
    order_data: PaymentOrderCreate,
    current_user: User = Depends(get_current_user)
):
    """Yeni ödeme emri oluştur"""
    db = get_database()
    
    # IBAN formatını basit kontrol et
    if len(order_data.recipient_iban) < 26:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz IBAN formatı"
        )
    
    # due_date handling - empty string to None
    if hasattr(order_data, 'due_date') and order_data.due_date == "":
        order_data.due_date = None
    
    # Yeni ödeme emri oluştur
    now = datetime.utcnow()
    order_dict = order_data.model_dump()
    
    # Admin kullanıcılar için direkt approved durumunda oluştur
    initial_status = PaymentStatus.APPROVED if current_user.role == "admin" else PaymentStatus.PENDING
    
    order_dict.update({
        "created_by": current_user.id,
        "status": initial_status,
        "created_at": now,
        "updated_at": now
    })
    
    # Admin ise onay bilgilerini de ekle
    if current_user.role == "admin":
        order_dict.update({
            "approved_at": now,
            "approved_by": current_user.id
        })
    
    result = await db.payment_orders.insert_one(order_dict)
    
    # Oluşturulan emri getir
    created_order = await db.payment_orders.find_one({"_id": result.inserted_id})
    created_order["_id"] = str(created_order["_id"])
    
    # AI ile açıklama işleme gönder (async olarak)
    try:
        ai_result = await ai_service.process_payment_description(
            description=order_data.description,
            recipient_name=order_data.recipient_name,
            amount=order_data.amount
        )
        
        # AI sonuçlarını kaydet
        await db.payment_orders.update_one(
            {"_id": result.inserted_id},
            {"$set": {
                "ai_processed_description": ai_result.get("processed_description"),
                "ai_suggested_category": ai_result.get("suggested_category"),
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Güncellenmiş emri getir
        created_order = await db.payment_orders.find_one({"_id": result.inserted_id})
        created_order["_id"] = str(created_order["_id"])
        
    except Exception as e:
        # AI işlemi başarısız olursa log'la ama emri döndür
        print(f"AI processing failed: {e}")
    
    return PaymentOrder(**created_order)

@router.put("/{order_id}", response_model=PaymentOrder)
async def update_payment_order(
    order_id: str,
    order_data: PaymentOrderUpdate,
    current_user: User = Depends(get_current_user)
):
    """Ödeme emrini güncelle"""
    db = get_database()
    
    validate_object_id(order_id, StandardErrors.INVALID_OBJECT_ID)
    
    order = await db.payment_orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ödeme emri bulunamadı"
        )
    
    # Yetki kontrolü
    if current_user.role == "user":
        if order["created_by"] != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bu emri güncelleyemezsiniz"
            )
        if order["status"] != PaymentStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sadece bekleyen emirler güncellenebilir"
            )
    
    # Güncelleme verilerini hazırla
    update_data = {k: v for k, v in order_data.model_dump().items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await db.payment_orders.update_one(
            {"_id": ObjectId(order_id)},
            {"$set": update_data}
        )
    
    # Güncellenmiş emri getir
    updated_order = await db.payment_orders.find_one({"_id": ObjectId(order_id)})
    updated_order["_id"] = str(updated_order["_id"])
    
    return PaymentOrder(**updated_order)

@router.post("/{order_id}/approve")
async def approve_payment_order(
    order_id: str,
    current_user: User = Depends(get_admin_user)
):
    """Ödeme emrini onayla (sadece admin)"""
    
    db = get_database()
    
    validate_object_id(order_id, StandardErrors.INVALID_OBJECT_ID)
    
    order = await db.payment_orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ödeme emri bulunamadı"
        )
    
    if order["status"] != PaymentStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sadece bekleyen emirler onaylanabilir"
        )
    
    await db.payment_orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {
            "status": PaymentStatus.APPROVED,
            "approved_by": current_user.id,
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {"message": "Ödeme emri onaylandı"}

@router.post("/{order_id}/reject")
async def reject_payment_order(
    order_id: str,
    reason: str,
    current_user: User = Depends(get_admin_user)
):
    """Ödeme emrini reddet (sadece admin)"""
    
    db = get_database()
    
    validate_object_id(order_id, StandardErrors.INVALID_OBJECT_ID)
    
    order = await db.payment_orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ödeme emri bulunamadı"
        )
    
    if order["status"] not in [PaymentStatus.PENDING, PaymentStatus.APPROVED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu durumdaki emir reddedilemez"
        )
    
    await db.payment_orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {
            "status": PaymentStatus.REJECTED,
            "rejection_reason": reason,
            "approved_by": current_user.id,
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {"message": "Ödeme emri reddedildi"}

@router.post("/{order_id}/complete")
async def complete_payment_order(
    order_id: str,
    bank_account_id: str,
    current_user: User = Depends(get_admin_user)
):
    """Ödeme emrini tamamla (sadece admin)"""
    
    db = get_database()
    
    validate_object_id(order_id, StandardErrors.INVALID_OBJECT_ID)
    
    order = await db.payment_orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ödeme emri bulunamadı"
        )
    
    if order["status"] != PaymentStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sadece onaylanmış emirler tamamlanabilir"
        )
    
    # Banka hesabını kontrol et
    validate_object_id(bank_account_id, StandardErrors.ACCOUNT_NOT_FOUND)
    
    bank_account = await db.bank_accounts.find_one({"_id": ObjectId(bank_account_id)})
    if not bank_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Banka hesabı bulunamadı"
        )
    
    # Bakiye kontrolü
    if bank_account["current_balance"] < order["amount"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Yetersiz bakiye"
        )
    
    # İşlemi tamamla
    now = datetime.utcnow()
    
    # Ödeme emrini güncelle
    await db.payment_orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {
            "status": PaymentStatus.COMPLETED,
            "bank_account_id": bank_account_id,
            "completed_at": now,
            "updated_at": now
        }}
    )
    
    # Banka hesabı bakiyesini güncelle
    new_balance = bank_account["current_balance"] - order["amount"]
    await db.bank_accounts.update_one(
        {"_id": ObjectId(bank_account_id)},
        {"$set": {
            "current_balance": new_balance,
            "updated_at": now
        }}
    )
    
    # Transaction kaydı oluştur
    from app.models.transaction import TransactionCreate, TransactionType, TransactionStatus
    
    transaction_data = TransactionCreate(
        type=TransactionType.EXPENSE,
        amount=order["amount"],
        currency=order["currency"],
        description=f"Ödeme Emri: {order['description']} - {order['recipient_name']}",
        reference_number=order.get("reference_number"),
        bank_account_id=bank_account_id,
        payment_order_id=order_id,
        person_id=order.get("person_id"),
        total_fees=0.0,
        transaction_date=now
    )
    
    # Net tutarı hesapla (expense için negatif)
    net_amount = -float(order["amount"])
    balance_impact = net_amount
    
    transaction_dict = transaction_data.model_dump()
    transaction_dict.update({
        "status": TransactionStatus.COMPLETED,
        "net_amount": net_amount,
        "balance_impact": balance_impact,
        "receipt_url": order.get("receipt_url"),
        "created_by": current_user.id,
        "created_at": now,
        "updated_at": now
    })
    
    transaction_result = await db.transactions.insert_one(transaction_dict)
    
    # Kişi/kurum ödeme detayı ekle (eğer kişi ID varsa)
    if order.get("person_id"):
        from app.models.payment_detail import PaymentDetailCreate
        
        payment_detail_data = PaymentDetailCreate(
            person_id=order["person_id"],
            payment_type="outgoing",
            amount=order["amount"],
            currency=order["currency"],
            description=f"Ödeme Emri: {order['description']}",
            payment_date=now.isoformat(),
            bank_account_id=bank_account_id,
            transaction_id=str(transaction_result.inserted_id),
            payment_order_id=order_id,
            receipt_urls=[order.get("receipt_url")] if order.get("receipt_url") else []
        )
        
        payment_detail_dict = payment_detail_data.model_dump()
        payment_detail_dict.update({
            "created_by": current_user.id,
            "created_at": now,
            "updated_at": now
        })
        
        await db.payment_details.insert_one(payment_detail_dict)
    
    return {
        "message": "Ödeme tamamlandı", 
        "new_balance": new_balance,
        "transaction_id": str(transaction_result.inserted_id)
    }

@router.post("/{order_id}/verify-payment")
async def verify_payment_receipt(
    order_id: str,
    bank_account_id: str = Form(...),
    receipt_file: UploadFile = File(...),
    current_user: User = Depends(get_admin_user)
):
    """Dekont yükleyerek ödeme emrini AI ile doğrula (ilk aşama)"""
    db = get_database()
    
    validate_object_id(order_id, StandardErrors.INVALID_OBJECT_ID)
    
    # Ödeme emrini kontrol et
    order = await db.payment_orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ödeme emri bulunamadı"
        )
    
    # Admin kullanıcılar pending ve approved emirleri doğrulayabilir
    if order["status"] not in [PaymentStatus.PENDING, PaymentStatus.APPROVED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sadece bekleyen veya onaylanmış emirler doğrulanabilir"
        )
    
    # Banka hesabını kontrol et
    validate_object_id(bank_account_id, StandardErrors.ACCOUNT_NOT_FOUND)
    
    bank_account = await db.bank_accounts.find_one({"_id": ObjectId(bank_account_id)})
    if not bank_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Banka hesabı bulunamadı"
        )
    
    # Dosya kontrolü - Geçici olarak sadece resim dosyaları
    allowed_types = ["image/jpeg", "image/png", "image/jpg"]
    if receipt_file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Şu anda sadece JPG ve PNG dosyaları desteklenmektedir"
        )
    
    # Dosya boyutu kontrolü (10MB)
    if receipt_file.size > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dosya boyutu 10MB'dan büyük olamaz"
        )
    
    try:
        # Geçici dosyayı kaydet
        file_extension = receipt_file.filename.split(".")[-1]
        temp_filename = f"temp_receipt_{order_id}_{int(datetime.utcnow().timestamp())}.{file_extension}"
        temp_file_path = os.path.join("uploads/temp", temp_filename)
        
        # Klasörü oluştur
        os.makedirs(os.path.dirname(temp_file_path), exist_ok=True)
        
        async with aiofiles.open(temp_file_path, 'wb') as f:
            content = await receipt_file.read()
            await f.write(content)
        
        # AI ile dekont doğrulama
        try:
            verification_result = await ai_service.verify_payment_receipt(temp_file_path, order)
            
            if not verification_result.get("success", False):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"AI doğrulama başarısız: {verification_result.get('error', 'Bilinmeyen hata')}"
                )
            
            # Bakiye kontrolü
            total_deducted = verification_result.get("amount_summary", {}).get("total_deducted", order["amount"])
            if bank_account["current_balance"] < total_deducted:
                verification_result["insufficient_balance"] = True
                verification_result["required_amount"] = total_deducted
                verification_result["available_balance"] = bank_account["current_balance"]
                verification_result["recommendation"] = "REJECT"
                
                # anomalies array'ini kontrol et ve gerekirse oluştur
                if "anomalies" not in verification_result:
                    verification_result["anomalies"] = []
                verification_result["anomalies"].append(
                    f"Yetersiz bakiye: Gerekli {total_deducted} TRY, Mevcut {bank_account['current_balance']} TRY"
                )
            else:
                verification_result["insufficient_balance"] = False
            
            # Geçici dosya bilgisini sonuca ekle
            verification_result["temp_file_path"] = temp_file_path
            verification_result["bank_account_info"] = {
                "id": str(bank_account["_id"]),
                "name": bank_account["name"],
                "current_balance": bank_account["current_balance"]
            }
            
            return verification_result
            
        except Exception as ai_error:
            # Geçici dosyayı sil
            if os.path.exists(temp_file_path):
                try:
                    os.remove(temp_file_path)
                except:
                    pass
            
            logger.error(f"AI verification error: {ai_error}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"AI doğrulama hatası: {str(ai_error)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Doğrulama işlemi sırasında hata: {str(e)}"
        )

@router.post("/{order_id}/confirm-payment")
async def confirm_payment_after_verification(
    order_id: str,
    temp_file_path: str = Form(...),
    bank_account_id: str = Form(...),
    current_user: User = Depends(get_admin_user)
):
    """Doğrulama sonrası ödemeyi kesin olarak işle (ikinci aşama)"""
    db = get_database()
    
    validate_object_id(order_id, StandardErrors.INVALID_OBJECT_ID)
    
    # Ödeme emrini kontrol et
    order = await db.payment_orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ödeme emri bulunamadı"
        )
    
    # Geçici dosyanın varlığını kontrol et
    if not os.path.exists(temp_file_path):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçici dosya bulunamadı, lütfen doğrulama işlemini tekrar yapın"
        )
    
    # Banka hesabını kontrol et
    validate_object_id(bank_account_id, StandardErrors.ACCOUNT_NOT_FOUND)
    
    bank_account = await db.bank_accounts.find_one({"_id": ObjectId(bank_account_id)})
    if not bank_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Banka hesabı bulunamadı"
        )
    
    try:
        # AI doğrulamayı tekrar yap (güvenlik için)
        verification_result = await ai_service.verify_payment_receipt(temp_file_path, order)
        
        if not verification_result.get("success", False):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Doğrulama başarısız, işlem iptal edildi"
            )
        
        # Kalıcı dosya yolu oluştur
        file_extension = temp_file_path.split(".")[-1]
        final_filename = f"payment_receipt_{order_id}_{int(datetime.utcnow().timestamp())}.{file_extension}"
        final_file_path = os.path.join("uploads/payment_receipts", final_filename)
        
        # Klasörü oluştur ve dosyayı taşı
        os.makedirs(os.path.dirname(final_file_path), exist_ok=True)
        os.rename(temp_file_path, final_file_path)
        
        # İşlem tutarlarını al
        amount_summary = verification_result.get("amount_summary", {})
        actual_amount = amount_summary.get("actual_transfer", order["amount"])
        total_fees = amount_summary.get("total_fees", 0.0)
        total_deducted = amount_summary.get("total_deducted", actual_amount + total_fees)
        
        # Son bakiye kontrolü
        if bank_account["current_balance"] < total_deducted:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Yetersiz bakiye. Gerekli: {total_deducted} TRY, Mevcut: {bank_account['current_balance']} TRY"
            )
        
        now = datetime.utcnow()
        
        # Ödeme emrini güncelle
        await db.payment_orders.update_one(
            {"_id": ObjectId(order_id)},
            {"$set": {
                "status": PaymentStatus.COMPLETED,
                "bank_account_id": bank_account_id,
                "receipt_url": final_file_path,
                "ai_verification": verification_result,
                "actual_amount": actual_amount,
                "total_fees": total_fees,
                "net_amount_deducted": total_deducted,
                "completed_at": now,
                "completed_by": current_user.id,
                "updated_at": now
            }}
        )
        
        # Banka hesabı bakiyesini güncelle
        new_balance = bank_account["current_balance"] - total_deducted
        await db.bank_accounts.update_one(
            {"_id": ObjectId(bank_account_id)},
            {"$set": {
                "current_balance": new_balance,
                "updated_at": now
            }}
        )
        
        # Transaction kaydı oluştur
        from app.models.transaction import TransactionCreate, TransactionType, TransactionStatus
        
        transaction_description = f"Ödeme Emri (AI Doğrulamalı): {order['description']} - {order['recipient_name']}"
        if verification_result.get("analysis_notes"):
            transaction_description += f" | {verification_result['analysis_notes']}"
        
        transaction_data = TransactionCreate(
            type=TransactionType.EXPENSE,
            amount=actual_amount,
            currency=order["currency"],
            description=transaction_description,
            reference_number=verification_result.get("extracted_data", {}).get("reference_number"),
            bank_account_id=bank_account_id,
            payment_order_id=order_id,
            person_id=order.get("person_id"),
            total_fees=total_fees,
            transaction_date=now
        )
        
        # Net tutarı hesapla (expense için negatif)
        net_amount = -float(total_deducted)
        balance_impact = net_amount
        
        transaction_dict = transaction_data.model_dump()
        transaction_dict.update({
            "status": TransactionStatus.COMPLETED,
            "net_amount": net_amount,
            "balance_impact": balance_impact,
            "receipt_url": final_file_path,
            "ai_verification": verification_result,
            "created_by": current_user.id,
            "created_at": now,
            "updated_at": now
        })
        
        transaction_result = await db.transactions.insert_one(transaction_dict)
        
        return {
            "message": "Ödeme AI doğrulaması ile başarıyla tamamlandı",
            "order_id": order_id,
            "verification_summary": {
                "is_valid": verification_result.get("verification_result", {}).get("is_valid"),
                "recommendation": verification_result.get("recommendation"),
                "actual_amount": actual_amount,
                "total_fees": total_fees,
                "total_deducted": total_deducted,
                "anomalies": verification_result.get("anomalies", [])
            },
            "new_balance": new_balance,
            "receipt_path": final_file_path,
            "transaction_id": str(transaction_result.inserted_id)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        # Hata durumunda dosyaları temizle
        for file_path in [temp_file_path, final_file_path if 'final_file_path' in locals() else None]:
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except:
                    pass
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ödeme işlemi sırasında hata: {str(e)}"
        )

@router.post("/{order_id}/complete-with-receipt")
async def complete_payment_with_receipt(
    order_id: str,
    bank_account_id: str = Form(...),
    receipt_file: UploadFile = File(...),
    current_user: User = Depends(get_admin_user)
):
    """Dekont yükleyerek ödeme emrini tamamla ve AI ile analiz et"""
    db = get_database()
    
    validate_object_id(order_id, StandardErrors.INVALID_OBJECT_ID)
    
    # Ödeme emrini kontrol et
    order = await db.payment_orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ödeme emri bulunamadı"
        )
    
    # Admin kullanıcılar pending ve approved emirleri tamamlayabilir
    if order["status"] not in [PaymentStatus.PENDING, PaymentStatus.APPROVED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sadece bekleyen veya onaylanmış emirler tamamlanabilir"
        )
    
    # Banka hesabını kontrol et
    validate_object_id(bank_account_id, StandardErrors.ACCOUNT_NOT_FOUND)
    
    bank_account = await db.bank_accounts.find_one({"_id": ObjectId(bank_account_id)})
    if not bank_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Banka hesabı bulunamadı"
        )
    
    # Dosya kontrolü - Geçici olarak sadece resim dosyaları
    allowed_types = ["image/jpeg", "image/png", "image/jpg"]
    if receipt_file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Şu anda sadece JPG ve PNG dosyaları desteklenmektedir"
        )
    
    # Dosya boyutu kontrolü (10MB)
    if receipt_file.size > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dosya boyutu 10MB'dan büyük olamaz"
        )
    
    try:
        # Dosyayı kaydet
        file_extension = receipt_file.filename.split(".")[-1]
        filename = f"payment_receipt_{order_id}_{int(datetime.utcnow().timestamp())}.{file_extension}"
        file_path = os.path.join("uploads/payment_receipts", filename)
        
        # Klasörü oluştur
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        async with aiofiles.open(file_path, 'wb') as f:
            content = await receipt_file.read()
            await f.write(content)
        
        # AI ile dekont analizi
        try:
            ai_analysis = await ai_service.analyze_receipt(file_path)
            
            if not ai_analysis.get("success", False):
                # AI analizi başarısız olsa bile işlemi manuel devam ettir
                logger.warning(f"AI analysis failed for receipt: {ai_analysis.get('error')}")
                actual_amount = order["amount"]
                total_fees = 0.0
                net_deducted = actual_amount
            else:
                # AI analizinden gerçek tutarları al
                transaction_details = ai_analysis.get("transaction_details", {})
                fees_info = ai_analysis.get("fees_and_charges", {})
                amount_breakdown = ai_analysis.get("amount_breakdown", {})
                
                actual_amount = transaction_details.get("amount", order["amount"])
                total_fees = fees_info.get("total_fees", 0.0)
                net_deducted = amount_breakdown.get("net_deducted", actual_amount + total_fees)
                
                logger.info(f"AI Analysis Result: amount={actual_amount}, fees={total_fees}, net={net_deducted}")
        
        except Exception as ai_error:
            logger.error(f"AI analysis error: {ai_error}")
            # AI hatası durumunda emirde belirtilen tutarı kullan
            actual_amount = order["amount"]
            total_fees = 0.0
            net_deducted = actual_amount
            ai_analysis = {"success": False, "error": str(ai_error)}
        
        # Bakiye kontrolü - net çıkan tutar üzerinden
        if bank_account["current_balance"] < net_deducted:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Yetersiz bakiye. Gerekli: {net_deducted} TRY, Mevcut: {bank_account['current_balance']} TRY"
            )
        
        now = datetime.utcnow()
        
        # Ödeme emrini güncelle
        await db.payment_orders.update_one(
            {"_id": ObjectId(order_id)},
            {"$set": {
                "status": PaymentStatus.COMPLETED,
                "bank_account_id": bank_account_id,
                "receipt_url": file_path,
                "ai_analysis": ai_analysis,
                "actual_amount": actual_amount,
                "total_fees": total_fees,
                "net_amount_deducted": net_deducted,
                "completed_at": now,
                "completed_by": current_user.id,
                "updated_at": now
            }}
        )
        
        # Banka hesabı bakiyesini güncelle - net tutar üzerinden
        new_balance = bank_account["current_balance"] - net_deducted
        await db.bank_accounts.update_one(
            {"_id": ObjectId(bank_account_id)},
            {"$set": {
                "current_balance": new_balance,
                "updated_at": now
            }}
        )
        
        # Transaction kaydı oluştur - AI analizini dahil et
        from app.models.transaction import TransactionCreate, TransactionType, TransactionStatus
        
        transaction_description = f"Ödeme Emri (Dekont): {order['description']} - {order['recipient_name']}"
        if ai_analysis.get("success") and ai_analysis.get("description"):
            transaction_description += f" | AI: {ai_analysis['description']}"
        
        transaction_data = TransactionCreate(
            type=TransactionType.EXPENSE,
            amount=actual_amount,
            currency=order["currency"],
            description=transaction_description,
            reference_number=order.get("reference_number"),
            bank_account_id=bank_account_id,
            payment_order_id=order_id,
            person_id=order.get("person_id"),
            total_fees=total_fees,
            transaction_date=now
        )
        
        # Net tutarı hesapla (expense için negatif)
        net_amount = -float(net_deducted)
        balance_impact = net_amount
        
        transaction_dict = transaction_data.model_dump()
        transaction_dict.update({
            "status": TransactionStatus.COMPLETED,
            "net_amount": net_amount,
            "balance_impact": balance_impact,
            "receipt_url": file_path,
            "ai_analysis": ai_analysis,
            "created_by": current_user.id,
            "created_at": now,
            "updated_at": now
        })
        
        transaction_result = await db.transactions.insert_one(transaction_dict)
        
        return {
            "message": "Ödeme dekont ile başarıyla tamamlandı",
            "order_id": order_id,
            "actual_amount": actual_amount,
            "total_fees": total_fees,
            "net_deducted": net_deducted,
            "new_balance": new_balance,
            "ai_analysis": ai_analysis,
            "receipt_path": file_path,
            "transaction_id": str(transaction_result.inserted_id)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        # Hata durumunda dosyayı sil
        if 'file_path' in locals() and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ödeme işlemi sırasında hata: {str(e)}"
        )

@router.post("/{order_id}/upload-receipt")
async def upload_receipt(
    order_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Ödeme emri için dekont yükle (sadece admin)"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    validate_object_id(order_id, StandardErrors.INVALID_OBJECT_ID)
    
    order = await db.payment_orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ödeme emri bulunamadı"
        )
    
    # Güvenlik validasyonları
    validate_file_size(file.size)
    validate_file_type(file.filename, ['.jpg', '.jpeg', '.png', '.pdf'])
    
    # Content-Type kontrolü
    allowed_content_types = ["image/jpeg", "image/png", "application/pdf"]
    if file.content_type not in allowed_content_types:
        raise_bad_request("Sadece JPEG, PNG ve PDF dosyaları yüklenebilir")
    
    # Dosya içeriğini oku ve doğrula
    content = await file.read()
    validate_file_content(content, file.filename)
    
    # Güvenli dosya adı oluştur
    safe_filename = sanitize_filename(file.filename)
    file_extension = safe_filename.split(".")[-1] if "." in safe_filename else "unknown"
    timestamp = int(datetime.utcnow().timestamp())
    filename = f"receipt_{order_id}_{timestamp}.{file_extension}"
    file_path = os.path.join(settings.upload_dir, filename)
    
    # Dosyayı kaydet
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)
    
    # Veritabanını güncelle
    await db.payment_orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {
            "receipt_url": file_path,
            "updated_at": datetime.utcnow()
        }}
    )
    
    # TODO: AI ile dekont analizi yap
    
    return {"message": "Dekont başarıyla yüklendi", "filename": filename}

@router.delete("/{order_id}")
async def delete_payment_order(
    order_id: str,
    current_user: User = Depends(get_current_user)
):
    """Ödeme emrini sil"""
    db = get_database()
    
    validate_object_id(order_id, StandardErrors.INVALID_OBJECT_ID)
    
    order = await db.payment_orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ödeme emri bulunamadı"
        )
    
    # Yetki kontrolü
    if current_user.role == "user":
        if order["created_by"] != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bu emri silemezsiniz"
            )
        if order["status"] not in [PaymentStatus.PENDING, PaymentStatus.REJECTED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sadece bekleyen veya reddedilen emirler silinebilir"
            )
    
    await db.payment_orders.delete_one({"_id": ObjectId(order_id)})
    
    return {"message": "Ödeme emri silindi"}