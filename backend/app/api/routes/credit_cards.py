from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime, date
from bson import ObjectId
from calendar import monthrange

from app.models.credit_card import (
    CreditCard,
    CreditCardCreate,
    CreditCardUpdate,
    CreditCardSummary,
    CreditCardTransaction,
    CreditCardTransactionCreate,
    CreditCardPayment,
    CreditCardPaymentCreate
)
from app.models.user import User
from app.api.routes.auth import get_current_user
from app.core.database import get_database

router = APIRouter()

def calculate_days_to_date(target_day: int, from_date: date = None) -> int:
    """Belirtilen günden hedef güne kaç gün kaldığını hesaplar"""
    if from_date is None:
        from_date = date.today()
    
    current_month = from_date.month
    current_year = from_date.year
    
    # Bu ayki hedef tarih
    try:
        target_date = date(current_year, current_month, target_day)
    except ValueError:
        # Ay içinde böyle bir gün yoksa (örn. 31 Şubat), ayın son günü olarak al
        last_day = monthrange(current_year, current_month)[1]
        target_date = date(current_year, current_month, min(target_day, last_day))
    
    # Eğer hedef tarih geçtiyse, gelecek aya bak
    if target_date <= from_date:
        next_month = current_month + 1
        next_year = current_year
        if next_month > 12:
            next_month = 1
            next_year += 1
        
        try:
            target_date = date(next_year, next_month, target_day)
        except ValueError:
            last_day = monthrange(next_year, next_month)[1]
            target_date = date(next_year, next_month, min(target_day, last_day))
    
    return (target_date - from_date).days

@router.get("/", response_model=List[CreditCard])
async def get_credit_cards(
    current_user: User = Depends(get_current_user)
):
    """Kredi kartlarını listele"""
    db = get_database()
    
    credit_cards = []
    cursor = db.credit_cards.find().sort("created_at", -1)
    
    async for card in cursor:
        card["_id"] = str(card["_id"])
        
        # Kullanılabilir limit hesapla
        available_limit = card["limit"] - card["used_amount"]
        card["available_limit"] = available_limit
        
        # Kullanım yüzdesi hesapla
        usage_percentage = (card["used_amount"] / card["limit"]) * 100 if card["limit"] > 0 else 0
        card["usage_percentage"] = round(usage_percentage, 2)
        
        credit_cards.append(CreditCard(**card))
    
    return credit_cards

@router.get("/summary", response_model=List[CreditCardSummary])
async def get_credit_cards_summary(
    current_user: User = Depends(get_current_user)
):
    """Kredi kartları özet bilgilerini getir"""
    db = get_database()
    
    summaries = []
    cursor = db.credit_cards.find().sort("created_at", -1)
    
    today = date.today()
    
    async for card in cursor:
        available_limit = card["limit"] - card["used_amount"]
        usage_percentage = (card["used_amount"] / card["limit"]) * 100 if card["limit"] > 0 else 0
        
        # Hesap kesim ve son ödeme tarihlerine kaç gün kaldığını hesapla
        days_to_statement = calculate_days_to_date(card["statement_date"], today)
        days_to_due = calculate_days_to_date(card["due_date"], today)
        
        summary = CreditCardSummary(
            id=str(card["_id"]),
            name=card["name"],
            bank_name=card["bank_name"],
            limit=card["limit"],
            used_amount=card["used_amount"],
            available_limit=available_limit,
            usage_percentage=round(usage_percentage, 2),
            statement_date=card["statement_date"],
            due_date=card["due_date"],
            flexible_account=card["flexible_account"],
            days_to_statement=days_to_statement,
            days_to_due=days_to_due
        )
        summaries.append(summary)
    
    return summaries

@router.get("/{card_id}", response_model=CreditCard)
async def get_credit_card(
    card_id: str,
    current_user: User = Depends(get_current_user)
):
    """Tek bir kredi kartının detaylarını getir"""
    db = get_database()
    
    if not ObjectId.is_valid(card_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz kredi kartı ID"
        )
    
    card = await db.credit_cards.find_one({"_id": ObjectId(card_id)})
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kredi kartı bulunamadı"
        )
    
    card["_id"] = str(card["_id"])
    
    # Hesaplamaları yap
    available_limit = card["limit"] - card["used_amount"]
    card["available_limit"] = available_limit
    
    usage_percentage = (card["used_amount"] / card["limit"]) * 100 if card["limit"] > 0 else 0
    card["usage_percentage"] = round(usage_percentage, 2)
    
    return CreditCard(**card)

@router.post("/", response_model=CreditCard)
async def create_credit_card(
    card_data: CreditCardCreate,
    current_user: User = Depends(get_current_user)
):
    """Yeni kredi kartı oluştur"""
    print(f"Creating credit card for user: {current_user.username} (role: {current_user.role})")
    print(f"Card data received: {card_data}")
    
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    # Kullanım kontrolü
    if card_data.used_amount > card_data.limit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kullanılan tutar limitten fazla olamaz"
        )
    
    now = datetime.utcnow()
    card_dict = card_data.model_dump()
    card_dict.update({
        "created_at": now,
        "updated_at": now
    })
    
    result = await db.credit_cards.insert_one(card_dict)
    
    # Oluşturulan kartı getir
    created_card = await db.credit_cards.find_one({"_id": result.inserted_id})
    created_card["_id"] = str(created_card["_id"])
    
    # Hesaplamaları yap
    available_limit = created_card["limit"] - created_card["used_amount"]
    created_card["available_limit"] = available_limit
    
    usage_percentage = (created_card["used_amount"] / created_card["limit"]) * 100 if created_card["limit"] > 0 else 0
    created_card["usage_percentage"] = round(usage_percentage, 2)
    
    return CreditCard(**created_card)

@router.put("/{card_id}", response_model=CreditCard)
async def update_credit_card(
    card_id: str,
    card_data: CreditCardUpdate,
    current_user: User = Depends(get_current_user)
):
    """Kredi kartı bilgilerini güncelle"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    if not ObjectId.is_valid(card_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz kredi kartı ID"
        )
    
    # Mevcut kartı kontrol et
    existing_card = await db.credit_cards.find_one({"_id": ObjectId(card_id)})
    if not existing_card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kredi kartı bulunamadı"
        )
    
    # Güncelleme verilerini hazırla
    update_data = card_data.model_dump(exclude_unset=True)
    if update_data:
        # Kullanım kontrolü
        new_limit = update_data.get("limit", existing_card["limit"])
        new_used_amount = update_data.get("used_amount", existing_card["used_amount"])
        
        if new_used_amount > new_limit:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Kullanılan tutar limitten fazla olamaz"
            )
        
        update_data["updated_at"] = datetime.utcnow()
        
        await db.credit_cards.update_one(
            {"_id": ObjectId(card_id)},
            {"$set": update_data}
        )
    
    # Güncellenmiş kartı getir
    updated_card = await db.credit_cards.find_one({"_id": ObjectId(card_id)})
    updated_card["_id"] = str(updated_card["_id"])
    
    # Hesaplamaları yap
    available_limit = updated_card["limit"] - updated_card["used_amount"]
    updated_card["available_limit"] = available_limit
    
    usage_percentage = (updated_card["used_amount"] / updated_card["limit"]) * 100 if updated_card["limit"] > 0 else 0
    updated_card["usage_percentage"] = round(usage_percentage, 2)
    
    return CreditCard(**updated_card)

@router.delete("/{card_id}")
async def delete_credit_card(
    card_id: str,
    current_user: User = Depends(get_current_user)
):
    """Kredi kartını sil"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    if not ObjectId.is_valid(card_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz kredi kartı ID"
        )
    
    card = await db.credit_cards.find_one({"_id": ObjectId(card_id)})
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kredi kartı bulunamadı"
        )
    
    # İlişkili işlemleri kontrol et
    transaction_count = await db.credit_card_transactions.count_documents({"credit_card_id": card_id})
    if transaction_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu karta ait işlemler var. Önce işlemleri silmelisiniz."
        )
    
    await db.credit_cards.delete_one({"_id": ObjectId(card_id)})
    
    return {"message": "Kredi kartı silindi"}

# Kredi kartı işlemleri endpoints'leri

@router.get("/{card_id}/transactions", response_model=List[CreditCardTransaction])
async def get_card_transactions(
    card_id: str,
    limit: int = Query(50, le=100, description="Maksimum kayıt sayısı"),
    skip: int = Query(0, ge=0, description="Atlanacak kayıt sayısı"),
    current_user: User = Depends(get_current_user)
):
    """Kredi kartının işlemlerini listele"""
    db = get_database()
    
    if not ObjectId.is_valid(card_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz kredi kartı ID"
        )
    
    transactions = []
    cursor = db.credit_card_transactions.find(
        {"credit_card_id": card_id}
    ).sort("transaction_date", -1).skip(skip).limit(limit)
    
    async for transaction in cursor:
        transaction["_id"] = str(transaction["_id"])
        transactions.append(CreditCardTransaction(**transaction))
    
    return transactions

@router.post("/{card_id}/transactions", response_model=CreditCardTransaction)
async def create_card_transaction(
    card_id: str,
    transaction_data: CreditCardTransactionCreate,
    current_user: User = Depends(get_current_user)
):
    """Kredi kartına yeni işlem ekle"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    if not ObjectId.is_valid(card_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz kredi kartı ID"
        )
    
    # Kredi kartını kontrol et
    card = await db.credit_cards.find_one({"_id": ObjectId(card_id)})
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kredi kartı bulunamadı"
        )
    
    # Limit kontrolü
    new_used_amount = card["used_amount"] + transaction_data.amount
    if new_used_amount > card["limit"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Limit aşımı! Mevcut limit: {card['limit']}, Kullanılan: {card['used_amount']}, Yeni işlem: {transaction_data.amount}"
        )
    
    now = datetime.utcnow()
    
    # Taksit tutarını hesapla
    installment_amount = transaction_data.amount / transaction_data.installments if transaction_data.installments > 1 else None
    
    transaction_dict = transaction_data.model_dump()
    transaction_dict.update({
        "installment_amount": installment_amount,
        "created_by": current_user.id,
        "created_at": now,
        "updated_at": now
    })
    
    # İşlemi kaydet
    result = await db.credit_card_transactions.insert_one(transaction_dict)
    
    # Kredi kartının kullanılan tutarını güncelle
    await db.credit_cards.update_one(
        {"_id": ObjectId(card_id)},
        {"$set": {
            "used_amount": new_used_amount,
            "updated_at": now
        }}
    )
    
    # Oluşturulan işlemi getir
    created_transaction = await db.credit_card_transactions.find_one({"_id": result.inserted_id})
    created_transaction["_id"] = str(created_transaction["_id"])
    
    return CreditCardTransaction(**created_transaction)

@router.post("/{card_id}/payments", response_model=CreditCardPayment)
async def create_card_payment(
    card_id: str,
    payment_data: CreditCardPaymentCreate,
    current_user: User = Depends(get_current_user)
):
    """Kredi kartına ödeme yap"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    if not ObjectId.is_valid(card_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz kredi kartı ID"
        )
    
    # Kredi kartını kontrol et
    card = await db.credit_cards.find_one({"_id": ObjectId(card_id)})
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kredi kartı bulunamadı"
        )
    
    # Ödeme tutarı kontrolü
    if payment_data.amount > card["used_amount"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ödeme tutarı kullanılan tutardan fazla olamaz. Kullanılan: {card['used_amount']}"
        )
    
    now = datetime.utcnow()
    
    payment_dict = payment_data.model_dump()
    payment_dict.update({
        "created_by": current_user.id,
        "created_at": now
    })
    
    # Ödemeyi kaydet
    result = await db.credit_card_payments.insert_one(payment_dict)
    
    # Kredi kartının kullanılan tutarını güncelle
    new_used_amount = card["used_amount"] - payment_data.amount
    await db.credit_cards.update_one(
        {"_id": ObjectId(card_id)},
        {"$set": {
            "used_amount": new_used_amount,
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
    
    # Oluşturulan ödemeyi getir
    created_payment = await db.credit_card_payments.find_one({"_id": result.inserted_id})
    created_payment["_id"] = str(created_payment["_id"])
    
    return CreditCardPayment(**created_payment)