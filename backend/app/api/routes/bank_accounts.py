from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

from app.models.bank_account import (
    BankAccount, 
    BankAccountCreate, 
    BankAccountUpdate, 
    BankAccountSummary
)
from app.models.user import User
from app.api.routes.auth import get_current_user
from app.core.database import get_database

router = APIRouter()

@router.get("/", response_model=List[BankAccount])
async def get_bank_accounts(
    current_user: User = Depends(get_current_user)
):
    """Tüm banka hesaplarını listele"""
    db = get_database()
    accounts = []
    
    async for account in db.bank_accounts.find():
        account["_id"] = str(account["_id"])
        accounts.append(BankAccount(**account))
    
    return accounts

@router.get("/summary", response_model=List[BankAccountSummary])
async def get_bank_accounts_summary(
    current_user: User = Depends(get_current_user)
):
    """Banka hesaplarının özet bilgilerini getir"""
    db = get_database()
    accounts = []
    
    async for account in db.bank_accounts.find():
        account["_id"] = str(account["_id"])
        summary = BankAccountSummary(
            id=account["_id"],
            name=account["name"],
            bank_name=account["bank_name"],
            current_balance=account["current_balance"],
            currency=account["currency"],
            account_type=account["account_type"]
        )
        accounts.append(summary)
    
    return accounts

@router.get("/{account_id}", response_model=BankAccount)
async def get_bank_account(
    account_id: str,
    current_user: User = Depends(get_current_user)
):
    """Tek bir banka hesabının detaylarını getir"""
    db = get_database()
    
    if not ObjectId.is_valid(account_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz hesap ID"
        )
    
    account = await db.bank_accounts.find_one({"_id": ObjectId(account_id)})
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hesap bulunamadı"
        )
    
    account["_id"] = str(account["_id"])
    return BankAccount(**account)

@router.post("/", response_model=BankAccount)
async def create_bank_account(
    account_data: BankAccountCreate,
    current_user: User = Depends(get_current_user)
):
    """Yeni banka hesabı oluştur (sadece admin)"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    # IBAN kontrolü
    existing_account = await db.bank_accounts.find_one({"iban": account_data.iban})
    if existing_account:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu IBAN ile zaten bir hesap mevcut"
        )
    
    # Yeni hesap oluştur
    now = datetime.utcnow()
    account_dict = account_data.model_dump()
    account_dict.update({
        "current_balance": account_data.initial_balance,
        "created_at": now,
        "updated_at": now
    })
    
    result = await db.bank_accounts.insert_one(account_dict)
    
    # Oluşturulan hesabı getir
    created_account = await db.bank_accounts.find_one({"_id": result.inserted_id})
    created_account["_id"] = str(created_account["_id"])
    
    return BankAccount(**created_account)

@router.put("/{account_id}", response_model=BankAccount)
async def update_bank_account(
    account_id: str,
    account_data: BankAccountUpdate,
    current_user: User = Depends(get_current_user)
):
    """Banka hesabını güncelle (sadece admin)"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    if not ObjectId.is_valid(account_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz hesap ID"
        )
    
    # Hesabın var olup olmadığını kontrol et
    account = await db.bank_accounts.find_one({"_id": ObjectId(account_id)})
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hesap bulunamadı"
        )
    
    # Güncelleme verilerini hazırla
    update_data = {k: v for k, v in account_data.model_dump().items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await db.bank_accounts.update_one(
            {"_id": ObjectId(account_id)},
            {"$set": update_data}
        )
    
    # Güncellenmiş hesabı getir
    updated_account = await db.bank_accounts.find_one({"_id": ObjectId(account_id)})
    updated_account["_id"] = str(updated_account["_id"])
    
    return BankAccount(**updated_account)

@router.delete("/{account_id}")
async def delete_bank_account(
    account_id: str,
    current_user: User = Depends(get_current_user)
):
    """Banka hesabını sil (sadece admin)"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    if not ObjectId.is_valid(account_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz hesap ID"
        )
    
    # Hesabın var olup olmadığını kontrol et
    account = await db.bank_accounts.find_one({"_id": ObjectId(account_id)})
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hesap bulunamadı"
        )
    
    # İşlem geçmişi kontrolü (gelecekte eklenecek)
    # TODO: Bu hesapla ilgili işlemler varsa silmeyi engelle
    
    await db.bank_accounts.delete_one({"_id": ObjectId(account_id)})
    
    return {"message": "Hesap başarıyla silindi"}

@router.post("/{account_id}/update-balance")
async def update_account_balance(
    account_id: str,
    amount: float,
    description: str,
    current_user: User = Depends(get_current_user)
):
    """Hesap bakiyesini manuel olarak güncelle (sadece admin)"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    if not ObjectId.is_valid(account_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz hesap ID"
        )
    
    account = await db.bank_accounts.find_one({"_id": ObjectId(account_id)})
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hesap bulunamadı"
        )
    
    new_balance = account["current_balance"] + amount
    
    await db.bank_accounts.update_one(
        {"_id": ObjectId(account_id)},
        {"$set": {
            "current_balance": new_balance,
            "updated_at": datetime.utcnow()
        }}
    )
    
    # İşlem geçmişine kaydet (transactions collection)
    from app.models.transaction import TransactionCreate, TransactionType, TransactionStatus
    
    # Tutarın türünü belirle (artış/azalış)
    transaction_type = TransactionType.INCOME if amount > 0 else TransactionType.EXPENSE
    transaction_description = f"Manuel Bakiye Güncellemesi: {description}"
    
    transaction_data = TransactionCreate(
        type=transaction_type,
        amount=abs(amount),  # Mutlak değer
        currency=account["currency"],
        description=transaction_description,
        reference_number=f"MANUAL_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
        bank_account_id=account_id,
        total_fees=0.0,
        transaction_date=datetime.utcnow()
    )
    
    transaction_dict = transaction_data.model_dump()
    transaction_dict.update({
        "status": TransactionStatus.COMPLETED,
        "net_amount": amount,  # Gerçek tutar (+ veya -)
        "balance_impact": amount,
        "created_by": current_user.id,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    })
    
    transaction_result = await db.transactions.insert_one(transaction_dict)
    
    return {
        "message": "Bakiye güncellendi ve işlem kaydedildi",
        "old_balance": account["current_balance"],
        "new_balance": new_balance,
        "amount": amount,
        "transaction_id": str(transaction_result.inserted_id)
    }

@router.post("/{account_id}/recalculate-balance")
async def recalculate_balance(
    account_id: str,
    current_user: User = Depends(get_current_user)
):
    """Hesap bakiyesini transaction'lardan yeniden hesapla (sadece admin)"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    if not ObjectId.is_valid(account_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz hesap ID"
        )
    
    account = await db.bank_accounts.find_one({"_id": ObjectId(account_id)})
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hesap bulunamadı"
        )
    
    # Bu hesaba ait tüm transaction'ları topla
    pipeline = [
        {
            "$match": {
                "bank_account_id": account_id,
                "status": "completed"
            }
        },
        {
            "$group": {
                "_id": None,
                "total_balance_impact": {"$sum": "$balance_impact"}
            }
        }
    ]
    
    result = []
    async for doc in db.transactions.aggregate(pipeline):
        result.append(doc)
    
    # Hesaplanan bakiye
    calculated_balance = account["initial_balance"] + (result[0]["total_balance_impact"] if result else 0)
    old_balance = account["current_balance"]
    
    # Bakiyeyi güncelle
    await db.bank_accounts.update_one(
        {"_id": ObjectId(account_id)},
        {"$set": {
            "current_balance": calculated_balance,
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {
        "message": "Bakiye yeniden hesaplandı",
        "old_balance": old_balance,
        "calculated_balance": calculated_balance,
        "difference": calculated_balance - old_balance,
        "total_transactions": len(result) if result else 0
    }