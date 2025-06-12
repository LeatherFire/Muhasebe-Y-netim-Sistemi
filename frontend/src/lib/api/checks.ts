import { api } from '@/lib/auth';

export interface Check {
  id: string;
  amount: number;
  currency: string;
  check_number: string;
  bank_name: string;
  branch_name?: string;
  account_number?: string;
  drawer_name: string;
  drawer_id_number?: string;
  payee_name?: string;
  issue_date: string;
  due_date: string;
  check_type: 'received' | 'issued';
  description?: string;
  location?: string;
  notes?: string;
  status: 'active' | 'cashed' | 'returned' | 'cancelled' | 'lost' | 'early_cashed';
  early_discount_rate?: number;
  early_cash_amount?: number;
  cash_date?: string;
  return_reason?: string;
  days_to_due: number;
  is_overdue: boolean;
  receipt_url?: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

export interface CheckCreate {
  amount: number;
  currency?: string;
  check_number: string;
  bank_name: string;
  branch_name?: string;
  account_number?: string;
  drawer_name: string;
  drawer_id_number?: string;
  payee_name?: string;
  issue_date: string;
  due_date: string;
  check_type: 'received' | 'issued';
  description?: string;
  location?: string;
  notes?: string;
}

export interface CheckUpdate {
  amount?: number;
  currency?: string;
  check_number?: string;
  bank_name?: string;
  branch_name?: string;
  account_number?: string;
  drawer_name?: string;
  drawer_id_number?: string;
  payee_name?: string;
  issue_date?: string;
  due_date?: string;
  check_type?: 'received' | 'issued';
  description?: string;
  location?: string;
  notes?: string;
  status?: 'active' | 'cashed' | 'returned' | 'cancelled' | 'lost' | 'early_cashed';
}

export interface CheckSummary {
  id: string;
  amount: number;
  currency: string;
  check_number: string;
  bank_name: string;
  drawer_name: string;
  due_date: string;
  check_type: 'received' | 'issued';
  status: string;
  days_to_due: number;
  is_overdue: boolean;
  early_discount_rate?: number;
  potential_early_amount?: number;
}

export interface CheckOperation {
  id: string;
  check_id: string;
  operation_type: string;
  operation_date: string;
  amount?: number;
  bank_account_id?: string;
  discount_rate?: number;
  fees?: number;
  description?: string;
  receipt_url?: string;
  created_by: string;
  created_at: string;
}

export interface CheckOperationCreate {
  check_id: string;
  operation_type: string;
  operation_date: string;
  amount?: number;
  bank_account_id?: string;
  discount_rate?: number;
  fees?: number;
  description?: string;
}

export interface CheckStatistics {
  total_checks: number;
  total_received: number;
  total_issued: number;
  total_value: number;
  active_checks: number;
  active_value: number;
  overdue_checks: number;
  overdue_value: number;
  cashed_this_month: number;
  upcoming_due: Array<{
    id: string;
    check_number: string;
    drawer_name: string;
    amount: number;
    due_date: string;
    days_until_due: number;
  }>;
}

export interface CheckAnalysisResult {
  success: boolean;
  extracted_amount?: number;
  extracted_check_number?: string;
  extracted_bank?: string;
  extracted_date?: string;
  extracted_due_date?: string;
  extracted_drawer?: string;
  extracted_payee?: string;
  confidence_score?: number;
  raw_text?: string;
  error_message?: string;
}

export const checksApi = {
  // Çekleri listele
  async getChecks(params?: {
    check_type?: 'received' | 'issued';
    status?: 'active' | 'cashed' | 'returned' | 'cancelled' | 'lost' | 'early_cashed';
    bank_name?: string;
    overdue_only?: boolean;
    due_soon?: boolean;
    limit?: number;
    skip?: number;
  }): Promise<Check[]> {
    const searchParams = new URLSearchParams();
    if (params?.check_type) searchParams.append('check_type', params.check_type);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.bank_name) searchParams.append('bank_name', params.bank_name);
    if (params?.overdue_only) searchParams.append('overdue_only', params.overdue_only.toString());
    if (params?.due_soon) searchParams.append('due_soon', params.due_soon.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.skip) searchParams.append('skip', params.skip.toString());

    const queryString = searchParams.toString();
    const url = `/checks${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get(url);
    return response.data;
  },

  // Çek özet bilgilerini getir
  async getChecksSummary(): Promise<CheckSummary[]> {
    const response = await api.get('/checks/summary');
    return response.data;
  },

  // Çek istatistiklerini getir
  async getCheckStatistics(): Promise<CheckStatistics> {
    const response = await api.get('/checks/statistics');
    return response.data;
  },

  // Tek çek getir
  async getCheck(id: string): Promise<Check> {
    const response = await api.get(`/checks/${id}`);
    return response.data;
  },

  // Yeni çek oluştur
  async createCheck(data: CheckCreate): Promise<Check> {
    const response = await api.post('/checks', data);
    return response.data;
  },

  // Çek güncelle
  async updateCheck(id: string, data: CheckUpdate): Promise<Check> {
    const response = await api.put(`/checks/${id}`, data);
    return response.data;
  },

  // Çek sil
  async deleteCheck(id: string): Promise<void> {
    await api.delete(`/checks/${id}`);
  },

  // Çek işlemlerini getir
  async getCheckOperations(checkId: string, params?: {
    limit?: number;
    skip?: number;
  }): Promise<CheckOperation[]> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.skip) searchParams.append('skip', params.skip.toString());

    const queryString = searchParams.toString();
    const url = `/checks/${checkId}/operations${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get(url);
    return response.data;
  },

  // Çek işlemi oluştur
  async createCheckOperation(data: CheckOperationCreate): Promise<CheckOperation> {
    const response = await api.post(`/checks/${data.check_id}/operations`, data);
    return response.data;
  },

  // Çek resmi analiz et
  async analyzeCheckImage(file: File): Promise<CheckAnalysisResult> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/checks/analyze-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }
};