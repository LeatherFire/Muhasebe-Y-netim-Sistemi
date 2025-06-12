# 🏢 Accounting Management System

Modern, user-friendly and AI-powered accounting management system. A comprehensive solution for small and medium-sized businesses featuring income-expense tracking, bank account management, debt tracking, and financial reporting.

[🇹🇷 Türkçe README](README_TR.md)

![Next.js](https://img.shields.io/badge/Next.js-15.3.3-black?style=for-the-badge&logo=next.js)
![Python](https://img.shields.io/badge/Python-3.9+-blue?style=for-the-badge&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-green?style=for-the-badge&logo=fastapi)
![MongoDB](https://img.shields.io/badge/MongoDB-5.0+-darkgreen?style=for-the-badge&logo=mongodb)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)

## 📋 Table of Contents

- [Features](#-features)
- [Technology Stack](#-technology-stack)
- [Installation](#-installation)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Database Schema](#-database-schema)
- [Screenshots](#-screenshots)
- [License](#-license)

## ✨ Features

### 🔐 User Management
- **Role-Based Authorization**: Admin and regular user roles
- **JWT Authentication**: Secure session management
- **Session Management**: Automatic session timeout control

### 💰 Financial Modules

#### 📤 Payment Order System
- Create payment orders with IBAN, name, and description
- AI-powered description editing and categorization
- Admin approval mechanism
- Receipt upload (PDF/Image)
- Automatic receipt analysis and recording

#### 🏦 Bank Account Management
- Multi-bank account support
- Real-time balance tracking
- Transaction history and reporting
- Money inflow/outflow records
- Automatic balance updates

#### 💳 Credit Cards
- Card information and limit management
- Statement and due date tracking
- Flexible account status management
- Usage and debt tracking

#### 👥 Person/Organization Management
- Records of transferred persons/organizations
- Detailed payment history
- Automatic person recognition and addition
- Contact information management

#### 💸 Debt Management
- Debt addition and editing
- Category-based classification
- Due date tracking and reminders
- Payment plan creation

#### 🧾 Check Management
- Check information recording system
- Automatic check analysis with AI
- Early discount calculations
- Due date tracking and status management

#### 💵 Income Records
- Company payment tracking
- Category-based income analysis
- Automatic balance impact
- Verification mechanism

### 🤖 AI Features

#### 📊 Smart Analysis
- Receipt/invoice image analysis (OCR)
- Automatic extraction of amount, date, and bank information
- Expense categorization
- Anomaly detection

#### 💡 Financial Recommendations
- Savings opportunity analysis
- Expense predictions
- Budget optimization suggestions
- Financial trend analysis

### 👷 Employee Management
- Cafeteria staff records
- AI-powered employee profile summaries
- Salary and payment tracking
- Employee performance notes

### 📊 Reporting and Dashboard

#### 🎯 Customizable Dashboard
- User-based widget management
- Real-time financial summary
- Charts and visualizations
- Quick access shortcuts

#### 📈 Detailed Reports
- Date range filtering
- Category-based analysis
- Person/organization-based reports
- Excel/PDF export

### 🔔 Notification System
- Due date reminders
- Limit exceeded warnings
- Pending approval transactions
- System notifications

## 🛠 Technology Stack

### Backend
- **Framework**: Python FastAPI
- **Database**: MongoDB (Motor async driver)
- **Authentication**: JWT (python-jose)
- **AI Integration**: Google Gemini API
- **File Processing**: PyPDF2, Pillow, PyMuPDF
- **Security**: bcrypt, python-multipart

### Frontend
- **Framework**: Next.js 15.3.3 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Library**: Radix UI, shadcn/ui
- **Charts**: Recharts
- **State Management**: React Hooks
- **HTTP Client**: Native Fetch API

## 🚀 Installation

### Requirements
- Node.js 18+
- Python 3.9+
- MongoDB 5.0+
- Google Gemini API Key

### Backend Setup

```bash
# Navigate to project directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Edit .env file and add required values:
# MONGODB_URL=mongodb://localhost:27017
# DATABASE_NAME=muhasebe_db
# SECRET_KEY=your-secret-key
# GEMINI_API_KEY=your-gemini-api-key
```

### Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Create .env.local file
cp .env.example .env.local

# Edit .env.local file:
# NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Database Setup

```bash
# Start MongoDB
mongod

# Create initial users (optional)
cd backend
python scripts/init_users.py
```

## 💻 Usage

### Starting Services

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

The application will run at http://localhost:3000

### Default Users

| User Type | Username | Password |
|-----------|----------|----------|
| Admin | admin | admin123 |
| Regular User | user | user123 |

## 📚 API Documentation

When the backend is running, you can access API documentation at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Main Endpoints

#### Authentication
```
POST   /auth/login          # Login
POST   /auth/logout         # Logout
GET    /auth/me            # User information
PUT    /auth/update-user   # Update user
```

#### Payment Orders
```
GET    /payment-orders               # List all orders
POST   /payment-orders              # Create new order
PUT    /payment-orders/{id}         # Update order
DELETE /payment-orders/{id}         # Delete order
POST   /payment-orders/{id}/approve # Approve order
POST   /payment-orders/{id}/reject  # Reject order
POST   /payment-orders/{id}/upload-receipt # Upload receipt
```

#### Bank Accounts
```
GET    /bank-accounts       # List accounts
POST   /bank-accounts      # Add new account
PUT    /bank-accounts/{id} # Update account
DELETE /bank-accounts/{id} # Delete account
```

#### Income Records
```
GET    /income              # List income
POST   /income             # Add new income
PUT    /income/{id}        # Update income
DELETE /income/{id}        # Delete income
POST   /income/{id}/verify # Verify income
```

#### AI Services
```
POST   /ai/analyze-receipt      # Receipt analysis
POST   /ai/categorize          # Categorization
POST   /ai/analyze-spending    # Spending analysis
POST   /ai/financial-insights  # Financial insights
```

## 🗄 Database Schema

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

## 🖼 Screenshots

### Dashboard
View all your financial data at a glance with our modern and customizable dashboard.

### Payment Orders
Easy payment order creation and management interface.

### Reports
Detailed financial reports and charts.

## 🤝 Contributing

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 👥 Contact

Project Owner: [@LeatherFire](https://github.com/LeatherFire)

Project Link: [https://github.com/LeatherFire/Muhasebe-Yonetim-Sistemi](https://github.com/LeatherFire/Muhasebe-Yonetim-Sistemi)

---

⭐ If you like this project, don't forget to give it a star!