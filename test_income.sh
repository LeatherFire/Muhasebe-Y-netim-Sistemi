#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImV4cCI6MTc0OTIyNjA2M30.aCdWxKqBvkJBudHY5aEXFwZfDuO64FKS4yiPHx6BW9w"

curl -X POST "http://localhost:8000/income-records/" \
  -H "Authorization: Bearer $TOKEN" \
  -F "company_name=Test Company" \
  -F "amount=1000" \
  -F "currency=TRY" \
  -F "bank_account_id=6842728b16285be090659825" \
  -F "income_date=2024-06-06" \
  -F "description=Test income"