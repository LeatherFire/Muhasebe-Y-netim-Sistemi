#!/usr/bin/env python3
"""
Update specific user script - Changes user/user123 to mertyemek.nurullah with a strong password
"""
from pymongo import MongoClient
from passlib.context import CryptContext

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def update_user():
    try:
        client = MongoClient("mongodb://localhost:27017")
        db = client["muhasebe_db"]
        
        # Check if current user exists
        user = db.users.find_one({"username": "user"})
        if not user:
            print("Kullanıcı 'user' bulunamadı.")
            client.close()
            return
        
        print(f"Mevcut kullanıcı bulundu: {user['username']} ({user['name']}) - {user['role']}")
        
        # Check if new username is available
        existing = db.users.find_one({"username": "mertyemek.nurullah"})
        if existing:
            print("Kullanıcı adı 'mertyemek.nurullah' zaten kullanımda.")
            client.close()
            return
        
        # New credentials
        new_username = "mertyemek.nurullah"
        new_password = "KX92#mN8$vQ7&wP4"
        
        # Update user
        password_hash = get_password_hash(new_password)
        result = db.users.update_one(
            {"username": "user"},
            {"$set": {
                "username": new_username,
                "password_hash": password_hash
            }}
        )
        
        if result.modified_count > 0:
            print("✅ Kullanıcı başarıyla güncellendi!")
            print(f"Yeni kullanıcı adı: {new_username}")
            print(f"Yeni şifre: {new_password}")
            print("\n🔐 Giriş bilgileri:")
            print(f"Username: {new_username}")
            print(f"Password: {new_password}")
        else:
            print("❌ Kullanıcı güncellenemedi.")
        
        client.close()
    except Exception as e:
        print(f"Hata: {e}")

if __name__ == "__main__":
    print("User hesabını güncelliyorum...")
    update_user()