"""
User Management Script
Allows listing, creating, updating, and deleting users in the MongoDB database
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.core.security import get_password_hash
from datetime import datetime
import sys

async def list_users():
    """List all users in the database"""
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    print("\n=== Mevcut Kullanıcılar ===")
    users = await db.users.find({}).to_list(length=None)
    
    if not users:
        print("Hiç kullanıcı bulunamadı.")
    else:
        for user in users:
            print(f"ID: {user['_id']}")
            print(f"Kullanıcı Adı: {user['username']}")
            print(f"İsim: {user['name']}")
            print(f"Rol: {user['role']}")
            print(f"Oluşturulma: {user['created_at']}")
            print("-" * 30)
    
    client.close()

async def update_user(username, new_username=None, new_password=None, new_name=None, new_role=None):
    """Update user information"""
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    # Find the user
    user = await db.users.find_one({"username": username})
    if not user:
        print(f"Kullanıcı '{username}' bulunamadı.")
        client.close()
        return
    
    # Prepare update data
    update_data = {}
    
    if new_username:
        # Check if new username already exists
        existing = await db.users.find_one({"username": new_username})
        if existing and str(existing['_id']) != str(user['_id']):
            print(f"Kullanıcı adı '{new_username}' zaten kullanımda.")
            client.close()
            return
        update_data["username"] = new_username
    
    if new_password:
        update_data["password_hash"] = get_password_hash(new_password)
    
    if new_name:
        update_data["name"] = new_name
    
    if new_role:
        if new_role not in ["admin", "user"]:
            print("Geçersiz rol. 'admin' veya 'user' olmalıdır.")
            client.close()
            return
        update_data["role"] = new_role
    
    if not update_data:
        print("Güncellenecek bir alan belirtilmedi.")
        client.close()
        return
    
    # Update user
    result = await db.users.update_one(
        {"username": username},
        {"$set": update_data}
    )
    
    if result.modified_count > 0:
        print(f"Kullanıcı '{username}' başarıyla güncellendi.")
        
        # Show updated user
        updated_user = await db.users.find_one({"username": new_username or username})
        print("\nGüncellenmiş kullanıcı bilgileri:")
        print(f"Kullanıcı Adı: {updated_user['username']}")
        print(f"İsim: {updated_user['name']}")
        print(f"Rol: {updated_user['role']}")
    else:
        print("Kullanıcı güncellenemedi.")
    
    client.close()

async def create_user(username, password, name, role="user"):
    """Create a new user"""
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    # Check if user already exists
    existing_user = await db.users.find_one({"username": username})
    if existing_user:
        print(f"Kullanıcı '{username}' zaten mevcut.")
        client.close()
        return
    
    if role not in ["admin", "user"]:
        print("Geçersiz rol. 'admin' veya 'user' olmalıdır.")
        client.close()
        return
    
    # Create new user
    user_data = {
        "username": username,
        "password_hash": get_password_hash(password),
        "name": name,
        "role": role,
        "created_at": datetime.utcnow()
    }
    
    result = await db.users.insert_one(user_data)
    print(f"Yeni kullanıcı '{username}' başarıyla oluşturuldu.")
    print(f"ID: {result.inserted_id}")
    
    client.close()

async def delete_user(username):
    """Delete a user"""
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    # Check if user exists
    user = await db.users.find_one({"username": username})
    if not user:
        print(f"Kullanıcı '{username}' bulunamadı.")
        client.close()
        return
    
    # Confirm deletion
    print(f"Kullanıcı '{username}' ({user['name']}) silinecek. Emin misiniz? (y/N): ", end="")
    response = input().strip().lower()
    
    if response != 'y':
        print("Silme işlemi iptal edildi.")
        client.close()
        return
    
    # Delete user
    result = await db.users.delete_one({"username": username})
    
    if result.deleted_count > 0:
        print(f"Kullanıcı '{username}' başarıyla silindi.")
    else:
        print("Kullanıcı silinemedi.")
    
    client.close()

async def main():
    if len(sys.argv) < 2:
        print("Kullanım:")
        print("python user_management.py list                                    # Tüm kullanıcıları listele")
        print("python user_management.py create <username> <password> <name> [role]  # Yeni kullanıcı oluştur")
        print("python user_management.py update <username> [--username <new>] [--password <new>] [--name <new>] [--role <new>]")
        print("python user_management.py delete <username>                      # Kullanıcı sil")
        print("\nÖrnekler:")
        print("python user_management.py list")
        print("python user_management.py create baba babaPW 'Baba' user")
        print("python user_management.py update admin --username yeni_admin --password yeni123")
        print("python user_management.py update user --password yeniSifre123")
        print("python user_management.py delete eski_kullanici")
        return
    
    command = sys.argv[1]
    
    if command == "list":
        await list_users()
    
    elif command == "create":
        if len(sys.argv) < 5:
            print("Eksik parametre. Kullanım: python user_management.py create <username> <password> <name> [role]")
            return
        username = sys.argv[2]
        password = sys.argv[3]
        name = sys.argv[4]
        role = sys.argv[5] if len(sys.argv) > 5 else "user"
        await create_user(username, password, name, role)
    
    elif command == "update":
        if len(sys.argv) < 3:
            print("Eksik parametre. Kullanım: python user_management.py update <username> [--username <new>] [--password <new>] [--name <new>] [--role <new>]")
            return
        
        username = sys.argv[2]
        new_username = None
        new_password = None
        new_name = None
        new_role = None
        
        # Parse arguments
        i = 3
        while i < len(sys.argv):
            if sys.argv[i] == "--username" and i + 1 < len(sys.argv):
                new_username = sys.argv[i + 1]
                i += 2
            elif sys.argv[i] == "--password" and i + 1 < len(sys.argv):
                new_password = sys.argv[i + 1]
                i += 2
            elif sys.argv[i] == "--name" and i + 1 < len(sys.argv):
                new_name = sys.argv[i + 1]
                i += 2
            elif sys.argv[i] == "--role" and i + 1 < len(sys.argv):
                new_role = sys.argv[i + 1]
                i += 2
            else:
                i += 1
        
        await update_user(username, new_username, new_password, new_name, new_role)
    
    elif command == "delete":
        if len(sys.argv) < 3:
            print("Eksik parametre. Kullanım: python user_management.py delete <username>")
            return
        username = sys.argv[2]
        await delete_user(username)
    
    else:
        print(f"Bilinmeyen komut: {command}")
        print("Geçerli komutlar: list, create, update, delete")

if __name__ == "__main__":
    asyncio.run(main())