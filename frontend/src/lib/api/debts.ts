import { api } from '@/lib/auth';

export interface Debt {
  id: string;
  creditor_name: string;
  debtor_name?: string;
  amount: number;
  currency: string;
  description: string;
  category: 'supplier' | 'tax' | 'salary' | 'loan' | 'utility' | 'rent' | 'insurance' | 'service' | 'other';
  debt_type: 'payable' | 'receivable';
  due_date: string;
  interest_rate?: number;
  payment_terms?: string;
  notes?: string;
  status: 'active' | 'paid' | 'partial' | 'overdue' | 'cancelled';
  paid_amount: number;
  remaining_amount: number;
  last_payment_date?: string;
  payment_count: number;
  days_overdue: number;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

export interface DebtCreate {
  creditor_name: string;
  debtor_name?: string;
  amount: number;
  currency?: string;
  description: string;
  category: 'supplier' | 'tax' | 'salary' | 'loan' | 'utility' | 'rent' | 'insurance' | 'service' | 'other';
  debt_type?: 'payable' | 'receivable';
  due_date: string;
  interest_rate?: number;
  payment_terms?: string;
  notes?: string;
}

export interface DebtUpdate {
  creditor_name?: string;
  debtor_name?: string;
  amount?: number;
  currency?: string;
  description?: string;
  category?: 'supplier' | 'tax' | 'salary' | 'loan' | 'utility' | 'rent' | 'insurance' | 'service' | 'other';
  debt_type?: 'payable' | 'receivable';
  due_date?: string;
  interest_rate?: number;
  payment_terms?: string;
  notes?: string;
  status?: 'active' | 'paid' | 'partial' | 'overdue' | 'cancelled';
}

export interface DebtSummary {
  id: string;
  creditor_name: string;
  debtor_name?: string;
  amount: number;
  paid_amount: number;
  remaining_amount: number;
  currency: string;
  category: string;
  debt_type: string;
  status: string;
  due_date: string;
  days_overdue: number;
  interest_rate?: number;
  payment_count: number;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  bank_account_id?: string;
  description?: string;
  receipt_url?: string;
  created_by: string;
  created_at: string;
}

export interface DebtPaymentCreate {
  debt_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  bank_account_id?: string;
  description?: string;
}

export interface DebtStatistics {
  total_debts: number;
  total_receivables: number;
  total_debt_amount: number;
  total_receivable_amount: number;
  overdue_debts: number;
  overdue_amount: number;
  paid_this_month: number;
  upcoming_payments: Array<{
    id: string;
    creditor_name: string;
    amount: number;
    due_date: string;
    days_until_due: number;
  }>;
}

export const debtsApi = {
  // Borçları listele
  async getDebts(params?: {
    debt_type?: 'payable' | 'receivable';
    status?: 'active' | 'paid' | 'partial' | 'overdue' | 'cancelled';
    category?: 'supplier' | 'tax' | 'salary' | 'loan' | 'utility' | 'rent' | 'insurance' | 'service' | 'other';
    overdue_only?: boolean;
    limit?: number;
    skip?: number;
  }): Promise<Debt[]> {
    const searchParams = new URLSearchParams();
    if (params?.debt_type) searchParams.append('debt_type', params.debt_type);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.category) searchParams.append('category', params.category);
    if (params?.overdue_only) searchParams.append('overdue_only', params.overdue_only.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.skip) searchParams.append('skip', params.skip.toString());

    const queryString = searchParams.toString();
    const url = `/debts${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get(url);
    return response.data;
  },

  // Borç özet bilgilerini getir
  async getDebtsSummary(): Promise<DebtSummary[]> {
    const response = await api.get('/debts/summary');
    return response.data;
  },

  // Borç istatistiklerini getir
  async getDebtStatistics(): Promise<DebtStatistics> {
    const response = await api.get('/debts/statistics');
    return response.data;
  },

  // Tek borç getir
  async getDebt(id: string): Promise<Debt> {
    const response = await api.get(`/debts/${id}`);
    return response.data;
  },

  // Yeni borç oluştur
  async createDebt(data: DebtCreate): Promise<Debt> {
    const response = await api.post('/debts', data);
    return response.data;
  },

  // Borç güncelle
  async updateDebt(id: string, data: DebtUpdate): Promise<Debt> {
    const response = await api.put(`/debts/${id}`, data);
    return response.data;
  },

  // Borç sil
  async deleteDebt(id: string): Promise<void> {
    await api.delete(`/debts/${id}`);
  },

  // Borç ödemelerini getir
  async getDebtPayments(debtId: string, params?: {
    limit?: number;
    skip?: number;
  }): Promise<DebtPayment[]> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.skip) searchParams.append('skip', params.skip.toString());

    const queryString = searchParams.toString();
    const url = `/debts/${debtId}/payments${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get(url);
    return response.data;
  },

  // Borç ödemesi oluştur
  async createDebtPayment(data: DebtPaymentCreate): Promise<DebtPayment> {
    const response = await api.post(`/debts/${data.debt_id}/payments`, data);
    return response.data;
  }
};