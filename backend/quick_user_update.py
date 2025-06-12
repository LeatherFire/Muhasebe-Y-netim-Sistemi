#!/usr/bin/env python3
"""
Quick user update script
Examples:
    python quick_user_update.py list
    python quick_user_update.py update admin new_password
    python quick_user_update.py update user new_username new_password
"""
import sys
import os
import asyncio
from pymongo import MongoClient
from passlib.context import CryptContext

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def list_users():
    try:
        client = MongoClient("mongodb://localhost:27017")
        db = client["muhasebe_db"]
        
        users = list(db.users.find({}))
        
        if not users:
            print("Hiç kullanıcı bulunamadı.")
        else:
            print(f"Toplam {len(users)} kullanıcı:")
            for user in users:
                print(f"- {user['username']} ({user['name']}) - {user['role']}")
        
        client.close()
    except Exception as e:
        print(f"Hata: {e}")

def update_user_password(username, new_password):
    try:
        client = MongoClient("mongodb://localhost:27017")
        db = client["muhasebe_db"]
        
        # Check if user exists
        user = db.users.find_one({"username": username})
        if not user:
            print(f"Kullanıcı '{username}' bulunamadı.")
            client.close()
            return
        
        # Update password
        password_hash = get_password_hash(new_password)
        result = db.users.update_one(
            {"username": username},
            {"$set": {"password_hash": password_hash}}
        )
        
        if result.modified_count > 0:
            print(f"Kullanıcı '{username}' şifresi güncellendi.")
        else:
            print("Şifre güncellenemedi.")
        
        client.close()
    except Exception as e:
        print(f"Hata: {e}")

def update_user_credentials(username, new_username, new_password):
    try:
        client = MongoClient("mongodb://localhost:27017")
        db = client["muhasebe_db"]
        
        # Check if user exists
        user = db.users.find_one({"username": username})
        if not user:
            print(f"Kullanıcı '{username}' bulunamadı.")
            client.close()
            return
        
        update_data = {}
        
        # Check if new username is available
        if new_username != username:
            existing = db.users.find_one({"username": new_username})
            if existing:
                print(f"Kullanıcı adı '{new_username}' zaten kullanımda.")
                client.close()
                return
            update_data["username"] = new_username
        
        # Update password
        update_data["password_hash"] = get_password_hash(new_password)
        
        result = db.users.update_one(
            {"username": username},
            {"$set": update_data}
        )
        
        if result.modified_count > 0:
            print(f"Kullanıcı '{username}' güncellendi.")
            if new_username != username:
                print(f"Yeni kullanıcı adı: {new_username}")
            print("Şifre güncellendi.")
        else:
            print("Kullanıcı güncellenemedi.")
        
        client.close()
    except Exception as e:
        print(f"Hata: {e}")

def main():
    if len(sys.argv) < 2:
        print("Kullanım:")
        print("  python quick_user_update.py list")
        print("  python quick_user_update.py update <username> <new_password>")
        print("  python quick_user_update.py update <username> <new_username> <new_password>")
        print("\nÖrnekler:")
        print("  python quick_user_update.py list")
        print("  python quick_user_update.py update admin yeni123")
        print("  python quick_user_update.py update user baba baba123")
        return
    
    command = sys.argv[1]
    
    if command == "list":
        list_users()
    elif command == "update":
        if len(sys.argv) == 4:
            # Update password only
            username = sys.argv[2]
            new_password = sys.argv[3]
            update_user_password(username, new_password)
        elif len(sys.argv) == 5:
            # Update username and password
            username = sys.argv[2]
            new_username = sys.argv[3]
            new_password = sys.argv[4]
            update_user_credentials(username, new_username, new_password)
        else:
            print("Eksik parametre.")
    else:
        print(f"Bilinmeyen komut: {command}")

if __name__ == "__main__":
    main()