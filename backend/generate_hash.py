#!/usr/bin/env python3
"""
Şifre hash'i oluşturucu
"""
from passlib.context import CryptContext

# Password hashing setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def generate_hash():
    password = "KX92#mN8$vQ7&wP4"
    hash_result = pwd_context.hash(password)
    
    print("=== Şifre Hash Oluşturucu ===")
    print(f"Şifre: {password}")
    print(f"Hash: {hash_result}")
    print(f"Hash uzunluğu: {len(hash_result)} karakter")
    
    # Test hash
    is_valid = pwd_context.verify(password, hash_result)
    print(f"Hash doğrulama: {'✅ Başarılı' if is_valid else '❌ Başarısız'}")
    
    return hash_result

if __name__ == "__main__":
    hash_result = generate_hash()