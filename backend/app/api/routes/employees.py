from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from typing import List, Optional
import os
import aiofiles
import logging
from datetime import datetime, timedelta
from bson import ObjectId

from app.models.user import User
from app.models.employee import (
    Employee, EmployeeCreate, EmployeeUpdate, EmployeeSummary, 
    EmployeeStatistics, EmployeeStatus, EmployeePosition,
    DocumentType, EmployeeDocument, AIProfileRequest, AIProfileResponse
)
from app.api.routes.auth import get_current_user
from app.core.database import get_database
from app.core.config import settings

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/", response_model=dict)
async def create_employee_draft(
    employee_data: EmployeeCreate,
    current_user: User = Depends(get_current_user)
):
    """Çalışan taslağı oluştur ve AI analizi için hazırla"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    try:
        from app.services.ai_service import ai_service
        
        # AI profil analizi isteği hazırla
        employee_dict = employee_data.dict()
        
        try:
            profile_summary = await ai_service.create_employee_profile_summary(employee_dict)
        except Exception as e:
            logger.error(f"AI profil analizi hatası: {e}")
            profile_summary = f"{employee_data.first_name} {employee_data.last_name} - {employee_data.position} pozisyonunda çalışan personel."
        
        # Temsili avatar URL'i oluştur (şimdilik basit bir placeholder)
        avatar_url = f"https://ui-avatars.com/api/?name={employee_data.first_name}+{employee_data.last_name}&background=random&size=200"
        
        # Taslağı döndür (henüz veritabanına kaydetme)
        draft_employee = {
            "employee_data": employee_dict,
            "ai_analysis": {
                "profile_summary": profile_summary,
                "avatar_url": avatar_url,
                "analysis_date": datetime.utcnow().isoformat(),
                "confidence_score": 0.8
            }
        }
        
        return {
            "success": True,
            "draft": draft_employee,
            "message": "AI analizi tamamlandı. Lütfen bilgileri kontrol edin."
        }
        
    except Exception as e:
        logger.error(f"Çalışan taslağı oluşturma hatası: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Çalışan taslağı oluşturulurken hata: {str(e)}"
        )

@router.post("/confirm", response_model=Employee)
async def confirm_and_create_employee(
    draft_data: dict,
    current_user: User = Depends(get_current_user)
):
    """AI analizini onaylayıp çalışanı veritabanına kaydet"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    try:
        db = get_database()
        
        employee_data = draft_data.get("employee_data", {})
        ai_analysis = draft_data.get("ai_analysis", {})
        
        # TC Kimlik numarası kontrolü
        existing_employee = await db.employees.find_one({
            "tc_number": employee_data.get("tc_number")
        })
        
        if existing_employee:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bu TC kimlik numarasına sahip çalışan zaten mevcut"
            )
        
        now = datetime.utcnow()
        
        # Çalışan kaydını oluştur
        employee_dict = {
            **employee_data,
            "status": EmployeeStatus.ACTIVE,
            "documents": [],
            "ai_profile_summary": ai_analysis.get("profile_summary"),
            "ai_generated_avatar": ai_analysis.get("avatar_url"),
            "ai_analysis_date": now,
            "created_at": now,
            "updated_at": now,
            "created_by": current_user.id
        }
        
        # Tarihleri datetime objelerine çevir
        if isinstance(employee_dict.get("birth_date"), str):
            employee_dict["birth_date"] = datetime.fromisoformat(employee_dict["birth_date"])
        if isinstance(employee_dict.get("hire_date"), str):
            employee_dict["hire_date"] = datetime.fromisoformat(employee_dict["hire_date"])
        
        result = await db.employees.insert_one(employee_dict)
        
        # Oluşturulan çalışanı getir
        created_employee = await db.employees.find_one({"_id": result.inserted_id})
        created_employee["id"] = str(created_employee["_id"])
        del created_employee["_id"]
        
        return Employee(**created_employee)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Çalışan kaydetme hatası: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Çalışan kaydedilirken hata: {str(e)}"
        )

@router.get("/", response_model=List[EmployeeSummary])
async def get_employees(
    status_filter: Optional[EmployeeStatus] = None,
    position_filter: Optional[EmployeePosition] = None,
    department_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Çalışanları listele"""
    try:
        db = get_database()
        
        # Filtre oluştur
        query = {}
        if status_filter:
            query["status"] = status_filter
        if position_filter:
            query["position"] = position_filter
        if department_filter:
            query["department"] = department_filter
        
        employees = []
        cursor = db.employees.find(query).sort("hire_date", -1)
        
        async for employee in cursor:
            full_name = f"{employee.get('first_name', '')} {employee.get('last_name', '')}"
            
            summary = EmployeeSummary(
                id=str(employee["_id"]),
                first_name=employee.get("first_name", ""),
                last_name=employee.get("last_name", ""),
                full_name=full_name,
                position=employee.get("position", EmployeePosition.OTHER),
                department=employee.get("department", ""),
                status=employee.get("status", EmployeeStatus.ACTIVE),
                hire_date=employee.get("hire_date"),
                salary=employee.get("salary", 0),
                phone=employee.get("phone", ""),
                has_avatar=bool(employee.get("ai_generated_avatar")),
                document_count=len(employee.get("documents", []))
            )
            employees.append(summary)
        
        return employees
        
    except Exception as e:
        logger.error(f"Çalışanlar listelenirken hata: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Çalışanlar listelenirken hata: {str(e)}"
        )

@router.get("/statistics", response_model=EmployeeStatistics)
async def get_employee_statistics(
    current_user: User = Depends(get_current_user)
):
    """Çalışan istatistiklerini getir"""
    try:
        db = get_database()
        
        # Toplam çalışan sayıları
        total_employees = await db.employees.count_documents({})
        active_employees = await db.employees.count_documents({"status": EmployeeStatus.ACTIVE})
        inactive_employees = await db.employees.count_documents({"status": EmployeeStatus.INACTIVE})
        probation_employees = await db.employees.count_documents({"status": EmployeeStatus.PROBATION})
        
        # Maaş istatistikleri
        salary_pipeline = [
            {"$match": {"status": EmployeeStatus.ACTIVE}},
            {"$group": {
                "_id": None,
                "total_salary": {"$sum": "$salary"},
                "avg_salary": {"$avg": "$salary"}
            }}
        ]
        
        salary_result = await db.employees.aggregate(salary_pipeline).to_list(1)
        total_monthly_salary = salary_result[0]["total_salary"] if salary_result else 0
        average_salary = salary_result[0]["avg_salary"] if salary_result else 0
        
        # Departman dağılımı
        dept_pipeline = [
            {"$group": {"_id": "$department", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        
        dept_cursor = db.employees.aggregate(dept_pipeline)
        departments = {}
        async for dept in dept_cursor:
            departments[dept["_id"]] = dept["count"]
        
        # Pozisyon dağılımı
        pos_pipeline = [
            {"$group": {"_id": "$position", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        
        pos_cursor = db.employees.aggregate(pos_pipeline)
        positions = {}
        async for pos in pos_cursor:
            positions[pos["_id"]] = pos["count"]
        
        # Son işe alınanlar (son 30 gün)
        recent_hires = []
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        
        recent_cursor = db.employees.find({
            "hire_date": {"$gte": thirty_days_ago}
        }).sort("hire_date", -1).limit(5)
        
        async for employee in recent_cursor:
            full_name = f"{employee.get('first_name', '')} {employee.get('last_name', '')}"
            
            summary = EmployeeSummary(
                id=str(employee["_id"]),
                first_name=employee.get("first_name", ""),
                last_name=employee.get("last_name", ""),
                full_name=full_name,
                position=employee.get("position", EmployeePosition.OTHER),
                department=employee.get("department", ""),
                status=employee.get("status", EmployeeStatus.ACTIVE),
                hire_date=employee.get("hire_date"),
                salary=employee.get("salary", 0),
                phone=employee.get("phone", ""),
                has_avatar=bool(employee.get("ai_generated_avatar")),
                document_count=len(employee.get("documents", []))
            )
            recent_hires.append(summary)
        
        return EmployeeStatistics(
            total_employees=total_employees,
            active_employees=active_employees,
            inactive_employees=inactive_employees,
            probation_employees=probation_employees,
            total_monthly_salary=total_monthly_salary,
            average_salary=average_salary,
            departments=departments,
            positions=positions,
            recent_hires=recent_hires
        )
        
    except Exception as e:
        logger.error(f"İstatistikler hesaplanırken hata: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"İstatistikler hesaplanırken hata: {str(e)}"
        )

@router.get("/{employee_id}", response_model=Employee)
async def get_employee(
    employee_id: str,
    current_user: User = Depends(get_current_user)
):
    """Tek bir çalışanın detaylarını getir"""
    try:
        db = get_database()
        
        if not ObjectId.is_valid(employee_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Geçersiz çalışan ID"
            )
        
        employee = await db.employees.find_one({"_id": ObjectId(employee_id)})
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Çalışan bulunamadı"
            )
        
        employee["id"] = str(employee["_id"])
        del employee["_id"]
        
        return Employee(**employee)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Çalışan detayları getirilirken hata: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Çalışan detayları getirilirken hata: {str(e)}"
        )

@router.put("/{employee_id}", response_model=Employee)
async def update_employee(
    employee_id: str,
    employee_update: EmployeeUpdate,
    current_user: User = Depends(get_current_user)
):
    """Çalışan bilgilerini güncelle"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    try:
        db = get_database()
        
        if not ObjectId.is_valid(employee_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Geçersiz çalışan ID"
            )
        
        employee = await db.employees.find_one({"_id": ObjectId(employee_id)})
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Çalışan bulunamadı"
            )
        
        # Güncelleme verilerini hazırla
        update_data = employee_update.dict(exclude_unset=True)
        if update_data:
            update_data["updated_at"] = datetime.utcnow()
            
            await db.employees.update_one(
                {"_id": ObjectId(employee_id)},
                {"$set": update_data}
            )
        
        # Güncellenmiş çalışanı getir
        updated_employee = await db.employees.find_one({"_id": ObjectId(employee_id)})
        updated_employee["id"] = str(updated_employee["_id"])
        del updated_employee["_id"]
        
        return Employee(**updated_employee)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Çalışan güncellenirken hata: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Çalışan güncellenirken hata: {str(e)}"
        )

@router.post("/{employee_id}/documents")
async def upload_employee_document(
    employee_id: str,
    document_type: DocumentType = Form(...),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Çalışan belgesi yükle"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    try:
        db = get_database()
        
        if not ObjectId.is_valid(employee_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Geçersiz çalışan ID"
            )
        
        employee = await db.employees.find_one({"_id": ObjectId(employee_id)})
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Çalışan bulunamadı"
            )
        
        # Dosya kontrolü
        allowed_types = ["image/jpeg", "image/png", "image/jpg", "application/pdf"]
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sadece JPG, PNG ve PDF dosyaları desteklenir"
            )
        
        if file.size > 10 * 1024 * 1024:  # 10MB
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dosya boyutu 10MB'dan büyük olamaz"
            )
        
        # Dosyayı kaydet
        file_extension = file.filename.split(".")[-1]
        filename = f"employee_{employee_id}_{document_type}_{int(datetime.utcnow().timestamp())}.{file_extension}"
        file_path = os.path.join("uploads/employee_documents", filename)
        
        # Klasörü oluştur
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        # Belge kaydını oluştur
        document = EmployeeDocument(
            type=document_type,
            filename=filename,
            file_path=file_path,
            upload_date=datetime.utcnow(),
            description=description
        )
        
        # Çalışan belgelerine ekle
        await db.employees.update_one(
            {"_id": ObjectId(employee_id)},
            {
                "$push": {"documents": document.dict()},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        return {"message": "Belge başarıyla yüklendi", "filename": filename}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Belge yüklenirken hata: {e}")
        # Hata durumunda dosyayı sil
        try:
            if 'file_path' in locals():
                os.remove(file_path)
        except:
            pass
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Belge yüklenirken hata: {str(e)}"
        )

@router.put("/{employee_id}/status")
async def update_employee_status(
    employee_id: str,
    status: EmployeeStatus,
    current_user: User = Depends(get_current_user)
):
    """Çalışan durumunu güncelle (aktif/pasif)"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    try:
        db = get_database()
        
        if not ObjectId.is_valid(employee_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Geçersiz çalışan ID"
            )
        
        employee = await db.employees.find_one({"_id": ObjectId(employee_id)})
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Çalışan bulunamadı"
            )
        
        await db.employees.update_one(
            {"_id": ObjectId(employee_id)},
            {
                "$set": {
                    "status": status,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        status_text = {
            EmployeeStatus.ACTIVE: "aktif",
            EmployeeStatus.INACTIVE: "pasif",
            EmployeeStatus.PROBATION: "deneme"
        }
        
        return {
            "message": f"Çalışan durumu {status_text[status]} olarak güncellendi",
            "employee_id": employee_id,
            "new_status": status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Çalışan durumu güncellenirken hata: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Çalışan durumu güncellenirken hata: {str(e)}"
        )

@router.get("/{employee_id}/documents/{filename}")
async def get_employee_document(
    employee_id: str,
    filename: str,
    token: Optional[str] = None,
    current_user: Optional[User] = None
):
    """Çalışan belgesini indir"""
    # Token ile authentication kontrolü
    if not current_user and token:
        from jose import JWTError, jwt
        from app.core.config import settings
        try:
            payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
            username: str = payload.get("sub")
            if username is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Geçersiz token"
                )
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token doğrulanamadı"
            )
    elif not current_user and not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Yetkilendirme gerekli"
        )
    
    try:
        db = get_database()
        
        if not ObjectId.is_valid(employee_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Geçersiz çalışan ID"
            )
        
        employee = await db.employees.find_one({"_id": ObjectId(employee_id)})
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Çalışan bulunamadı"
            )
        
        # Belgeyi kontrol et
        document = None
        for doc in employee.get("documents", []):
            if doc.get("filename") == filename:
                document = doc
                break
        
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Belge bulunamadı"
            )
        
        file_path = document.get("file_path")
        if not os.path.exists(file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dosya sistemde bulunamadı"
            )
        
        # Dosya tipini belirle
        file_extension = filename.split(".")[-1].lower()
        content_type = "application/octet-stream"
        
        if file_extension in ["jpg", "jpeg"]:
            content_type = "image/jpeg"
        elif file_extension == "png":
            content_type = "image/png"
        elif file_extension == "pdf":
            content_type = "application/pdf"
        
        from fastapi.responses import FileResponse
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type=content_type
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Belge indirme hatası: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Belge indirilirken hata: {str(e)}"
        )

@router.delete("/{employee_id}/documents/{filename}")
async def delete_employee_document(
    employee_id: str,
    filename: str,
    current_user: User = Depends(get_current_user)
):
    """Çalışan belgesini sil"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    try:
        db = get_database()
        
        if not ObjectId.is_valid(employee_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Geçersiz çalışan ID"
            )
        
        employee = await db.employees.find_one({"_id": ObjectId(employee_id)})
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Çalışan bulunamadı"
            )
        
        # Belgeyi bul ve sil
        document_to_remove = None
        for doc in employee.get("documents", []):
            if doc.get("filename") == filename:
                document_to_remove = doc
                break
        
        if not document_to_remove:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Belge bulunamadı"
            )
        
        # Dosyayı sil
        file_path = document_to_remove.get("file_path")
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                logger.error(f"Dosya silinirken hata: {e}")
        
        # Veritabanından belgeyi kaldır
        await db.employees.update_one(
            {"_id": ObjectId(employee_id)},
            {
                "$pull": {"documents": {"filename": filename}},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        return {"message": "Belge başarıyla silindi"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Belge silinirken hata: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Belge silinirken hata: {str(e)}"
        )

@router.delete("/{employee_id}")
async def delete_employee(
    employee_id: str,
    current_user: User = Depends(get_current_user)
):
    """Çalışanı sil"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    
    try:
        db = get_database()
        
        if not ObjectId.is_valid(employee_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Geçersiz çalışan ID"
            )
        
        employee = await db.employees.find_one({"_id": ObjectId(employee_id)})
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Çalışan bulunamadı"
            )
        
        # Belgelerini sil
        for document in employee.get("documents", []):
            try:
                if os.path.exists(document["file_path"]):
                    os.remove(document["file_path"])
            except:
                pass
        
        # Çalışanı sil
        await db.employees.delete_one({"_id": ObjectId(employee_id)})
        
        return {"message": "Çalışan başarıyla silindi"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Çalışan silinirken hata: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Çalışan silinirken hata: {str(e)}"
        )