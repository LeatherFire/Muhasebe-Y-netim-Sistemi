from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import os
import aiofiles

from app.models.person import (
    Person,
    PersonCreate,
    PersonUpdate,
    PersonSummary,
    PersonTransactionSummary,
    PersonStatistics
)
from app.models.payment_detail import (
    PaymentDetail,
    PaymentDetailCreate,
    PaymentDetailUpdate,
    PaymentDetailSummary,
    PaymentDetailStatistics,
    AutoPersonCreate
)
from app.models.user import User
from app.api.routes.auth import get_current_user
from app.core.database import get_database
from app.core.config import settings

router = APIRouter()

@router.get("/", response_model=List[Person])
async def get_people(
    person_type: Optional[str] = Query(None, description="Kişi türüne göre filtrele"),
    search: Optional[str] = Query(None, description="İsim veya şirkete göre ara"),
    limit: int = Query(50, le=100, description="Maksimum kayıt sayısı"),
    skip: int = Query(0, ge=0, description="Atlanacak kayıt sayısı"),
    current_user: User = Depends(get_current_user)
):
    """Kişi/kurumları listele"""
    db = get_database()
    
    # Filtre oluştur
    filter_query = {}
    if person_type:
        filter_query["person_type"] = person_type
    if search:
        filter_query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"company": {"$regex": search, "$options": "i"}}
        ]
    
    people = []
    cursor = db.people.find(filter_query).sort("name", 1).skip(skip).limit(limit)
    
    async for person in cursor:
        person["_id"] = str(person["_id"])
        people.append(Person(**person))
    
    return people

@router.get("/summary", response_model=List[PersonSummary])
async def get_people_summary(
    current_user: User = Depends(get_current_user)
):
    """Kişi/kurumların özet bilgilerini getir"""
    db = get_database()
    
    # Aggregate pipeline ile işlem istatistiklerini hesapla
    pipeline = [
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
                "total_sent": {
                    "$sum": {
                        "$map": {
                            "input": {"$filter": {
                                "input": "$transactions",
                                "cond": {"$eq": ["$$this.type", "expense"]}
                            }},
                            "as": "transaction",
                            "in": "$$transaction.amount"
                        }
                    }
                },
                "total_received": {
                    "$sum": {
                        "$map": {
                            "input": {"$filter": {
                                "input": "$transactions",
                                "cond": {"$eq": ["$$this.type", "income"]}
                            }},
                            "as": "transaction",
                            "in": "$$transaction.amount"
                        }
                    }
                },
                "transaction_count": {"$size": "$transactions"},
                "last_transaction_date": {
                    "$max": "$transactions.transaction_date"
                }
            }
        },
        {
            "$sort": {"name": 1}
        }
    ]
    
    summaries = []
    async for doc in db.people.aggregate(pipeline):
        net_balance = doc.get("total_received", 0) - doc.get("total_sent", 0)
        
        summary = PersonSummary(
            id=str(doc["_id"]),
            name=doc["name"],
            person_type=doc.get("person_type", "individual"),
            company=doc.get("company"),
            iban=doc.get("iban"),
            total_sent=doc.get("total_sent", 0),
            total_received=doc.get("total_received", 0),
            transaction_count=doc.get("transaction_count", 0),
            last_transaction_date=doc.get("last_transaction_date"),
            net_balance=net_balance
        )
        summaries.append(summary)
    
    return summaries

@router.get("/statistics", response_model=PersonStatistics)
async def get_people_statistics(
    current_user: User = Depends(get_current_user)
):
    """Kişi/kurum istatistiklerini getir"""
    db = get_database()
    
    # Toplam sayılar
    total_people = await db.people.count_documents({"person_type": "individual"})
    total_companies = await db.people.count_documents({"person_type": "company"})
    
    # Toplam işlem hacmi
    pipeline_volume = [
        {
            "$lookup": {
                "from": "transactions",
                "localField": "_id",
                "foreignField": "person_id",
                "as": "transactions"
            }
        },
        {
            "$unwind": {"path": "$transactions", "preserveNullAndEmptyArrays": True}
        },
        {
            "$group": {
                "_id": None,
                "total_volume": {"$sum": "$transactions.amount"}
            }
        }
    ]
    
    volume_result = []
    async for doc in db.people.aggregate(pipeline_volume):
        volume_result.append(doc)
    
    total_transactions = volume_result[0]["total_volume"] if volume_result else 0
    
    # En çok para gönderilen kişiler (top 5)
    pipeline_recipients = [
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
                "total_sent": {
                    "$sum": {
                        "$map": {
                            "input": {"$filter": {
                                "input": "$transactions",
                                "cond": {"$eq": ["$$this.type", "expense"]}
                            }},
                            "as": "transaction",
                            "in": "$$transaction.amount"
                        }
                    }
                }
            }
        },
        {
            "$match": {"total_sent": {"$gt": 0}}
        },
        {
            "$sort": {"total_sent": -1}
        },
        {
            "$limit": 5
        },
        {
            "$project": {
                "name": 1,
                "company": 1,
                "total_sent": 1
            }
        }
    ]
    
    top_recipients = []
    async for doc in db.people.aggregate(pipeline_recipients):
        top_recipients.append({
            "id": str(doc["_id"]),
            "name": doc["name"],
            "company": doc.get("company"),
            "amount": doc["total_sent"]
        })
    
    # En çok para alınan kişiler (top 5)
    pipeline_senders = [
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
                "total_received": {
                    "$sum": {
                        "$map": {
                            "input": {"$filter": {
                                "input": "$transactions",
                                "cond": {"$eq": ["$$this.type", "income"]}
                            }},
                            "as": "transaction",
                            "in": "$$transaction.amount"
                        }
                    }
                }
            }
        },
        {
            "$match": {"total_received": {"$gt": 0}}
        },
        {
            "$sort": {"total_received": -1}
        },
        {
            "$limit": 5
        },
        {
            "$project": {
                "name": 1,
                "company": 1,
                "total_received": 1
            }
        }
    ]
    
    top_senders = []
    async for doc in db.people.aggregate(pipeline_senders):
        top_senders.append({
            "id": str(doc["_id"]),
            "name": doc["name"],
            "company": doc.get("company"),
            "amount": doc["total_received"]
        })
    
    # Son aktiviteler (son 10 işlem)
    pipeline_recent = [
        {
            "$lookup": {
                "from": "people",
                "localField": "person_id",
                "foreignField": "_id",
                "as": "person"
            }
        },
        {
            "$lookup": {
                "from": "bank_accounts",
                "localField": "bank_account_id",
                "foreignField": "_id",
                "as": "bank_account"
            }
        },
        {
            "$match": {"person": {"$ne": []}}
        },
        {
            "$sort": {"transaction_date": -1}
        },
        {
            "$limit": 10
        },
        {
            "$project": {
                "person_id": {"$arrayElemAt": ["$person._id", 0]},
                "person_name": {"$arrayElemAt": ["$person.name", 0]},
                "type": 1,
                "amount": 1,
                "description": 1,
                "transaction_date": 1,
                "bank_account_name": {"$arrayElemAt": ["$bank_account.name", 0]}
            }
        }
    ]
    
    recent_activity = []
    async for doc in db.transactions.aggregate(pipeline_recent):
        recent_activity.append({
            "person_id": str(doc["person_id"]),
            "person_name": doc["person_name"],
            "transaction_id": str(doc["_id"]),
            "transaction_type": doc["type"],
            "amount": doc["amount"],
            "description": doc["description"],
            "transaction_date": doc["transaction_date"],
            "bank_account_name": doc.get("bank_account_name")
        })
    
    return PersonStatistics(
        total_people=total_people,
        total_companies=total_companies,
        total_transactions=total_transactions,
        top_recipients=top_recipients,
        top_senders=top_senders,
        recent_activity=recent_activity
    )

@router.get("/{person_id}", response_model=Person)
async def get_person(
    person_id: str,
    current_user: User = Depends(get_current_user)
):
    """Tek bir kişi/kurumun detaylarını getir"""
    db = get_database()
    
    if not ObjectId.is_valid(person_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz kişi ID"
        )
    
    person = await db.people.find_one({"_id": ObjectId(person_id)})
    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kişi bulunamadı"
        )
    
    person["_id"] = str(person["_id"])
    return Person(**person)

@router.get("/{person_id}/transactions", response_model=List[PersonTransactionSummary])
async def get_person_transactions(
    person_id: str,
    transaction_type: Optional[str] = Query(None, description="İşlem türüne göre filtrele"),
    limit: int = Query(50, le=100, description="Maksimum kayıt sayısı"),
    skip: int = Query(0, ge=0, description="Atlanacak kayıt sayısı"),
    current_user: User = Depends(get_current_user)
):
    """Kişi/kurumun işlemlerini listele"""
    db = get_database()
    
    if not ObjectId.is_valid(person_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz kişi ID"
        )
    
    # Filtre oluştur
    filter_query = {"person_id": person_id}
    if transaction_type:
        filter_query["type"] = transaction_type
    
    # Aggregate pipeline ile banka hesabı ve kişi bilgilerini join et
    pipeline = [
        {"$match": filter_query},
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
        {"$skip": skip},
        {"$limit": limit}
    ]
    
    transactions = []
    async for doc in db.transactions.aggregate(pipeline):
        bank_account_name = doc["bank_account"][0]["name"] if doc["bank_account"] else None
        person_name = doc["person"][0]["name"] if doc["person"] else "Bilinmeyen"
        
        transaction = PersonTransactionSummary(
            person_id=person_id,
            person_name=person_name,
            transaction_id=str(doc["_id"]),
            transaction_type=doc["type"],
            amount=doc["amount"],
            description=doc["description"],
            transaction_date=doc["transaction_date"],
            bank_account_name=bank_account_name,
            receipt_url=doc.get("receipt_url")
        )
        transactions.append(transaction)
    
    return transactions

@router.post("/", response_model=Person)
async def create_person(
    person_data: PersonCreate,
    current_user: User = Depends(get_current_user)
):
    """Yeni kişi/kurum oluştur"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    # Aynı isimde kişi var mı kontrol et
    existing_person = await db.people.find_one({"name": person_data.name})
    if existing_person:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu isimde bir kişi/kurum zaten var"
        )
    
    now = datetime.utcnow()
    person_dict = person_data.model_dump()
    person_dict.update({
        "total_sent": 0.0,
        "total_received": 0.0,
        "transaction_count": 0,
        "created_at": now,
        "updated_at": now
    })
    
    result = await db.people.insert_one(person_dict)
    
    # Oluşturulan kişiyi getir
    created_person = await db.people.find_one({"_id": result.inserted_id})
    created_person["_id"] = str(created_person["_id"])
    
    return Person(**created_person)

@router.put("/{person_id}", response_model=Person)
async def update_person(
    person_id: str,
    person_data: PersonUpdate,
    current_user: User = Depends(get_current_user)
):
    """Kişi/kurum bilgilerini güncelle"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    if not ObjectId.is_valid(person_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz kişi ID"
        )
    
    # Mevcut kişiyi kontrol et
    existing_person = await db.people.find_one({"_id": ObjectId(person_id)})
    if not existing_person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kişi bulunamadı"
        )
    
    # Güncelleme verilerini hazırla
    update_data = person_data.model_dump(exclude_unset=True)
    if update_data:
        # İsim değişikliği kontrolü
        if "name" in update_data and update_data["name"] != existing_person["name"]:
            name_exists = await db.people.find_one({
                "name": update_data["name"],
                "_id": {"$ne": ObjectId(person_id)}
            })
            if name_exists:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Bu isimde başka bir kişi/kurum var"
                )
        
        update_data["updated_at"] = datetime.utcnow()
        
        await db.people.update_one(
            {"_id": ObjectId(person_id)},
            {"$set": update_data}
        )
    
    # Güncellenmiş kişiyi getir
    updated_person = await db.people.find_one({"_id": ObjectId(person_id)})
    updated_person["_id"] = str(updated_person["_id"])
    
    return Person(**updated_person)

@router.delete("/{person_id}")
async def delete_person(
    person_id: str,
    current_user: User = Depends(get_current_user)
):
    """Kişi/kurumu sil"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    if not ObjectId.is_valid(person_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz kişi ID"
        )
    
    person = await db.people.find_one({"_id": ObjectId(person_id)})
    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kişi bulunamadı"
        )
    
    # İlişkili işlemleri kontrol et
    transaction_count = await db.transactions.count_documents({"person_id": person_id})
    if transaction_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu kişiye ait işlemler var. Önce işlemleri silmelisiniz."
        )
    
    await db.people.delete_one({"_id": ObjectId(person_id)})
    
    return {"message": "Kişi silindi"}

@router.post("/auto-create")
async def auto_create_person_from_transaction(
    recipient_name: str,
    recipient_iban: str,
    current_user: User = Depends(get_current_user)
):
    """İşlemden otomatik kişi oluştur (internal endpoint)"""
    db = get_database()
    
    # Zaten var mı kontrol et
    existing_person = await db.people.find_one({
        "$or": [
            {"name": recipient_name},
            {"iban": recipient_iban}
        ]
    })
    
    if existing_person:
        return {"person_id": str(existing_person["_id"]), "created": False}
    
    # Yeni kişi oluştur
    now = datetime.utcnow()
    person_dict = {
        "name": recipient_name,
        "iban": recipient_iban,
        "person_type": "individual",  # Default olarak individual
        "total_sent": 0.0,
        "total_received": 0.0,
        "transaction_count": 0,
        "created_at": now,
        "updated_at": now
    }
    
    result = await db.people.insert_one(person_dict)
    
    return {"person_id": str(result.inserted_id), "created": True}

# Otomatik kişi oluşturma ve ödeme detayları endpoint'leri

@router.post("/auto-create-advanced", response_model=Person)
async def auto_create_person_advanced(
    person_data: AutoPersonCreate,
    current_user: User = Depends(get_current_user)
):
    """Gelişmiş otomatik kişi oluşturma"""
    db = get_database()
    
    # Aynı isim veya IBAN ile kişi var mı kontrol et
    filter_conditions = [{"name": person_data.name}]
    if person_data.iban:
        filter_conditions.append({"iban": person_data.iban})
    if person_data.tax_number:
        filter_conditions.append({"tax_number": person_data.tax_number})
    
    existing_person = await db.people.find_one({"$or": filter_conditions})
    
    if existing_person:
        existing_person["_id"] = str(existing_person["_id"])
        return Person(**existing_person)
    
    # Yeni kişi oluştur
    now = datetime.utcnow()
    person_dict = {
        "name": person_data.name,
        "person_type": person_data.person_type,
        "phone": person_data.phone,
        "iban": person_data.iban,
        "tax_number": person_data.tax_number,
        "company": person_data.company,
        "total_sent": 0.0,
        "total_received": 0.0,
        "transaction_count": 0,
        "created_at": now,
        "updated_at": now,
        "auto_created": True,
        "creation_source": person_data.source
    }
    
    result = await db.people.insert_one(person_dict)
    
    # Oluşturulan kişiyi getir
    created_person = await db.people.find_one({"_id": result.inserted_id})
    created_person["_id"] = str(created_person["_id"])
    
    return Person(**created_person)

@router.get("/{person_id}/payments", response_model=List[PaymentDetail])
async def get_person_payments(
    person_id: str,
    payment_type: Optional[str] = Query(None, description="Ödeme türüne göre filtrele"),
    limit: int = Query(50, le=100, description="Maksimum kayıt sayısı"),
    skip: int = Query(0, ge=0, description="Atlanacak kayıt sayısı"),
    current_user: User = Depends(get_current_user)
):
    """Kişinin ödeme detaylarını listele"""
    db = get_database()
    
    if not ObjectId.is_valid(person_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz kişi ID"
        )
    
    # Filtre oluştur
    filter_query = {"person_id": person_id}
    if payment_type:
        filter_query["payment_type"] = payment_type
    
    payments = []
    cursor = db.payment_details.find(filter_query).sort("payment_date", -1).skip(skip).limit(limit)
    
    async for payment in cursor:
        payment["_id"] = str(payment["_id"])
        payments.append(PaymentDetail(**payment))
    
    return payments

@router.post("/{person_id}/payments", response_model=PaymentDetail)
async def create_payment_detail(
    person_id: str,
    payment_data: PaymentDetailCreate,
    current_user: User = Depends(get_current_user)
):
    """Kişi için ödeme detayı oluştur"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    if not ObjectId.is_valid(person_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz kişi ID"
        )
    
    # Kişi var mı kontrol et
    person = await db.people.find_one({"_id": ObjectId(person_id)})
    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kişi bulunamadı"
        )
    
    now = datetime.utcnow()
    payment_dict = payment_data.model_dump()
    payment_dict.update({
        "person_id": person_id,
        "created_by": current_user.id,
        "created_at": now,
        "updated_at": now
    })
    
    result = await db.payment_details.insert_one(payment_dict)
    
    # Kişi istatistiklerini güncelle
    amount_change = payment_data.amount
    if payment_data.payment_type == "outgoing":
        await db.people.update_one(
            {"_id": ObjectId(person_id)},
            {"$inc": {"total_sent": amount_change}}
        )
    else:
        await db.people.update_one(
            {"_id": ObjectId(person_id)},
            {"$inc": {"total_received": amount_change}}
        )
    
    # Oluşturulan ödemeyi getir
    created_payment = await db.payment_details.find_one({"_id": result.inserted_id})
    created_payment["_id"] = str(created_payment["_id"])
    
    return PaymentDetail(**created_payment)

@router.post("/{person_id}/payments/{payment_id}/upload-receipts")
async def upload_payment_receipts(
    person_id: str,
    payment_id: str,
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user)
):
    """Ödeme için dekont dosyalarını yükle"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    db = get_database()
    
    if not ObjectId.is_valid(payment_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz ödeme ID"
        )
    
    # Ödeme var mı kontrol et
    payment = await db.payment_details.find_one({"_id": ObjectId(payment_id), "person_id": person_id})
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ödeme bulunamadı"
        )
    
    uploaded_files = []
    
    for file in files:
        # Dosya türü kontrolü
        allowed_types = ["image/jpeg", "image/png", "application/pdf"]
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Desteklenmeyen dosya türü: {file.content_type}"
            )
        
        # Dosya boyutu kontrolü
        if file.size > settings.max_file_size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dosya boyutu çok büyük (maksimum 10MB)"
            )
        
        # Dosya adı oluştur
        file_extension = file.filename.split(".")[-1]
        filename = f"payment_{payment_id}_{int(datetime.utcnow().timestamp())}.{file_extension}"
        file_path = os.path.join(settings.upload_dir, "receipts", filename)
        
        # Dizin oluştur
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        # Dosyayı kaydet
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        uploaded_files.append(file_path)
    
    # Ödeme kaydını güncelle
    existing_receipts = payment.get("receipt_urls", [])
    all_receipts = existing_receipts + uploaded_files
    
    await db.payment_details.update_one(
        {"_id": ObjectId(payment_id)},
        {"$set": {"receipt_urls": all_receipts, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": f"{len(uploaded_files)} dosya başarıyla yüklendi", "file_paths": uploaded_files}

@router.get("/payments/summary", response_model=List[PaymentDetailSummary])
async def get_payments_summary(
    current_user: User = Depends(get_current_user)
):
    """Tüm ödeme detaylarının özetini getir"""
    db = get_database()
    
    # Aggregate pipeline ile kişi bilgilerini join et
    pipeline = [
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
                "person_name": {"$arrayElemAt": ["$person.name", 0]},
                "receipt_count": {"$size": {"$ifNull": ["$receipt_urls", []]}}
            }
        },
        {"$sort": {"payment_date": -1}},
        {"$limit": 100}
    ]
    
    summaries = []
    async for doc in db.payment_details.aggregate(pipeline):
        summary = PaymentDetailSummary(
            id=str(doc["_id"]),
            person_name=doc.get("person_name", "Bilinmeyen"),
            payment_type=doc["payment_type"],
            amount=doc["amount"],
            currency=doc["currency"],
            description=doc["description"],
            payment_method=doc["payment_method"],
            payment_date=doc["payment_date"],
            status=doc["status"],
            receipt_count=doc["receipt_count"]
        )
        summaries.append(summary)
    
    return summaries

@router.get("/payments/statistics", response_model=PaymentDetailStatistics)
async def get_payments_statistics(
    current_user: User = Depends(get_current_user)
):
    """Ödeme detayları istatistiklerini getir"""
    db = get_database()
    
    # Toplam ödeme sayısı
    total_payments = await db.payment_details.count_documents({})
    
    # Toplam giden ve gelen tutarlar
    outgoing_pipeline = [
        {"$match": {"payment_type": "outgoing"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    
    incoming_pipeline = [
        {"$match": {"payment_type": "incoming"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    
    total_outgoing = 0
    async for doc in db.payment_details.aggregate(outgoing_pipeline):
        total_outgoing = doc["total"]
    
    total_incoming = 0
    async for doc in db.payment_details.aggregate(incoming_pipeline):
        total_incoming = doc["total"]
    
    net_flow = total_incoming - total_outgoing
    
    # Bugünkü ödemeler
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    payments_today = await db.payment_details.count_documents({
        "payment_date": {"$gte": today}
    })
    
    # Bu ayki ödemeler
    start_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    payments_this_month = await db.payment_details.count_documents({
        "payment_date": {"$gte": start_of_month}
    })
    
    # Popüler ödeme yöntemleri
    method_pipeline = [
        {"$group": {"_id": "$payment_method", "count": {"$sum": 1}, "total_amount": {"$sum": "$amount"}}},
        {"$sort": {"count": -1}},
        {"$limit": 5}
    ]
    
    popular_payment_methods = []
    async for doc in db.payment_details.aggregate(method_pipeline):
        popular_payment_methods.append({
            "method": doc["_id"],
            "count": doc["count"],
            "total_amount": doc["total_amount"]
        })
    
    # En çok ödeme yapılan kişiler
    recipient_pipeline = [
        {"$match": {"payment_type": "outgoing"}},
        {
            "$lookup": {
                "from": "people",
                "localField": "person_id",
                "foreignField": "_id",
                "as": "person"
            }
        },
        {
            "$group": {
                "_id": "$person_id",
                "person_name": {"$first": {"$arrayElemAt": ["$person.name", 0]}},
                "total_amount": {"$sum": "$amount"},
                "payment_count": {"$sum": 1}
            }
        },
        {"$sort": {"total_amount": -1}},
        {"$limit": 5}
    ]
    
    top_recipients = []
    async for doc in db.payment_details.aggregate(recipient_pipeline):
        top_recipients.append({
            "person_id": str(doc["_id"]),
            "person_name": doc["person_name"],
            "total_amount": doc["total_amount"],
            "payment_count": doc["payment_count"]
        })
    
    # Son ödemeler
    recent_pipeline = [
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
                "person_name": {"$arrayElemAt": ["$person.name", 0]}
            }
        },
        {"$sort": {"payment_date": -1}},
        {"$limit": 10}
    ]
    
    recent_payments = []
    async for doc in db.payment_details.aggregate(recent_pipeline):
        recent_payments.append({
            "id": str(doc["_id"]),
            "person_name": doc["person_name"],
            "payment_type": doc["payment_type"],
            "amount": doc["amount"],
            "description": doc["description"],
            "payment_date": doc["payment_date"]
        })
    
    return PaymentDetailStatistics(
        total_payments=total_payments,
        total_outgoing=total_outgoing,
        total_incoming=total_incoming,
        net_flow=net_flow,
        payments_today=payments_today,
        payments_this_month=payments_this_month,
        popular_payment_methods=popular_payment_methods,
        top_recipients=top_recipients,
        recent_payments=recent_payments
    )