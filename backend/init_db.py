"""
Database initialization script
Creates default admin user and sets up indexes
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.core.security import get_password_hash
from datetime import datetime

async def init_database():
    """Initialize database with default data"""
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    # Create indexes
    await db.users.create_index("username", unique=True)
    await db.bank_accounts.create_index("iban", unique=True)
    await db.people.create_index("iban")
    
    # Check if admin user exists
    admin_exists = await db.users.find_one({"username": "admin"})
    if not admin_exists:
        # Create default admin user
        admin_user = {
            "username": "admin",
            "name": "Admin",
            "role": "admin",
            "password_hash": get_password_hash("admin123"),
            "created_at": datetime.utcnow()
        }
        await db.users.insert_one(admin_user)
        print("Default admin user created (username: admin, password: admin123)")
    
    # Check if regular user exists
    user_exists = await db.users.find_one({"username": "user"})
    if not user_exists:
        # Create default regular user
        regular_user = {
            "username": "user",
            "name": "Kullanıcı",
            "role": "user",
            "password_hash": get_password_hash("user123"),
            "created_at": datetime.utcnow()
        }
        await db.users.insert_one(regular_user)
        print("Default user created (username: user, password: user123)")
    
    print("Database initialization completed!")
    client.close()

if __name__ == "__main__":
    asyncio.run(init_database())