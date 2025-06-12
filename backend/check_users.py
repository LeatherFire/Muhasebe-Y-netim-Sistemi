"""
Simple script to check users in the database
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check_users():
    try:
        # Connect to MongoDB
        client = AsyncIOMotorClient("mongodb://localhost:27017")
        db = client["muhasebe_db"]
        
        print("MongoDB'ye bağlanıldı. Kullanıcılar kontrol ediliyor...")
        
        # List all users
        users = await db.users.find({}).to_list(length=None)
        
        if not users:
            print("Hiç kullanıcı bulunamadı.")
        else:
            print(f"\nToplam {len(users)} kullanıcı bulundu:\n")
            for i, user in enumerate(users, 1):
                print(f"{i}. Kullanıcı:")
                print(f"   ID: {user['_id']}")
                print(f"   Kullanıcı Adı: {user['username']}")
                print(f"   İsim: {user['name']}")
                print(f"   Rol: {user['role']}")
                if 'created_at' in user:
                    print(f"   Oluşturulma: {user['created_at']}")
                print()
        
        client.close()
        
    except Exception as e:
        print(f"Hata: {e}")

if __name__ == "__main__":
    asyncio.run(check_users())