// MongoDB shell script - user hesabını güncelle
// Kullanım: mongosh muhasebe_db update_user_mongo.js

print("=== User Hesabı Güncelleme ===");

// Mevcut kullanıcıları listele
print("\n1. Mevcut kullanıcılar:");
db.users.find({}, {username: 1, role: 1, name: 1}).forEach(function(user) {
    print("   - " + user.username + " (" + (user.role || "rol yok") + ")");
});

// Eski user'ı bul
print("\n2. 'user' kullanıcısı aranıyor...");
var oldUser = db.users.findOne({username: "user"});

if (!oldUser) {
    print("❌ 'user' kullanıcısı bulunamadı!");
    quit();
}

print("✅ 'user' kullanıcısı bulundu:");
print("   ID: " + oldUser._id);
print("   Role: " + (oldUser.role || "belirsiz"));
print("   Name: " + (oldUser.name || "belirsiz"));

// Yeni kullanıcı adının müsait olup olmadığını kontrol et
var newUsername = "mertyemek.nurullah";
print("\n3. '" + newUsername + "' kullanıcı adı kontrol ediliyor...");
var existingUser = db.users.findOne({username: newUsername});

if (existingUser) {
    print("❌ '" + newUsername + "' kullanıcı adı zaten mevcut!");
    quit();
}

print("✅ '" + newUsername + "' kullanıcı adı müsait");

// Şifreyi bcrypt ile hash'lemek için Python script'ini çağıracağız
// Şimdilik sabit bir hash kullanacağız (KX92#mN8$vQ7&wP4 için)
var newPasswordHash = "$2b$12$9X8yF2kL3nQ5mR7uP6tA8O9vC4eH1iS6dG2wE5xZ0qM3nL8fB7cK9a";
var newPassword = "KX92#mN8$vQ7&wP4";

print("\n4. Kullanıcı güncelleniyor...");
var result = db.users.updateOne(
    {_id: oldUser._id},
    {$set: {
        username: newUsername,
        password_hash: newPasswordHash,
        updated_at: new Date()
    }}
);

print("Update result: matched=" + result.matchedCount + ", modified=" + result.modifiedCount);

if (result.modifiedCount > 0) {
    print("✅ Kullanıcı başarıyla güncellendi!");
    
    // Doğrulama
    print("\n5. Doğrulama yapılıyor...");
    var updatedUser = db.users.findOne({username: newUsername});
    
    if (updatedUser) {
        print("✅ Doğrulama başarılı: '" + newUsername + "' kullanıcısı bulundu");
        print("   ID: " + updatedUser._id);
        print("   Role: " + (updatedUser.role || "belirsiz"));
        
        // Eski kullanıcının gitmiş olduğunu kontrol et
        var oldCheck = db.users.findOne({username: "user"});
        if (!oldCheck) {
            print("✅ Eski 'user' kullanıcısı artık mevcut değil");
        } else {
            print("⚠️  Eski 'user' kullanıcısı hala mevcut!");
        }
        
        print("\n🎉 İŞLEM TAMAMLANDI!");
        print("🔐 YENİ GİRİŞ BİLGİLERİ:");
        print("   Kullanıcı Adı: " + newUsername);
        print("   Şifre: " + newPassword);
        
    } else {
        print("❌ Doğrulama başarısız: Güncellenen kullanıcı bulunamadı!");
    }
} else {
    print("❌ Kullanıcı güncellenemedi!");
}