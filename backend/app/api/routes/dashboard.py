from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any
from bson import ObjectId
from datetime import datetime

from app.models.user import User
from app.models.dashboard import (
    DashboardLayout, DashboardLayoutSummary, DashboardLayoutCreate, DashboardLayoutUpdate,
    DashboardWidget, DashboardWidgetCreate, DashboardWidgetUpdate,
    WidgetType, DEFAULT_DASHBOARD_LAYOUT
)
from app.api.routes.auth import get_current_user
from app.core.database import get_database

router = APIRouter()

@router.get("/layouts", response_model=List[DashboardLayoutSummary])
async def get_user_dashboard_layouts(
    current_user: User = Depends(get_current_user)
):
    """Kullanıcının dashboard layout'larını listele"""
    try:
        db = get_database()
        layouts = []
        
        async for layout_doc in db.dashboard_layouts.find({"user_id": current_user.id}):
            layouts.append(DashboardLayoutSummary(
                id=str(layout_doc["_id"]),
                name=layout_doc["name"],
                is_default=layout_doc.get("is_default", False),
                widget_count=len(layout_doc.get("widgets", [])),
                created_at=layout_doc["created_at"],
                updated_at=layout_doc["updated_at"]
            ))
        
        return layouts
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Layout listesi alınırken hata: {str(e)}"
        )

@router.get("/layouts/{layout_id}", response_model=DashboardLayout)
async def get_dashboard_layout(
    layout_id: str,
    current_user: User = Depends(get_current_user)
):
    """Belirli bir dashboard layout'unu getir"""
    try:
        db = get_database()
        layout_doc = await db.dashboard_layouts.find_one({
            "_id": ObjectId(layout_id),
            "user_id": current_user.id
        })
        
        if not layout_doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dashboard layout bulunamadı"
            )
        
        layout_doc["id"] = str(layout_doc["_id"])
        return DashboardLayout(**layout_doc)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Layout getirilirken hata: {str(e)}"
        )

@router.get("/layouts/default", response_model=DashboardLayout)
async def get_default_dashboard_layout(
    current_user: User = Depends(get_current_user)
):
    """Kullanıcının varsayılan dashboard layout'unu getir"""
    try:
        db = get_database()
        
        # Varsayılan layout'u ara
        layout_doc = await db.dashboard_layouts.find_one({
            "user_id": current_user.id,
            "is_default": True
        })
        
        # Eğer varsayılan layout yoksa oluştur
        if not layout_doc:
            default_layout = DashboardLayoutCreate(**DEFAULT_DASHBOARD_LAYOUT)
            layout = DashboardLayout(
                user_id=current_user.id,
                **default_layout.dict()
            )
            
            result = await db.dashboard_layouts.insert_one(layout.dict(by_alias=True))
            layout.id = str(result.inserted_id)
            return layout
        
        layout_doc["id"] = str(layout_doc["_id"])
        return DashboardLayout(**layout_doc)
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Varsayılan layout getirilirken hata: {str(e)}"
        )

@router.post("/layouts", response_model=DashboardLayout)
async def create_dashboard_layout(
    layout_data: DashboardLayoutCreate,
    current_user: User = Depends(get_current_user)
):
    """Yeni dashboard layout oluştur"""
    try:
        db = get_database()
        
        layout = DashboardLayout(
            user_id=current_user.id,
            **layout_data.dict()
        )
        
        result = await db.dashboard_layouts.insert_one(layout.dict(by_alias=True))
        layout.id = str(result.inserted_id)
        
        return layout
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Layout oluşturulurken hata: {str(e)}"
        )

@router.put("/layouts/{layout_id}", response_model=DashboardLayout)
async def update_dashboard_layout(
    layout_id: str,
    layout_data: DashboardLayoutUpdate,
    current_user: User = Depends(get_current_user)
):
    """Dashboard layout'unu güncelle"""
    try:
        db = get_database()
        
        # Layout'un varlığını ve kullanıcıya ait olduğunu kontrol et
        existing_layout = await db.dashboard_layouts.find_one({
            "_id": ObjectId(layout_id),
            "user_id": current_user.id
        })
        
        if not existing_layout:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dashboard layout bulunamadı"
            )
        
        # Güncelleme verilerini hazırla
        update_data = {k: v for k, v in layout_data.dict().items() if v is not None}
        update_data["updated_at"] = datetime.utcnow()
        
        # Eğer bu layout varsayılan yapılıyorsa, diğerlerini varsayılan olmaktan çıkar
        if update_data.get("is_default"):
            await db.dashboard_layouts.update_many(
                {"user_id": current_user.id, "_id": {"$ne": ObjectId(layout_id)}},
                {"$set": {"is_default": False}}
            )
        
        # Layout'u güncelle
        await db.dashboard_layouts.update_one(
            {"_id": ObjectId(layout_id)},
            {"$set": update_data}
        )
        
        # Güncellenmiş layout'u getir
        updated_layout = await db.dashboard_layouts.find_one({"_id": ObjectId(layout_id)})
        updated_layout["id"] = str(updated_layout["_id"])
        
        return DashboardLayout(**updated_layout)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Layout güncellenirken hata: {str(e)}"
        )

@router.delete("/layouts/{layout_id}")
async def delete_dashboard_layout(
    layout_id: str,
    current_user: User = Depends(get_current_user)
):
    """Dashboard layout'unu sil"""
    try:
        db = get_database()
        
        # Layout'un varlığını kontrol et
        existing_layout = await db.dashboard_layouts.find_one({
            "_id": ObjectId(layout_id),
            "user_id": current_user.id
        })
        
        if not existing_layout:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dashboard layout bulunamadı"
            )
        
        # Varsayılan layout silinmeye çalışılıyorsa engelle
        if existing_layout.get("is_default"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Varsayılan layout silinemez"
            )
        
        # Layout'u sil
        await db.dashboard_layouts.delete_one({"_id": ObjectId(layout_id)})
        
        return {"message": "Dashboard layout başarıyla silindi"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Layout silinirken hata: {str(e)}"
        )

@router.post("/layouts/{layout_id}/widgets", response_model=DashboardWidget)
async def add_widget_to_layout(
    layout_id: str,
    widget_data: DashboardWidgetCreate,
    current_user: User = Depends(get_current_user)
):
    """Layout'a yeni widget ekle"""
    try:
        db = get_database()
        
        # Layout'un varlığını kontrol et
        layout = await db.dashboard_layouts.find_one({
            "_id": ObjectId(layout_id),
            "user_id": current_user.id
        })
        
        if not layout:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dashboard layout bulunamadı"
            )
        
        # Yeni widget oluştur
        new_widget = DashboardWidget(**widget_data.dict())
        
        # Widget'ı layout'a ekle
        await db.dashboard_layouts.update_one(
            {"_id": ObjectId(layout_id)},
            {
                "$push": {"widgets": new_widget.dict()},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        return new_widget
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Widget eklenirken hata: {str(e)}"
        )

@router.put("/layouts/{layout_id}/widgets/{widget_id}", response_model=DashboardWidget)
async def update_widget_in_layout(
    layout_id: str,
    widget_id: str,
    widget_data: DashboardWidgetUpdate,
    current_user: User = Depends(get_current_user)
):
    """Layout'taki widget'ı güncelle"""
    try:
        db = get_database()
        
        # Layout'u getir
        layout = await db.dashboard_layouts.find_one({
            "_id": ObjectId(layout_id),
            "user_id": current_user.id
        })
        
        if not layout:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dashboard layout bulunamadı"
            )
        
        # Widget'ı bul ve güncelle
        widgets = layout.get("widgets", [])
        widget_found = False
        
        for widget in widgets:
            if widget["id"] == widget_id:
                widget_found = True
                # Güncelleme verilerini uygula
                update_data = {k: v for k, v in widget_data.dict().items() if v is not None}
                widget.update(update_data)
                widget["updated_at"] = datetime.utcnow()
                break
        
        if not widget_found:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Widget bulunamadı"
            )
        
        # Layout'u güncelle
        await db.dashboard_layouts.update_one(
            {"_id": ObjectId(layout_id)},
            {
                "$set": {
                    "widgets": widgets,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        # Güncellenmiş widget'ı döndür
        updated_widget = next(w for w in widgets if w["id"] == widget_id)
        return DashboardWidget(**updated_widget)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Widget güncellenirken hata: {str(e)}"
        )

@router.delete("/layouts/{layout_id}/widgets/{widget_id}")
async def remove_widget_from_layout(
    layout_id: str,
    widget_id: str,
    current_user: User = Depends(get_current_user)
):
    """Layout'tan widget'ı kaldır"""
    try:
        db = get_database()
        
        # Widget'ı layout'tan kaldır
        result = await db.dashboard_layouts.update_one(
            {
                "_id": ObjectId(layout_id),
                "user_id": current_user.id
            },
            {
                "$pull": {"widgets": {"id": widget_id}},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dashboard layout bulunamadı"
            )
        
        return {"message": "Widget başarıyla kaldırıldı"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Widget kaldırılırken hata: {str(e)}"
        )

@router.put("/layouts/{layout_id}/widgets/positions")
async def update_widget_positions(
    layout_id: str,
    widget_positions: Dict[str, Dict[str, int]],  # widget_id -> {x, y}
    current_user: User = Depends(get_current_user)
):
    """Birden fazla widget pozisyonunu güncelle (sürükle-bırak için)"""
    try:
        db = get_database()
        
        # Layout'u getir
        layout = await db.dashboard_layouts.find_one({
            "_id": ObjectId(layout_id),
            "user_id": current_user.id
        })
        
        if not layout:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dashboard layout bulunamadı"
            )
        
        # Widget pozisyonlarını güncelle
        widgets = layout.get("widgets", [])
        
        for widget in widgets:
            widget_id = widget["id"]
            if widget_id in widget_positions:
                widget["position"] = widget_positions[widget_id]
                widget["updated_at"] = datetime.utcnow()
        
        # Layout'u kaydet
        await db.dashboard_layouts.update_one(
            {"_id": ObjectId(layout_id)},
            {
                "$set": {
                    "widgets": widgets,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        return {"message": "Widget pozisyonları güncellendi"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Widget pozisyonları güncellenirken hata: {str(e)}"
        )

@router.get("/available-widgets")
async def get_available_widget_types(
    current_user: User = Depends(get_current_user)
):
    """Kullanılabilir widget türlerini listele"""
    widget_types = []
    
    for widget_type in WidgetType:
        widget_info = {
            "type": widget_type.value,
            "name": _get_widget_display_name(widget_type),
            "description": _get_widget_description(widget_type),
            "default_size": _get_widget_default_size(widget_type),
            "available_sizes": _get_widget_available_sizes(widget_type),
            "category": _get_widget_category(widget_type)
        }
        widget_types.append(widget_info)
    
    return widget_types

def _get_widget_display_name(widget_type: WidgetType) -> str:
    """Widget görüntüleme adını döndür"""
    names = {
        WidgetType.BALANCE_OVERVIEW: "Bakiye Özeti",
        WidgetType.RECENT_TRANSACTIONS: "Son İşlemler",
        WidgetType.PAYMENT_ORDERS: "Ödeme Emirleri",
        WidgetType.EXPENSE_CHART: "Harcama Grafiği",
        WidgetType.INCOME_CHART: "Gelir Grafiği",
        WidgetType.AI_INSIGHTS: "AI Öngörüleri",
        WidgetType.NOTIFICATIONS: "Bildirimler",
        WidgetType.QUICK_ACTIONS: "Hızlı İşlemler",
        WidgetType.PERFORMANCE_METRICS: "Performans Metrikleri",
        WidgetType.UPCOMING_PAYMENTS: "Yaklaşan Ödemeler",
        WidgetType.CATEGORY_BREAKDOWN: "Kategori Dağılımı",
        WidgetType.BANK_ACCOUNTS: "Banka Hesapları"
    }
    return names.get(widget_type, widget_type.value)

def _get_widget_description(widget_type: WidgetType) -> str:
    """Widget açıklamasını döndür"""
    descriptions = {
        WidgetType.BALANCE_OVERVIEW: "Tüm hesaplarınızın bakiye özeti",
        WidgetType.RECENT_TRANSACTIONS: "En son yapılan işlemler",
        WidgetType.PAYMENT_ORDERS: "Bekleyen ve tamamlanan ödeme emirleri",
        WidgetType.EXPENSE_CHART: "Harcamalarınızın grafik analizi",
        WidgetType.INCOME_CHART: "Gelirlerinizin grafik analizi",
        WidgetType.AI_INSIGHTS: "AI destekli öngörüler ve öneriler",
        WidgetType.NOTIFICATIONS: "Sistem bildirimleri",
        WidgetType.QUICK_ACTIONS: "Sık kullanılan işlemlere hızlı erişim",
        WidgetType.PERFORMANCE_METRICS: "Mali performans göstergeleri",
        WidgetType.UPCOMING_PAYMENTS: "Yaklaşan ödeme vadesi olan işlemler",
        WidgetType.CATEGORY_BREAKDOWN: "Harcamaların kategori bazlı dağılımı",
        WidgetType.BANK_ACCOUNTS: "Banka hesapları özeti"
    }
    return descriptions.get(widget_type, "")

def _get_widget_default_size(widget_type: WidgetType) -> str:
    """Widget varsayılan boyutunu döndür"""
    from app.models.dashboard import WidgetSize
    
    default_sizes = {
        WidgetType.BALANCE_OVERVIEW: WidgetSize.MEDIUM,
        WidgetType.RECENT_TRANSACTIONS: WidgetSize.MEDIUM,
        WidgetType.PAYMENT_ORDERS: WidgetSize.MEDIUM,
        WidgetType.EXPENSE_CHART: WidgetSize.LARGE,
        WidgetType.INCOME_CHART: WidgetSize.LARGE,
        WidgetType.AI_INSIGHTS: WidgetSize.LARGE,
        WidgetType.NOTIFICATIONS: WidgetSize.SMALL,
        WidgetType.QUICK_ACTIONS: WidgetSize.WIDE,
        WidgetType.PERFORMANCE_METRICS: WidgetSize.WIDE,
        WidgetType.UPCOMING_PAYMENTS: WidgetSize.MEDIUM,
        WidgetType.CATEGORY_BREAKDOWN: WidgetSize.MEDIUM,
        WidgetType.BANK_ACCOUNTS: WidgetSize.MEDIUM
    }
    return default_sizes.get(widget_type, WidgetSize.MEDIUM).value

def _get_widget_available_sizes(widget_type: WidgetType) -> List[str]:
    """Widget için uygun boyutları döndür"""
    from app.models.dashboard import WidgetSize
    
    # Her widget türü için uygun boyutlar
    size_mappings = {
        WidgetType.BALANCE_OVERVIEW: [WidgetSize.MEDIUM, WidgetSize.LARGE],
        WidgetType.RECENT_TRANSACTIONS: [WidgetSize.MEDIUM, WidgetSize.LARGE, WidgetSize.WIDE],
        WidgetType.PAYMENT_ORDERS: [WidgetSize.MEDIUM, WidgetSize.LARGE],
        WidgetType.EXPENSE_CHART: [WidgetSize.LARGE, WidgetSize.EXTRA_LARGE],
        WidgetType.INCOME_CHART: [WidgetSize.LARGE, WidgetSize.EXTRA_LARGE],
        WidgetType.AI_INSIGHTS: [WidgetSize.LARGE, WidgetSize.EXTRA_LARGE],
        WidgetType.NOTIFICATIONS: [WidgetSize.SMALL, WidgetSize.MEDIUM],
        WidgetType.QUICK_ACTIONS: [WidgetSize.WIDE, WidgetSize.EXTRA_LARGE],
        WidgetType.PERFORMANCE_METRICS: [WidgetSize.MEDIUM, WidgetSize.WIDE],
        WidgetType.UPCOMING_PAYMENTS: [WidgetSize.MEDIUM, WidgetSize.LARGE],
        WidgetType.CATEGORY_BREAKDOWN: [WidgetSize.MEDIUM, WidgetSize.LARGE],
        WidgetType.BANK_ACCOUNTS: [WidgetSize.MEDIUM, WidgetSize.LARGE]
    }
    
    sizes = size_mappings.get(widget_type, [WidgetSize.MEDIUM])
    return [size.value for size in sizes]

def _get_widget_category(widget_type: WidgetType) -> str:
    """Widget kategorisini döndür"""
    categories = {
        WidgetType.BALANCE_OVERVIEW: "Finansal",
        WidgetType.RECENT_TRANSACTIONS: "İşlemler",
        WidgetType.PAYMENT_ORDERS: "İşlemler",
        WidgetType.EXPENSE_CHART: "Analiz",
        WidgetType.INCOME_CHART: "Analiz",
        WidgetType.AI_INSIGHTS: "AI",
        WidgetType.NOTIFICATIONS: "Sistem",
        WidgetType.QUICK_ACTIONS: "Navigasyon",
        WidgetType.PERFORMANCE_METRICS: "Analiz",
        WidgetType.UPCOMING_PAYMENTS: "Planlama",
        WidgetType.CATEGORY_BREAKDOWN: "Analiz",
        WidgetType.BANK_ACCOUNTS: "Finansal"
    }
    return categories.get(widget_type, "Genel")