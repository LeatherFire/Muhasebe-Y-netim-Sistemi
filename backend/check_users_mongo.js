// MongoDB shell script to check users
// Usage: mongosh muhasebe_db check_users_mongo.js

print("=== Muhasebe DB Kullanıcıları ===");

// Connect to the database
use('muhasebe_db');

// Find all users
const users = db.users.find({}).toArray();

if (users.length === 0) {
    print("Hiç kullanıcı bulunamadı.");
} else {
    print(`Toplam ${users.length} kullanıcı bulundu:\n`);
    
    users.forEach((user, index) => {
        print(`${index + 1}. Kullanıcı:`);
        print(`   ID: ${user._id}`);
        print(`   Kullanıcı Adı: ${user.username}`);
        print(`   İsim: ${user.name}`);
        print(`   Rol: ${user.role}`);
        if (user.created_at) {
            print(`   Oluşturulma: ${user.created_at}`);
        }
        print("");
    });
}

print("=== İşlem Tamamlandı ===");