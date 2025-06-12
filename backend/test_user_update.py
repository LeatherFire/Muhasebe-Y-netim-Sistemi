#!/usr/bin/env python3
"""
Backend API ile kullanıcı güncelleme testi
"""
import requests
import json

def test_user_update():
    base_url = "http://localhost:8000"
    
    print("=== Backend API Kullanıcı Güncelleme Testi ===")
    
    # Test backend connection
    try:
        print("1. Backend bağlantısı test ediliyor...")
        response = requests.get(f"{base_url}/", timeout=5)
        print(f"✅ Backend erişilebilir (status: {response.status_code})")
    except requests.exceptions.RequestException as e:
        print(f"❌ Backend'e erişilemiyor: {e}")
        print("   Backend'i çalıştırmayı deneyin: python -m uvicorn main:app --reload --port 8000")
        return False
    
    # Login as admin
    print("\n2. Admin olarak giriş yapılıyor...")
    login_data = {
        "username": "admin",
        "password": "admin123"
    }
    
    try:
        login_response = requests.post(
            f"{base_url}/auth/login",
            data=login_data,
            timeout=10
        )
        
        if login_response.status_code == 200:
            token_data = login_response.json()
            access_token = token_data["access_token"]
            print("✅ Admin girişi başarılı")
        else:
            print(f"❌ Admin girişi başarısız: {login_response.status_code}")
            print(f"   Response: {login_response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Giriş isteği başarısız: {e}")
        return False
    
    # Update user
    print("\n3. User hesabı güncelleniyor...")
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    update_data = {
        "new_username": "mertyemek.nurullah",
        "new_password": "KX92#mN8$vQ7&wP4"
    }
    
    try:
        update_response = requests.put(
            f"{base_url}/auth/update-user/user",
            data=update_data,
            headers=headers,
            timeout=10
        )
        
        if update_response.status_code == 200:
            result = update_response.json()
            print("✅ Kullanıcı güncelleme başarılı!")
            print(f"   Eski: {result['old_username']}")
            print(f"   Yeni: {result['new_username']}")
            
            print(f"\n🔐 YENİ GİRİŞ BİLGİLERİ:")
            print(f"   Kullanıcı Adı: {result['new_username']}")
            print(f"   Şifre: KX92#mN8$vQ7&wP4")
            
            return True
        else:
            print(f"❌ Kullanıcı güncelleme başarısız: {update_response.status_code}")
            print(f"   Response: {update_response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Güncelleme isteği başarısız: {e}")
        return False
    
    # Test new login
    print("\n4. Yeni bilgilerle giriş test ediliyor...")
    new_login_data = {
        "username": "mertyemek.nurullah",
        "password": "KX92#mN8$vQ7&wP4"
    }
    
    try:
        new_login_response = requests.post(
            f"{base_url}/auth/login",
            data=new_login_data,
            timeout=10
        )
        
        if new_login_response.status_code == 200:
            print("✅ Yeni bilgilerle giriş başarılı!")
            return True
        else:
            print(f"❌ Yeni bilgilerle giriş başarısız: {new_login_response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Yeni giriş testi başarısız: {e}")
        return False

if __name__ == "__main__":
    success = test_user_update()
    if success:
        print("\n🎉 Kullanıcı güncelleme işlemi tamamlandı!")
        print("\n📱 Artık mertyemek.nurullah / KX92#mN8$vQ7&wP4 ile giriş yapabilirsiniz!")
    else:
        print("\n❌ Kullanıcı güncelleme işlemi başarısız!")
        print("   Backend'in çalıştığından emin olun:")