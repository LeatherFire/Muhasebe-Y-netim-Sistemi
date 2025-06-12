#!/usr/bin/env python3
"""
Simple user update script for MongoDB
Usage: python update_user.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    """Generate password hash"""
    return pwd_context.hash(password)

async def update_user_credentials():
    try:
        # Connect to MongoDB
        client = AsyncIOMotorClient("mongodb://localhost:27017")
        db = client["muhasebe_db"]
        
        print("MongoDB'ye bağlanıldı.")
        print("=" * 50)
        
        # List current users
        print("Mevcut kullanıcılar:")
        users = await db.users.find({}).to_list(length=None)
        
        if not users:
            print("Hiç kullanıcı bulunamadı.")
            client.close()
            return
        
        for i, user in enumerate(users, 1):
            print(f"{i}. {user['username']} - {user['name']} ({user['role']})")
        
        print("=" * 50)
        
        # Get user selection
        username = input("Güncellenecek kullanıcının adını girin: ").strip()
        
        # Find user
        user = await db.users.find_one({"username": username})
        if not user:
            print(f"Kullanıcı '{username}' bulunamadı.")
            client.close()
            return
        
        print(f"\nMevcut kullanıcı bilgileri:")
        print(f"Kullanıcı Adı: {user['username']}")
        print(f"İsim: {user['name']}")
        print(f"Rol: {user['role']}")
        
        # Get update options
        print("\nNeyi güncellemek istiyorsunuz?")
        print("1. Kullanıcı adı")
        print("2. Şifre")
        print("3. İsim")
        print("4. Rol")
        print("5. Hepsi")
        
        choice = input("Seçiminiz (1-5): ").strip()
        
        update_data = {}
        
        if choice in ['1', '5']:
            new_username = input(f"Yeni kullanıcı adı (mevcut: {user['username']}): ").strip()
            if new_username:
                # Check if username exists
                existing = await db.users.find_one({"username": new_username})
                if existing and str(existing['_id']) != str(user['_id']):
                    print(f"Kullanıcı adı '{new_username}' zaten kullanımda.")
                    client.close()
                    return
                update_data["username"] = new_username
        
        if choice in ['2', '5']:
            new_password = input("Yeni şifre: ").strip()
            if new_password:
                update_data["password_hash"] = get_password_hash(new_password)
        
        if choice in ['3', '5']:
            new_name = input(f"Yeni isim (mevcut: {user['name']}): ").strip()
            if new_name:
                update_data["name"] = new_name
        
        if choice in ['4', '5']:
            print("Roller: admin, user")
            new_role = input(f"Yeni rol (mevcut: {user['role']}): ").strip()
            if new_role:
                if new_role not in ["admin", "user"]:
                    print("Geçersiz rol. 'admin' veya 'user' olmalıdır.")
                    client.close()
                    return
                update_data["role"] = new_role
        
        if not update_data:
            print("Hiçbir güncelleme yapılmadı.")
            client.close()
            return
        
        # Confirm update
        print("\nYapılacak değişiklikler:")
        for key, value in update_data.items():
            if key == "password_hash":
                print(f"- Şifre: *** (gizli)")
            else:
                print(f"- {key}: {value}")
        
        confirm = input("\nDevam etmek istiyor musunuz? (y/N): ").strip().lower()
        if confirm != 'y':
            print("Güncelleme iptal edildi.")
            client.close()
            return
        
        # Update user
        result = await db.users.update_one(
            {"username": username},
            {"$set": update_data}
        )
        
        if result.modified_count > 0:
            print("Kullanıcı başarıyla güncellendi!")
            
            # Show updated user
            updated_user = await db.users.find_one({"username": update_data.get("username", username)})
            print("\nGüncellenmiş kullanıcı bilgileri:")
            print(f"Kullanıcı Adı: {updated_user['username']}")
            print(f"İsim: {updated_user['name']}")
            print(f"Rol: {updated_user['role']}")
        else:
            print("Kullanıcı güncellenemedi.")
        
        client.close()
        
    except Exception as e:
        print(f"Hata: {e}")

if __name__ == "__main__":
    asyncio.run(update_user_credentials())