#!/usr/bin/env python3
"""
Check current users and update user account
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from pymongo import MongoClient
from passlib.context import CryptContext
from datetime import datetime

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def main():
    try:
        print("MongoDB'ye bağlanılıyor...")
        client = MongoClient("mongodb://localhost:27017")
        db = client["muhasebe_db"]
        
        # Test connection
        server_info = client.server_info()
        print(f"✅ MongoDB'ye başarıyla bağlandı (version: {server_info['version']})")
        
        # List current users
        print("\n📋 Mevcut kullanıcılar:")
        users = list(db.users.find({}))
        
        if not users:
            print("❌ Hiç kullanıcı bulunamadı.")
            client.close()
            return
        
        for i, user in enumerate(users, 1):
            print(f"{i}. {user['username']} ({user.get('name', 'İsim yok')}) - {user.get('role', 'rol yok')}")
        
        # Check if user exists
        user = db.users.find_one({"username": "user"})
        if not user:
            print("\n❌ 'user' kullanıcısı bulunamadı.")
            client.close()
            return
        
        print(f"\n🔍 'user' kullanıcısı bulundu:")
        print(f"   ID: {user['_id']}")
        print(f"   Username: {user['username']}")
        print(f"   Name: {user.get('name', 'İsim yok')}")
        print(f"   Role: {user.get('role', 'rol yok')}")
        
        # Check if new username is available
        existing = db.users.find_one({"username": "mertyemek.nurullah"})
        if existing:
            print("\n⚠️  'mertyemek.nurullah' kullanıcı adı zaten kullanımda.")
            client.close()
            return
        
        # New credentials
        new_username = "mertyemek.nurullah"
        new_password = "KX92#mN8$vQ7&wP4"
        
        print(f"\n🔄 Kullanıcı güncelleniyor...")
        print(f"   Eski kullanıcı adı: user")
        print(f"   Yeni kullanıcı adı: {new_username}")
        print(f"   Yeni şifre: {new_password}")
        
        # Update user
        password_hash = get_password_hash(new_password)
        result = db.users.update_one(
            {"username": "user"},
            {"$set": {
                "username": new_username,
                "password_hash": password_hash,
                "updated_at": datetime.utcnow()
            }}
        )
        
        if result.modified_count > 0:
            print("\n✅ Kullanıcı başarıyla güncellendi!")
            
            # Verify update
            updated_user = db.users.find_one({"username": new_username})
            if updated_user:
                print(f"✅ Doğrulama: Yeni kullanıcı '{new_username}' bulundu.")
                
                print(f"\n🔐 YENİ GİRİŞ BİLGİLERİ:")
                print(f"📧 Kullanıcı Adı: {new_username}")
                print(f"🔑 Şifre: {new_password}")
                print(f"\n💡 Bu bilgileri kaydedin!")
                
        else:
            print("\n❌ Kullanıcı güncellenemedi.")
        
        client.close()
        
    except Exception as e:
        print(f"❌ Hata: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()