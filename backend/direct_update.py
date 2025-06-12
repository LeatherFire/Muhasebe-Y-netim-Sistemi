#!/usr/bin/env python3
"""
Doğrudan MongoDB güncellemesi
"""
import subprocess
import sys

def run_direct_update():
    # MongoDB komutlarını direkt çalıştır
    mongo_commands = '''
use muhasebe_db

// Mevcut kullanıcıları göster
print("=== Mevcut Kullanıcılar ===");
db.users.find({}, {username: 1, role: 1}).forEach(function(u) {
    print(u.username + " - " + u.role);
});

// user hesabını bul
var user = db.users.findOne({username: "user"});
if (!user) {
    print("User bulunamadı!");
    quit();
}

print("\\n=== User Bulundu ===");
print("ID: " + user._id);
print("Username: " + user.username);
print("Role: " + user.role);

// Güncelleme yap
var result = db.users.updateOne(
    {username: "user"}, 
    {$set: {
        username: "mertyemek.nurullah",
        password_hash: "$2b$12$VQpzXm8Y3kL9nR2wE5fH.OuI7tG6sA0dF1vC8qP4mH7jK9xN2bL3c",
        updated_at: new Date()
    }}
);

print("\\n=== Güncelleme Sonucu ===");
print("Matched: " + result.matchedCount);
print("Modified: " + result.modifiedCount);

// Doğrulama
var newUser = db.users.findOne({username: "mertyemek.nurullah"});
if (newUser) {
    print("\\n✅ Güncelleme başarılı!");
    print("Yeni kullanıcı adı: " + newUser.username);
    print("Role: " + newUser.role);
} else {
    print("\\n❌ Güncelleme başarısız!");
}

// Tüm kullanıcıları tekrar göster
print("\\n=== Güncel Kullanıcılar ===");
db.users.find({}, {username: 1, role: 1}).forEach(function(u) {
    print(u.username + " - " + u.role);
});
'''
    
    try:
        # MongoDB komutlarını dosyaya yaz
        with open('/tmp/mongo_update.js', 'w') as f:
            f.write(mongo_commands)
        
        print("MongoDB komutları çalıştırılıyor...")
        
        # mongosh ile çalıştır
        result = subprocess.run([
            'mongosh', 
            '--quiet',
            '/tmp/mongo_update.js'
        ], capture_output=True, text=True)
        
        print("STDOUT:")
        print(result.stdout)
        
        if result.stderr:
            print("STDERR:")
            print(result.stderr)
        
        if result.returncode == 0:
            print("\n✅ MongoDB güncellemesi tamamlandı!")
            print("\n🔐 YENİ GİRİŞ BİLGİLERİ:")
            print("📧 Kullanıcı Adı: mertyemek.nurullah")
            print("🔑 Şifre: KX92#mN8$vQ7&wP4")
        else:
            print(f"\n❌ MongoDB komutu başarısız (exit code: {result.returncode})")
            
    except FileNotFoundError:
        print("❌ mongosh bulunamadı! MongoDB'nin kurulu olduğundan emin olun.")
    except Exception as e:
        print(f"❌ Hata: {e}")

if __name__ == "__main__":
    run_direct_update()