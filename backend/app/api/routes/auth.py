from fastapi import APIRouter, Depends, HTTPException, status, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import timedelta
from app.models.user import Token, UserCreate, User
from app.core.security import verify_password, create_access_token, verify_token, get_password_hash
from app.core.config import settings
from app.core.database import get_database

router = APIRouter()
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """Get current authenticated user"""
    db = get_database()
    payload = verify_token(credentials.credentials)
    username = payload.get("sub")
    
    user_data = await db.users.find_one({"username": username})
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    # Convert ObjectId to string
    user_data["_id"] = str(user_data["_id"])
    return User(**user_data)

async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current user and verify admin role"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    return current_user

async def get_user_or_admin(current_user: User = Depends(get_current_user)) -> User:
    """Get current user (both user and admin roles allowed)"""
    if current_user.role not in ["user", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Geçersiz kullanıcı rolü"
        )
    return current_user

@router.post("/register", response_model=User)
async def register(
    username: str = Form(...),
    password: str = Form(...),
    name: str = Form(...),
    role: str = Form(default="user")
):
    """Register new user"""
    db = get_database()
    
    # Check if user already exists
    existing_user = await db.users.find_one({"username": username})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Create new user
    user_data = {
        "username": username,
        "password_hash": get_password_hash(password),
        "name": name,
        "role": role,
        "created_at": "2024-01-01T00:00:00Z"
    }
    
    result = await db.users.insert_one(user_data)
    user_data["_id"] = str(result.inserted_id)
    
    return User(**user_data)

@router.post("/login", response_model=Token)
async def login(username: str = Form(...), password: str = Form(...)):
    """Login endpoint"""
    db = get_database()
    user = await db.users.find_one({"username": username})
    
    if not user or not verify_password(password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user["username"], "role": user["role"]},
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    return current_user

@router.post("/logout")
async def logout():
    """Logout endpoint"""
    return {"message": "Successfully logged out"}

@router.put("/update-user/{username}")
async def update_user_credentials(
    username: str,
    new_username: str = Form(...),
    new_password: str = Form(...),
    current_user: User = Depends(get_admin_user)
):
    """Update user credentials (admin only)"""
    from bson import ObjectId
    
    db = get_database()
    
    # Find the user to update
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User '{username}' not found"
        )
    
    # Check if new username is available (if different)
    if new_username != username:
        existing = await db.users.find_one({"username": new_username})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Username '{new_username}' is already taken"
            )
    
    # Update user
    password_hash = get_password_hash(new_password)
    update_data = {
        "username": new_username,
        "password_hash": password_hash,
        "updated_at": None  # This will be set by MongoDB
    }
    
    result = await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": update_data, "$currentDate": {"updated_at": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user"
        )
    
    return {
        "message": "User updated successfully",
        "old_username": username,
        "new_username": new_username,
        "updated": True
    }