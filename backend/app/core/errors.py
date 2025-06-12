# -*- coding: utf-8 -*-
"""
Standart hata mesajları ve exception handling
"""
from fastapi import HTTPException, status
from typing import Optional


class StandardErrors:
    """Standart hata mesajları"""
    
    # Authentication & Authorization
    INVALID_CREDENTIALS = "Geçersiz kullanıcı adı veya şifre"
    INSUFFICIENT_PERMISSIONS = "Bu işlem için yeterli yetkiniz yok"
    ADMIN_REQUIRED = "Bu işlem için admin yetkisi gerekli"
    TOKEN_EXPIRED = "Oturum süresi dolmuş, lütfen tekrar giriş yapın"
    TOKEN_INVALID = "Geçersiz oturum bilgisi"
    
    # Validation Errors
    INVALID_ID = "Geçersiz ID formatı"
    INVALID_OBJECT_ID = "Geçersiz kayıt ID"
    INVALID_EMAIL = "Geçersiz e-posta adresi"
    INVALID_PHONE = "Geçersiz telefon numarası"
    INVALID_IBAN = "Geçersiz IBAN numarası"
    INVALID_DATE = "Geçersiz tarih formatı"
    INVALID_AMOUNT = "Geçersiz tutar"
    INVALID_CURRENCY = "Geçersiz para birimi"
    
    # Not Found Errors
    USER_NOT_FOUND = "Kullanıcı bulunamadı"
    ACCOUNT_NOT_FOUND = "Hesap bulunamadı"
    PAYMENT_ORDER_NOT_FOUND = "Ödeme emri bulunamadı"
    TRANSACTION_NOT_FOUND = "İşlem bulunamadı"
    PERSON_NOT_FOUND = "Kişi/kurum bulunamadı"
    DEBT_NOT_FOUND = "Borç kaydı bulunamadı"
    CHECK_NOT_FOUND = "Çek bulunamadı"
    CREDIT_CARD_NOT_FOUND = "Kredi kartı bulunamadı"
    INCOME_SOURCE_NOT_FOUND = "Gelir kaynağı bulunamadı"
    INCOME_RECORD_NOT_FOUND = "Gelir kaydı bulunamadı"
    
    # Conflict Errors
    EMAIL_ALREADY_EXISTS = "Bu e-posta adresi zaten kullanımda"
    USERNAME_ALREADY_EXISTS = "Bu kullanıcı adı zaten kullanımda"
    ACCOUNT_ALREADY_EXISTS = "Bu hesap zaten mevcut"
    DUPLICATE_ENTRY = "Bu kayıt zaten mevcut"
    
    # Business Logic Errors
    INSUFFICIENT_BALANCE = "Yetersiz hesap bakiyesi"
    PAYMENT_ALREADY_COMPLETED = "Bu ödeme zaten tamamlanmış"
    PAYMENT_ALREADY_APPROVED = "Bu ödeme emri zaten onaylanmış"
    PAYMENT_ALREADY_REJECTED = "Bu ödeme emri zaten reddedilmiş"
    CANNOT_DELETE_USED_RECORD = "Bu kayıt kullanımda olduğu için silinemez"
    DEADLINE_PASSED = "Vade tarihi geçmiş"
    INVALID_STATUS_TRANSITION = "Geçersiz durum değişikliği"
    
    # File Upload Errors
    FILE_TOO_LARGE = "Dosya boyutu çok büyük (maksimum 10MB)"
    INVALID_FILE_TYPE = "Geçersiz dosya türü"
    UPLOAD_FAILED = "Dosya yükleme başarısız"
    FILE_NOT_FOUND = "Dosya bulunamadı"
    
    # Database Errors
    DATABASE_ERROR = "Veritabanı hatası"
    CONNECTION_ERROR = "Bağlantı hatası"
    
    # General Errors
    INTERNAL_ERROR = "İç sistem hatası"
    VALIDATION_ERROR = "Veri doğrulama hatası"
    MISSING_REQUIRED_FIELD = "Zorunlu alan eksik"
    OPERATION_FAILED = "İşlem başarısız"


def raise_http_exception(
    status_code: int,
    message: str,
    headers: Optional[dict] = None
) -> None:
    """Standart HTTP exception fırlat"""
    raise HTTPException(
        status_code=status_code,
        detail=message,
        headers=headers
    )


def raise_bad_request(message: str = StandardErrors.VALIDATION_ERROR) -> None:
    """400 Bad Request hatası fırlat"""
    raise_http_exception(status.HTTP_400_BAD_REQUEST, message)


def raise_unauthorized(message: str = StandardErrors.INVALID_CREDENTIALS) -> None:
    """401 Unauthorized hatası fırlat"""
    raise_http_exception(status.HTTP_401_UNAUTHORIZED, message)


def raise_forbidden(message: str = StandardErrors.INSUFFICIENT_PERMISSIONS) -> None:
    """403 Forbidden hatası fırlat"""
    raise_http_exception(status.HTTP_403_FORBIDDEN, message)


def raise_not_found(message: str) -> None:
    """404 Not Found hatası fırlat"""
    raise_http_exception(status.HTTP_404_NOT_FOUND, message)


def raise_conflict(message: str = StandardErrors.DUPLICATE_ENTRY) -> None:
    """409 Conflict hatası fırlat"""
    raise_http_exception(status.HTTP_409_CONFLICT, message)


def raise_internal_error(message: str = StandardErrors.INTERNAL_ERROR) -> None:
    """500 Internal Server Error hatası fırlat"""
    raise_http_exception(status.HTTP_500_INTERNAL_SERVER_ERROR, message)


def validate_object_id(object_id: str, error_message: str = StandardErrors.INVALID_OBJECT_ID) -> None:
    """ObjectId formatını doğrula"""
    from bson import ObjectId
    if not ObjectId.is_valid(object_id):
        raise_bad_request(error_message)


def validate_admin_role(user_role: str) -> None:
    """Admin yetkisi kontrolü"""
    if user_role != "admin":
        raise_forbidden(StandardErrors.ADMIN_REQUIRED)


def validate_file_size(file_size: int, max_size: int = 10 * 1024 * 1024) -> None:
    """Dosya boyutu kontrolü"""
    if file_size > max_size:
        raise_bad_request(StandardErrors.FILE_TOO_LARGE)


def validate_file_type(filename: str, allowed_types: list = None) -> None:
    """Dosya türü kontrolü"""
    if allowed_types is None:
        allowed_types = ['.pdf', '.jpg', '.jpeg', '.png', '.xlsx', '.docx']
    
    import os
    file_ext = os.path.splitext(filename)[1].lower()
    if file_ext not in allowed_types:
        raise_bad_request(f"{StandardErrors.INVALID_FILE_TYPE}: {', '.join(allowed_types)}")


def validate_amount(amount: float) -> None:
    """Tutar doğrulama"""
    if amount <= 0:
        raise_bad_request(StandardErrors.INVALID_AMOUNT)


def validate_iban(iban: str) -> None:
    """IBAN doğrulama (basit kontrol)"""
    if not iban or len(iban) < 16 or len(iban) > 34:
        raise_bad_request(StandardErrors.INVALID_IBAN)


def sanitize_filename(filename: str) -> str:
    """Dosya adını güvenli hale getir"""
    import re
    import unicodedata
    
    # Unicode karakterleri normalize et
    filename = unicodedata.normalize('NFKD', filename)
    
    # Sadece güvenli karakterleri tut
    filename = re.sub(r'[^\w\s.-]', '', filename)
    
    # Çoklu boşlukları tek yap
    filename = re.sub(r'\s+', '_', filename)
    
    # Dosya adını kısalt (max 100 karakter)
    if len(filename) > 100:
        name, ext = filename.rsplit('.', 1) if '.' in filename else (filename, '')
        filename = name[:95] + '.' + ext if ext else name[:100]
    
    return filename.strip('.-_')


def validate_file_content(file_content: bytes, filename: str) -> None:
    """Dosya içeriğinin gerçek türünü kontrol et"""
    import magic
    
    # File signature kontrolü
    try:
        mime_type = magic.from_buffer(file_content, mime=True)
        file_ext = filename.lower().split('.')[-1] if '.' in filename else ''
        
        # Kabul edilen MIME types ve uzantıları
        allowed_combinations = {
            'pdf': ['application/pdf'],
            'jpg': ['image/jpeg'],
            'jpeg': ['image/jpeg'],
            'png': ['image/png'],
            'xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
            'docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
        }
        
        if file_ext in allowed_combinations:
            if mime_type not in allowed_combinations[file_ext]:
                raise_bad_request(f"Dosya içeriği ile uzantısı uyuşmuyor. Gerçek tip: {mime_type}")
    except ImportError:
        # python-magic yüklü değilse sadece uyarı ver
        pass