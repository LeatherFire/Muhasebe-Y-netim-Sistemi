from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.api.routes import auth, payment_orders, bank_accounts, credit_cards, people, transactions, debts, checks, ai_services, reports, income, notifications, dashboard, income_records, employees
from app.core.config import settings
from app.core.database import connect_to_mongo, close_mongo_connection

app = FastAPI(
    title="Muhasebe Yönetim Sistemi API",
    description="Küçük ölçekli şirketler için muhasebe yönetim sistemi",
    version="1.0.0",
)

# CORS middleware - Development configuration (must be before static files)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:3001", 
        "http://localhost:3002",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001", 
        "http://127.0.0.1:3002"
    ],
    allow_credentials=True,  # Now we can use credentials with specific origins
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Static files for uploads
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(payment_orders.router, prefix="/payment-orders", tags=["payment-orders"])
app.include_router(bank_accounts.router, prefix="/bank-accounts", tags=["bank-accounts"])
app.include_router(credit_cards.router, prefix="/credit-cards", tags=["credit-cards"])
app.include_router(people.router, prefix="/people", tags=["people"])
app.include_router(transactions.router, prefix="/transactions", tags=["transactions"])
app.include_router(debts.router, prefix="/debts", tags=["debts"])
app.include_router(checks.router, prefix="/checks", tags=["checks"])
app.include_router(ai_services.router, prefix="/ai", tags=["ai"])
app.include_router(reports.router, prefix="/reports", tags=["reports"])
app.include_router(income.router, prefix="/income", tags=["income"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
app.include_router(income_records.router, prefix="/income-records", tags=["income-records"])
app.include_router(employees.router, prefix="/employees", tags=["employees"])

@app.on_event("startup")
async def startup_event():
    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown_event():
    await close_mongo_connection()

@app.get("/")
async def root():
    return {"message": "Muhasebe Yönetim Sistemi API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)