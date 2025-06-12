from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from typing import Optional
import os
import aiofiles
from datetime import datetime

from app.models.user import User
from app.api.routes.auth import get_current_user
from app.services.ai_service import ai_service
from app.core.config import settings

router = APIRouter()

@router.get("/health")
async def ai_health_check():
    """AI servislerinin durumunu kontrol et"""
    try:
        # AI service durumunu kontrol et
        has_model = ai_service.model is not None
        has_vision_model = ai_service.vision_model is not None
        api_key_configured = settings.gemini_api_key is not None
        
        return {
            "status": "healthy" if has_model else "disabled",
            "models": {
                "text_model": "available" if has_model else "unavailable",
                "vision_model": "available" if has_vision_model else "unavailable"
            },
            "configuration": {
                "api_key_configured": api_key_configured,
                "api_key_length": len(settings.gemini_api_key) if settings.gemini_api_key else 0
            }
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }

@router.post("/process-description")
async def process_payment_description(
    description: str = Form(...),
    recipient_name: str = Form(...),
    amount: float = Form(...),
    current_user: User = Depends(get_current_user)
):
    """Ödeme açıklamasını AI ile işle"""
    try:
        result = await ai_service.process_payment_description(
            description=description,
            recipient_name=recipient_name,
            amount=amount
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI processing failed: {str(e)}"
        )

@router.post("/analyze-receipt")
async def analyze_receipt(
    file: UploadFile = File(...),
    payment_amount: Optional[float] = Form(None),
    current_user: User = Depends(get_current_user)
):
    """Dekont/fatura görselini AI ile analiz et"""
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
        payment_info = {"amount": payment_amount} if payment_amount else None
        result = await ai_service.analyze_receipt(temp_file_path, payment_info)

        # Geçici dosyayı sil
        try:
            os.remove(temp_file_path)
        except:
            pass

        return result

    except Exception as e:
        # Geçici dosyayı temizle
        try:
            os.remove(temp_file_path)
        except:
            pass
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Receipt analysis failed: {str(e)}"
        )

@router.post("/analyze-check")
async def analyze_check(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Çek görselini AI ile analiz et"""
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

    try:
        # Dosyayı geçici olarak kaydet
        file_extension = file.filename.split(".")[-1]
        temp_filename = f"temp_check_{int(datetime.utcnow().timestamp())}.{file_extension}"
        temp_file_path = os.path.join(settings.upload_dir, temp_filename)

        async with aiofiles.open(temp_file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)

        # AI analizi
        result = await ai_service.analyze_check(temp_file_path)

        # Geçici dosyayı sil
        try:
            os.remove(temp_file_path)
        except:
            pass

        return result

    except Exception as e:
        # Geçici dosyayı temizle
        try:
            os.remove(temp_file_path)
        except:
            pass
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Check analysis failed: {str(e)}"
        )

@router.post("/categorize")
async def categorize_expense(
    description: str = Form(...),
    recipient: str = Form(...),
    amount: float = Form(...),
    current_user: User = Depends(get_current_user)
):
    """Masrafı AI ile kategorize et"""
    try:
        category = await ai_service.categorize_expense(
            description=description,
            recipient=recipient,
            amount=amount
        )
        return {"category": category.value}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Categorization failed: {str(e)}"
        )

@router.post("/smart-categorization")
async def smart_expense_categorization(
    new_transaction: dict,
    current_user: User = Depends(get_current_user)
):
    """Geçmiş verilere dayalı akıllı kategorizasyon"""
    try:
        # Get user's transaction history
        from app.core.database import get_database
        db = get_database()
        
        # Fetch recent transactions for this user
        transactions_history = []
        async for tx in db.transactions.find(
            {"created_by": current_user.id}
        ).sort("created_at", -1).limit(50):
            transactions_history.append({
                "description": tx.get("description", ""),
                "recipient_name": tx.get("recipient_name", ""),
                "amount": tx.get("amount", 0),
                "category": tx.get("category", "")
            })
        
        result = await ai_service.smart_expense_categorization(
            transactions_history=transactions_history,
            new_transaction=new_transaction
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Smart categorization failed: {str(e)}"
        )

@router.get("/expense-predictions")
async def get_expense_predictions(
    current_user: User = Depends(get_current_user)
):
    """Aylık harcama tahminleri"""
    try:
        from app.core.database import get_database
        db = get_database()
        
        # Fetch transaction history
        transactions_history = []
        async for tx in db.transactions.find(
            {"created_by": current_user.id, "type": "expense"}
        ).sort("transaction_date", -1).limit(200):
            transactions_history.append({
                "transaction_date": tx.get("transaction_date", "").isoformat() if tx.get("transaction_date") else "",
                "amount": tx.get("amount", 0),
                "category": tx.get("category", ""),
                "description": tx.get("description", "")
            })
        
        result = await ai_service.predict_monthly_expenses(transactions_history)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction failed: {str(e)}"
        )

@router.get("/anomaly-detection")
async def detect_expense_anomalies(
    current_user: User = Depends(get_current_user)
):
    """Anormal harcama tespiti"""
    try:
        from app.core.database import get_database
        from datetime import datetime, timedelta
        db = get_database()
        
        # Fetch recent transactions (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recent_transactions = []
        async for tx in db.transactions.find({
            "created_by": current_user.id,
            "transaction_date": {"$gte": thirty_days_ago}
        }).sort("transaction_date", -1):
            recent_transactions.append({
                "id": str(tx["_id"]),
                "transaction_date": tx.get("transaction_date", "").isoformat() if tx.get("transaction_date") else "",
                "amount": tx.get("amount", 0),
                "category": tx.get("category", ""),
                "description": tx.get("description", ""),
                "recipient_name": tx.get("recipient_name", "")
            })
        
        result = await ai_service.detect_anomalies(recent_transactions)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Anomaly detection failed: {str(e)}"
        )

@router.get("/expense-insights")
async def get_expense_insights(
    time_period: str = "monthly",
    current_user: User = Depends(get_current_user)
):
    """Harcama analizi ve önerileri"""
    try:
        from app.core.database import get_database
        from datetime import datetime, timedelta
        db = get_database()
        
        # Determine date range based on time_period
        if time_period == "weekly":
            start_date = datetime.utcnow() - timedelta(days=7)
        elif time_period == "monthly":
            start_date = datetime.utcnow() - timedelta(days=30)
        elif time_period == "quarterly":
            start_date = datetime.utcnow() - timedelta(days=90)
        else:
            start_date = datetime.utcnow() - timedelta(days=30)
        
        # Fetch transactions for the period
        transactions = []
        async for tx in db.transactions.find({
            "created_by": current_user.id,
            "type": "expense",
            "transaction_date": {"$gte": start_date}
        }).sort("transaction_date", -1):
            transactions.append({
                "transaction_date": tx.get("transaction_date", "").isoformat() if tx.get("transaction_date") else "",
                "amount": tx.get("amount", 0),
                "category": tx.get("category", ""),
                "description": tx.get("description", ""),
                "recipient_name": tx.get("recipient_name", "")
            })
        
        result = await ai_service.generate_expense_insights(transactions, time_period)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Insights generation failed: {str(e)}"
        )

@router.get("/supplier-analysis")
async def get_supplier_analysis(
    current_user: User = Depends(get_current_user)
):
    """Tedarikçi analizi ve önerileri"""
    try:
        from app.core.database import get_database
        from datetime import datetime, timedelta
        db = get_database()
        
        # Fetch supplier-related transactions (last 6 months)
        six_months_ago = datetime.utcnow() - timedelta(days=180)
        transactions = []
        async for tx in db.transactions.find({
            "created_by": current_user.id,
            "type": "expense",
            "transaction_date": {"$gte": six_months_ago}
        }).sort("transaction_date", -1):
            transactions.append({
                "transaction_date": tx.get("transaction_date", "").isoformat() if tx.get("transaction_date") else "",
                "amount": tx.get("amount", 0),
                "category": tx.get("category", ""),
                "description": tx.get("description", ""),
                "recipient_name": tx.get("recipient_name", "")
            })
        
        result = await ai_service.smart_supplier_detection(transactions)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supplier analysis failed: {str(e)}"
        )