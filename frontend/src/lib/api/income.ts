import { api } from '@/lib/auth';

export interface IncomeSource {
  id: string;
  name: string;
  description?: string;
  person_id?: string;
  income_type: 'recurring' | 'one_time' | 'project_based' | 'commission' | 'investment' | 'other';
  category: string;
  expected_amount: number;
  currency: string;
  is_recurring: boolean;
  recurrence_type?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  recurrence_interval?: number;
  start_date: string;
  end_date?: string;
  is_active: boolean;
  notes?: string;
  total_received: number;
  total_expected: number;
  income_count: number;
  last_income_date?: string;
  next_expected_date?: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

export interface IncomeSourceCreate {
  name: string;
  description?: string;
  person_id?: string;
  income_type: 'recurring' | 'one_time' | 'project_based' | 'commission' | 'investment' | 'other';
  category: string;
  expected_amount: number;
  currency?: string;
  is_recurring?: boolean;
  recurrence_type?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  recurrence_interval?: number;
  start_date: string;
  end_date?: string;
  is_active?: boolean;
  notes?: string;
}

export interface IncomeSourceUpdate {
  name?: string;
  description?: string;
  person_id?: string;
  income_type?: 'recurring' | 'one_time' | 'project_based' | 'commission' | 'investment' | 'other';
  category?: string;
  expected_amount?: number;
  currency?: string;
  is_recurring?: boolean;
  recurrence_type?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  recurrence_interval?: number;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  notes?: string;
}

export interface IncomeSourceSummary {
  id: string;
  name: string;
  income_type: string;
  category: string;
  expected_amount: number;
  currency: string;
  total_received: number;
  total_expected: number;
  income_count: number;
  last_income_date?: string;
  next_expected_date?: string;
  status: string;
  person_name?: string;
  completion_rate: number;
}

export interface IncomeRecord {
  id: string;
  income_source_id: string;
  amount: number;
  currency: string;
  description: string;
  expected_date: string;
  actual_date?: string;
  status: 'planned' | 'invoiced' | 'paid' | 'overdue' | 'cancelled';
  invoice_number?: string;
  transaction_id?: string;
  bank_account_id?: string;
  payment_method?: string;
  late_fee: number;
  discount: number;
  tax_amount: number;
  net_amount: number;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

export interface IncomeRecordCreate {
  income_source_id: string;
  amount: number;
  currency?: string;
  description: string;
  expected_date: string;
  actual_date?: string;
  status?: 'planned' | 'invoiced' | 'paid' | 'overdue' | 'cancelled';
  invoice_number?: string;
  transaction_id?: string;
  bank_account_id?: string;
  payment_method?: string;
  late_fee?: number;
  discount?: number;
  tax_amount?: number;
  notes?: string;
}

export interface IncomeStatistics {
  total_sources: number;
  active_sources: number;
  recurring_sources: number;
  total_expected_this_month: number;
  total_received_this_month: number;
  total_overdue: number;
  overdue_count: number;
  upcoming_week: number;
  upcoming_month: number;
  top_sources: Array<{
    id: string;
    name: string;
    total_received: number;
    income_type: string;
  }>;
  monthly_trends: Array<{
    month: string;
    total: number;
    count: number;
  }>;
  by_category: Array<{
    category: string;
    count: number;
    total_expected: number;
  }>;
  by_status: Array<{
    status: string;
    count: number;
    total_amount: number;
  }>;
}

export interface IncomeProjection {
  month: string;
  expected_total: number;
  confirmed_total: number;
  recurring_total: number;
  one_time_total: number;
  confidence_level: number;
}

export interface IncomeForecast {
  next_6_months: IncomeProjection[];
  yearly_projection: number;
  growth_rate: number;
  seasonality_factor: number;
  risk_level: string;
}

export const incomeApi = {
  // Income Sources
  async getIncomeSources(params?: {
    income_type?: string;
    category?: string;
    active_only?: boolean;
    limit?: number;
    skip?: number;
  }): Promise<IncomeSource[]> {
    const searchParams = new URLSearchParams();
    if (params?.income_type) searchParams.append('income_type', params.income_type);
    if (params?.category) searchParams.append('category', params.category);
    if (params?.active_only !== undefined) searchParams.append('active_only', params.active_only.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.skip) searchParams.append('skip', params.skip.toString());

    const queryString = searchParams.toString();
    const url = `/income/sources${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get(url);
    return response.data;
  },

  async getIncomeSourcesSummary(): Promise<IncomeSourceSummary[]> {
    const response = await api.get('/income/sources/summary');
    return response.data;
  },

  async getIncomeStatistics(): Promise<IncomeStatistics> {
    const response = await api.get('/income/statistics');
    return response.data;
  },

  async getIncomeSource(id: string): Promise<IncomeSource> {
    const response = await api.get(`/income/sources/${id}`);
    return response.data;
  },

  async createIncomeSource(data: IncomeSourceCreate): Promise<IncomeSource> {
    const response = await api.post('/income/sources', data);
    return response.data;
  },

  async updateIncomeSource(id: string, data: IncomeSourceUpdate): Promise<IncomeSource> {
    const response = await api.put(`/income/sources/${id}`, data);
    return response.data;
  },

  async deleteIncomeSource(id: string): Promise<void> {
    await api.delete(`/income/sources/${id}`);
  },

  // Income Records
  async getIncomeRecords(params?: {
    source_id?: string;
    status_filter?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
    skip?: number;
  }): Promise<IncomeRecord[]> {
    const searchParams = new URLSearchParams();
    if (params?.source_id) searchParams.append('source_id', params.source_id);
    if (params?.status_filter) searchParams.append('status_filter', params.status_filter);
    if (params?.start_date) searchParams.append('start_date', params.start_date);
    if (params?.end_date) searchParams.append('end_date', params.end_date);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.skip) searchParams.append('skip', params.skip.toString());

    const queryString = searchParams.toString();
    const url = `/income/records${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get(url);
    return response.data;
  },

  async createIncomeRecord(data: IncomeRecordCreate): Promise<IncomeRecord> {
    const response = await api.post('/income/records', data);
    return response.data;
  },

  async getIncomeForecast(): Promise<IncomeForecast> {
    const response = await api.get('/income/forecast');
    return response.data;
  },

  // Utility functions
  getIncomeTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'recurring': 'Düzenli Gelir',
      'one_time': 'Tek Seferlik',
      'project_based': 'Proje Bazlı',
      'commission': 'Komisyon',
      'investment': 'Yatırım Getirisi',
      'other': 'Diğer'
    };
    return labels[type] || type;
  },

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'planned': 'Planlandı',
      'invoiced': 'Faturalandı',
      'paid': 'Ödendi',
      'overdue': 'Gecikmiş',
      'cancelled': 'İptal'
    };
    return labels[status] || status;
  }
};