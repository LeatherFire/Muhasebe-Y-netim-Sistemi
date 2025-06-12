# Muhasebe Yönetim Sistemi

## Proje Genel Bakış
Küçük ölçekli şirketler için gelir-gider, banka hesapları, bakiye, kredi kartları, çekler ve borçları yönetebilen web tabanlı muhasebe sistemi.

## Teknoloji Stack
- **Frontend**: Next.js (React)
- **Backend**: Python FastAPI
- **Veritabanı**: Local MongoDB
- **AI Entegrasyonu**: Ücretsiz AI API (OpenAI/Groq/Ollama)
- **Dosya İşleme**: PDF/Doküman okuma ve analiz

## Kullanıcı Rolleri
- **Admin (Sen)**: Tüm işlemleri yapabilir, sistem yönetimi
- **Normal Kullanıcı (Baban)**: Ödeme emri oluşturabilir, raporları görüntüleyebilir

## Ana Modüller

### 1. Kullanıcı Yönetimi
- Basit giriş sistemi (2 kullanıcı)
- Rol tabanlı yetkilendirme
- Session yönetimi

### 2. Ödeme Emri Sistemi
**Normal Kullanıcı İşlemleri:**
- IBAN, isim, açıklama ile ödeme emri oluşturma
- AI tarafından açıklamanın düzenlenmesi ve kategorilenmesi

**Admin İşlemleri:**
- Ödeme emirlerini görüntüleme ve onaylama
- Dekont yükleme (PDF/resim)
- AI ile dekont analizi ve otomatik kayıt

### 3. Banka Hesapları Yönetimi
- Hesap bilgileri (isim, IBAN, banka)
- Güncel bakiye takibi
- İşlem geçmişi
- Para girişi/çıkışı kayıtları

### 4. Kredi Kartları Yönetimi
- Kart bilgileri ve limitleri
- Hesap kesim tarihleri
- Son ödeme tarihleri
- Esnek hesap durumu
- Kullanım takibi

### 5. Kişi/Kurum Yönetimi
- Para transfer edilen kişi/kurumların listesi
- Her kişi için detay sayfası
- Yapılan tüm ödemelerin geçmişi
- Otomatik kişi ekleme (yeni transferlerde)

### 6. Borçlar Yönetimi
- Borç ekleme/düzenleme
- Kategori seçimi
- Vade takibi
- Ödeme planları

### 7. Çek Yönetimi
- Çek bilgileri (tutar, vade, banka)
- AI ile çek analizi
- Erken bozdurma hesaplamaları
- Vade takibi

### 8. Para Girişi Sistemi
- Şirket ödemeleri kayıtları
- Hangi şirketten ne kadar geldiği
- Kategorizasyon
- Bakiye üzerinde otomatik etki

### 9. Raporlama ve Filtreleme
- Tarih aralığı filtreleri
- Kategori bazlı filtreleme
- Kişi/kurum bazlı raporlar
- Banka hesabı bazlı işlemler
- Gelir/gider analizi

### 10. AI Entegrasyonu
**Dekont Analizi:**
- PDF/resim okuma
- Tutar, tarih, banka bilgisi çıkarma
- Otomatik kategorileme

**Açıklama Düzenleme:**
- Ödeme açıklamalarını anlaşılır hale getirme
- Kategori önerisi
- Standartlaştırma

**Çek Analizi:**
- Çek bilgilerini otomatik çıkarma
- Vade hesaplamaları

## Veritabanı Şeması

### Users Collection
```javascript
{
  _id: ObjectId,
  username: String,
  password: String, // hashed
  role: String, // "admin" | "user"
  name: String,
  created_at: Date
}
```

### PaymentOrders Collection
```javascript
{
  _id: ObjectId,
  created_by: ObjectId, // user_id
  recipient_name: String,
  recipient_iban: String,
  amount: Number,
  description: String,
  ai_processed_description: String,
  category: String,
  status: String, // "pending" | "approved" | "completed"
  receipt_url: String,
  bank_account_id: ObjectId,
  created_at: Date,
  completed_at: Date
}
```

### BankAccounts Collection
```javascript
{
  _id: ObjectId,
  name: String,
  iban: String,
  bank_name: String,
  balance: Number,
  account_type: String,
  created_at: Date,
  updated_at: Date
}
```

### CreditCards Collection
```javascript
{
  _id: ObjectId,
  name: String,
  bank_name: String,
  limit: Number,
  used_amount: Number,
  statement_date: Number, // day of month
  due_date: Number, // day of month
  flexible_account: Boolean,
  created_at: Date
}
```

### People Collection
```javascript
{
  _id: ObjectId,
  name: String,
  iban: String,
  phone: String,
  email: String,
  company: String,
  total_sent: Number,
  total_received: Number,
  created_at: Date
}
```

### Transactions Collection
```javascript
{
  _id: ObjectId,
  type: String, // "income" | "expense" | "transfer"
  amount: Number,
  description: String,
  category: String,
  bank_account_id: ObjectId,
  person_id: ObjectId,
  payment_order_id: ObjectId, // optional
  receipt_url: String,
  date: Date,
  created_at: Date
}
```

### Debts Collection
```javascript
{
  _id: ObjectId,
  creditor_name: String,
  amount: Number,
  due_date: Date,
  category: String,
  description: String,
  status: String, // "active" | "paid"
  created_at: Date
}
```

### Checks Collection
```javascript
{
  _id: ObjectId,
  amount: Number,
  due_date: Date,
  bank_name: String,
  check_number: String,
  drawer_name: String,
  early_discount_rate: Number,
  status: String, // "active" | "cashed" | "returned"
  created_at: Date
}
```

## API Endpoints

### Authentication
- POST /auth/login
- POST /auth/logout
- GET /auth/me

### Payment Orders
- GET /payment-orders
- POST /payment-orders
- PUT /payment-orders/{id}
- DELETE /payment-orders/{id}
- POST /payment-orders/{id}/approve
- POST /payment-orders/{id}/upload-receipt

### Bank Accounts
- GET /bank-accounts
- POST /bank-accounts
- PUT /bank-accounts/{id}
- DELETE /bank-accounts/{id}

### Credit Cards
- GET /credit-cards
- POST /credit-cards
- PUT /credit-cards/{id}
- DELETE /credit-cards/{id}

### People
- GET /people
- POST /people
- PUT /people/{id}
- GET /people/{id}/transactions

### Transactions
- GET /transactions
- POST /transactions
- PUT /transactions/{id}
- DELETE /transactions/{id}

### Debts
- GET /debts
- POST /debts
- PUT /debts/{id}
- DELETE /debts/{id}

### Checks
- GET /checks
- POST /checks
- PUT /checks/{id}
- DELETE /checks/{id}

### AI Services
- POST /ai/analyze-receipt
- POST /ai/process-description
- POST /ai/analyze-check

## Frontend Sayfaları

### Dashboard
- Güncel bakiye özeti
- Son işlemler
- Bekleyen ödeme emirleri
- Kredi kartı durumları

### Ödeme Emirleri
- Liste görünümü
- Yeni ödeme emri oluşturma
- Dekont yükleme

### Banka Hesapları
- Hesap listesi
- İşlem geçmişi
- Bakiye takibi

### Kredi Kartları
- Kart listesi ve durumları
- Ödeme takibi

### Kişiler/Kurumlar
- Kişi listesi
- Detay sayfaları
- İşlem geçmişi

### Borçlar
- Borç listesi
- Vade takibi

### Çekler
- Çek listesi
- Vade takibi

### Raporlar
- Gelir/gider raporları
- Kategori bazlı analizler
- Filtreleme seçenekleri

## Güvenlik
- Password hashing (bcrypt)
- JWT token authentication
- Role-based access control
- File upload validation
- Input sanitization

## Deployment
- Local development environment
- MongoDB local instance
- Environment variables for API keys
- Docker containerization (optional)

## Önemli Notlar
- Tüm para birimleri TL olarak saklanacak
- Tarihler UTC formatında saklanacak
- AI işlemleri asenkron olarak yapılacak
- Dosya yüklemeleri local storage'da tutulacak
- Backup stratejisi MongoDB export ile yapılacak

## Geliştirme Notları
- Claude test amaçlı backend/frontend çalıştırabilir ancak işin sonunda mutlaka kapatmalıdır
- Kullanıcı kendi terminalinde servisleri çalıştırır
- Backend ve frontend servislerini Claude otomatik kapatmalıdır

## Servis Çalıştırma Komutları

### Backend Çalıştırma
```bash
cd /Users/leatherfire/MuhasebeYonetim/backend
python -m uvicorn main:app --reload --port 8000
```

### Frontend Çalıştırma
```bash
cd /Users/leatherfire/MuhasebeYonetim/frontend
npm run dev
```

ONLY ANSWER IN TURKISH!!!