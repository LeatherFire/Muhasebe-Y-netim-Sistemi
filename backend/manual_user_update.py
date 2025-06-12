#!/usr/bin/env python3
"""
Manuel user güncelleme - user/user123 -> mertyemek.nurullah/güçlü_şifre
"""
import sys
import os
from pymongo import MongoClient
from passlib.context import CryptContext
from datetime import datetime

# Password hashing setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def update_user_manual():
    """Manuel olarak user hesabını güncelle"""
    
    # Yeni bilgiler
    old_username = "user"
    new_username = "mertyemek.nurullah"
    new_password = "KX92#mN8$vQ7&wP4"
    
    print("=== User Hesabı Güncelleme ===")
    print(f"Eski: {old_username}/user123")
    print(f"Yeni: {new_username}/{new_password}")
    print()
    
    try:
        # MongoDB bağlantısı
        print("1. MongoDB'ye bağlanılıyor...")
        client = MongoClient("mongodb://localhost:27017")
        db = client["muhasebe_db"]
        
        # Bağlantıyı test et
        client.admin.command('ping')
        print("✅ MongoDB bağlantısı başarılı")
        
        # Mevcut kullanıcıları listele
        print("\n2. Mevcut kullanıcılar:")
        users = list(db.users.find({}, {"username": 1, "role": 1, "name": 1}))
        for user in users:
            print(f"   - {user['username']} ({user.get('role', 'rol yok')})")
        
        # Eski user'ı bul
        print(f"\n3. '{old_username}' kullanıcısı aranıyor...")
        old_user = db.users.find_one({"username": old_username})
        
        if not old_user:
            print(f"❌ '{old_username}' kullanıcısı bulunamadı!")
            return False
        
        print(f"✅ '{old_username}' kullanıcısı bulundu:")
        print(f"   ID: {old_user['_id']}")
        print(f"   Role: {old_user.get('role', 'belirsiz')}")
        print(f"   Name: {old_user.get('name', 'belirsiz')}")
        
        # Yeni kullanıcı adının müsait olup olmadığını kontrol et
        print(f"\n4. '{new_username}' kullanıcı adı kontrol ediliyor...")
        existing_user = db.users.find_one({"username": new_username})
        
        if existing_user:
            print(f"❌ '{new_username}' kullanıcı adı zaten mevcut!")
            return False
        
        print(f"✅ '{new_username}' kullanıcı adı müsait")
        
        # Şifreyi hash'le
        print(f"\n5. Yeni şifre hash'leniyor...")
        password_hash = get_password_hash(new_password)
        print(f"✅ Şifre hash'lendi (uzunluk: {len(password_hash)} karakter)")
        
        # Kullanıcıyı güncelle
        print(f"\n6. Kullanıcı güncelleniyor...")
        result = db.users.update_one(
            {"_id": old_user["_id"]},  # ID ile güncelle
            {"$set": {
                "username": new_username,
                "password_hash": password_hash,
                "updated_at": datetime.utcnow()
            }}
        )
        
        print(f"Update result: matched={result.matched_count}, modified={result.modified_count}")
        
        if result.modified_count > 0:
            print("✅ Kullanıcı başarıyla güncellendi!")
            
            # Doğrulama
            print(f"\n7. Doğrulama yapılıyor...")
            updated_user = db.users.find_one({"username": new_username})
            
            if updated_user:
                print(f"✅ Doğrulama başarılı: '{new_username}' kullanıcısı bulundu")
                print(f"   ID: {updated_user['_id']}")
                print(f"   Role: {updated_user.get('role', 'belirsiz')}")
                
                # Eski kullanıcının gitmiş olduğunu kontrol et
                old_check = db.users.find_one({"username": old_username})
                if not old_check:
                    print(f"✅ Eski '{old_username}' kullanıcısı artık mevcut değil")
                else:
                    print(f"⚠️  Eski '{old_username}' kullanıcısı hala mevcut!")
                
                print(f"\n🎉 İŞLEM TAMAMLANDI!")
                print(f"🔐 YENİ GİRİŞ BİLGİLERİ:")
                print(f"   Kullanıcı Adı: {new_username}")
                print(f"   Şifre: {new_password}")
                
                return True
            else:
                print("❌ Doğrulama başarısız: Güncellenen kullanıcı bulunamadı!")
                return False
        else:
            print("❌ Kullanıcı güncellenemedi!")
            return False
            
    except Exception as e:
        print(f"❌ HATA: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        try:
            client.close()
            print("\n8. MongoDB bağlantısı kapatıldı")
        except:
            pass

if __name__ == "__main__":
    success = update_user_manual()
    if success:
        print("\n✅ İşlem başarıyla tamamlandı!")
    else:
        print("\n❌ İşlem başarısız!")