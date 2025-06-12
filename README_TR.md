# 🏢 Muhasebe Yönetim Sistemi

Modern, kullanıcı dostu ve AI destekli muhasebe yönetim sistemi. Küçük ve orta ölçekli işletmeler için gelir-gider takibi, banka hesapları yönetimi, borç takibi ve finansal raporlama çözümü.

[🇺🇸 English README](README.md)

![Next.js](https://img.shields.io/badge/Next.js-15.3.3-black?style=for-the-badge&logo=next.js)
![Python](https://img.shields.io/badge/Python-3.9+-blue?style=for-the-badge&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-green?style=for-the-badge&logo=fastapi)
![MongoDB](https://img.shields.io/badge/MongoDB-5.0+-darkgreen?style=for-the-badge&logo=mongodb)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)

## 📋 İçindekiler

- [Özellikler](#-özellikler)
- [Teknoloji Stack](#-teknoloji-stack)
- [Kurulum](#-kurulum)
- [Kullanım](#-kullanım)
- [API Dokümantasyonu](#-api-dokümantasyonu)
- [Veritabanı Şeması](#-veritabanı-şeması)
- [Ekran Görüntüleri](#-ekran-görüntüleri)
- [Lisans](#-lisans)

## ✨ Özellikler

### 🔐 Kullanıcı Yönetimi
- **Rol Tabanlı Yetkilendirme**: Admin ve normal kullanıcı rolleri
- **JWT Kimlik Doğrulama**: Güvenli oturum yönetimi
- **Session Yönetimi**: Otomatik oturum süresi kontrolü

### 💰 Finansal Modüller

#### 📤 Ödeme Emri Sistemi
- IBAN, isim ve açıklama ile ödeme emri oluşturma
- AI destekli açıklama düzenleme ve kategorizasyon
- Admin onay mekanizması
- Dekont yükleme (PDF/Görüntü)
- Otomatik dekont analizi ve kayıt

#### 🏦 Banka Hesapları Yönetimi
- Çoklu banka hesabı desteği
- Gerçek zamanlı bakiye takibi
- İşlem geçmişi ve raporlama
- Para giriş/çıkış kayıtları
- Otomatik bakiye güncelleme

#### 💳 Kredi Kartları
- Kart bilgileri ve limit yönetimi
- Hesap kesim ve son ödeme tarihi takibi
- Esnek hesap durumu yönetimi
- Kullanım ve borç takibi

#### 👥 Kişi/Kurum Yönetimi
- Transfer yapılan kişi/kurumların kayıtları
- Detaylı ödeme geçmişi
- Otomatik kişi tanıma ve ekleme
- İletişim bilgileri yönetimi

#### 💸 Borç Yönetimi
- Borç ekleme ve düzenleme
- Kategori bazlı sınıflandırma
- Vade takibi ve hatırlatmalar
- Ödeme planları oluşturma

#### 🧾 Çek Yönetimi
- Çek bilgileri kayıt sistemi
- AI ile otomatik çek analizi
- Erken bozdurma hesaplamaları
- Vade takibi ve durum yönetimi

#### 💵 Gelir Kayıtları
- Şirket ödemeleri takibi
- Kategori bazlı gelir analizi
- Otomatik bakiye etkisi
- Doğrulama mekanizması

### 🤖 AI Özellikleri

#### 📊 Akıllı Analiz
- Dekont/fatura görüntü analizi (OCR)
- Otomatik tutar, tarih ve banka bilgisi çıkarma
- Harcama kategorizasyonu
- Anomali tespiti

#### 💡 Finansal Öneriler
- Tasarruf fırsatları analizi
- Harcama tahminleri
- Bütçe optimizasyon önerileri
- Finansal trend analizleri

### 👷 Çalışan Yönetimi
- Yemekhane personeli kayıtları
- AI destekli çalışan profil özetleri
- Maaş ve ödeme takibi
- Çalışan performans notları

### 📊 Raporlama ve Dashboard

#### 🎯 Özelleştirilebilir Dashboard
- Kullanıcı bazlı widget yönetimi
- Gerçek zamanlı finansal özet
- Grafik ve görselleştirmeler
- Hızlı erişim kısayolları

#### 📈 Detaylı Raporlar
- Tarih aralığı filtreleme
- Kategori bazlı analizler
- Kişi/kurum bazlı raporlar
- Excel/PDF export

### 🔔 Bildirim Sistemi
- Vade hatırlatmaları
- Limit aşım uyarıları
- Onay bekleyen işlemler
- Sistem bildirimleri

## 🛠 Teknoloji Stack

### Backend
- **Framework**: Python FastAPI
- **Veritabanı**: MongoDB (Motor async driver)
- **Kimlik Doğrulama**: JWT (python-jose)
- **AI Entegrasyonu**: Google Gemini API
- **Dosya İşleme**: PyPDF2, Pillow, PyMuPDF
- **Güvenlik**: bcrypt, python-multipart

### Frontend
- **Framework**: Next.js 15.3.3 (App Router)
- **Dil**: TypeScript
- **Stil**: Tailwind CSS v4
- **UI Kütüphanesi**: Radix UI, shadcn/ui
- **Grafik**: Recharts
- **State Yönetimi**: React Hooks
- **HTTP İstemci**: Native Fetch API

## 🚀 Kurulum

### Gereksinimler
- Node.js 18+
- Python 3.9+
- MongoDB 5.0+
- Google Gemini API Key

### Backend Kurulumu

```bash
# Proje dizinine gidin
cd backend

# Sanal ortam oluşturun
python -m venv venv

# Sanal ortamı aktifleştirin
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Bağımlılıkları yükleyin
pip install -r requirements.txt

# .env dosyası oluşturun
cp .env.example .env

# .env dosyasını düzenleyin ve gerekli değerleri girin:
# MONGODB_URL=mongodb://localhost:27017
# DATABASE_NAME=muhasebe_db
# SECRET_KEY=your-secret-key
# GEMINI_API_KEY=your-gemini-api-key
```

### Frontend Kurulumu

```bash
# Frontend dizinine gidin
cd frontend

# Bağımlılıkları yükleyin
npm install

# .env.local dosyası oluşturun
cp .env.example .env.local

# .env.local dosyasını düzenleyin:
# NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Veritabanı Kurulumu

```bash
# MongoDB'yi başlatın
mongod

# İlk kullanıcıları oluşturun (opsiyonel)
cd backend
python scripts/init_users.py
```

## 💻 Kullanım

### Servisleri Başlatma

#### Backend
```bash
cd backend
python -m uvicorn main:app --reload --port 8000
```

#### Frontend
```bash
cd frontend
npm run dev
```

Uygulama http://localhost:3000 adresinde çalışacaktır.

### Varsayılan Kullanıcılar

| Kullanıcı Tipi | Kullanıcı Adı | Şifre |
|----------------|---------------|--------|
| Admin | admin | admin123 |
| Normal Kullanıcı | user | user123 |

## 📚 API Dokümantasyonu

Backend çalışırken API dokümantasyonuna şu adreslerden erişebilirsiniz:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Ana Endpoint'ler

#### Kimlik Doğrulama
```
POST   /auth/login          # Giriş yap
POST   /auth/logout         # Çıkış yap
GET    /auth/me            # Kullanıcı bilgileri
PUT    /auth/update-user   # Kullanıcı güncelle
```

#### Ödeme Emirleri
```
GET    /payment-orders               # Tüm emirleri listele
POST   /payment-orders              # Yeni emir oluştur
PUT    /payment-orders/{id}         # Emir güncelle
DELETE /payment-orders/{id}         # Emir sil
POST   /payment-orders/{id}/approve # Emir onayla
POST   /payment-orders/{id}/reject  # Emir reddet
POST   /payment-orders/{id}/upload-receipt # Dekont yükle
```

#### Banka Hesapları
```
GET    /bank-accounts       # Hesapları listele
POST   /bank-accounts      # Yeni hesap ekle
PUT    /bank-accounts/{id} # Hesap güncelle
DELETE /bank-accounts/{id} # Hesap sil
```

#### Gelir Kayıtları
```
GET    /income              # Gelirleri listele
POST   /income             # Yeni gelir ekle
PUT    /income/{id}        # Gelir güncelle
DELETE /income/{id}        # Gelir sil
POST   /income/{id}/verify # Gelir doğrula
```

#### AI Servisleri
```
POST   /ai/analyze-receipt      # Dekont analizi
POST   /ai/categorize          # Kategorizasyon
POST   /ai/analyze-spending    # Harcama analizi
POST   /ai/financial-insights  # Finansal öneriler
```

## 🗄 Veritabanı Şeması

### Users Collection
```javascript
{
  _id: ObjectId,
  username: String,
  password_hash: String,
  name: String,
  role: "admin" | "user",
  created_at: Date,
  dashboard_widgets: Object,
  settings: Object
}
```

### PaymentOrders Collection
```javascript
{
  _id: ObjectId,
  created_by: ObjectId,
  recipient_name: String,
  recipient_iban: String,
  amount: Number,
  description: String,
  ai_processed_description: String,
  category: String,
  status: "pending" | "approved" | "rejected" | "completed",
  receipt_url: String,
  bank_account_id: ObjectId,
  created_at: Date,
  completed_at: Date,
  rejection_reason: String
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

### Transactions Collection
```javascript
{
  _id: ObjectId,
  type: "income" | "expense" | "transfer",
  amount: Number,
  description: String,
  category: String,
  bank_account_id: ObjectId,
  person_id: ObjectId,
  payment_order_id: ObjectId,
  income_id: ObjectId,
  receipt_url: String,
  date: Date,
  created_at: Date
}
```

## 🖼 Ekran Görüntüleri

### Dashboard
Modern ve özelleştirilebilir dashboard ile tüm finansal verilerinizi tek bakışta görün.

### Ödeme Emirleri
Kolay ödeme emri oluşturma ve yönetim arayüzü.

### Raporlar
Detaylı finansal raporlar ve grafikler.

## 🤝 Katkıda Bulunma

1. Bu repository'yi fork edin
2. Feature branch'i oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'feat: Add amazing feature'`)
4. Branch'inizi push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.

## 👥 İletişim

Proje Sahibi: [@LeatherFire](https://github.com/LeatherFire)

Proje Linki: [https://github.com/LeatherFire/Muhasebe-Y-netim-Sistemi](https://github.com/LeatherFire/Muhasebe-Y-netim-Sistemi)

---

⭐ Bu projeyi beğendiyseniz yıldız vermeyi unutmayın!