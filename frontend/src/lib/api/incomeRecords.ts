import { api } from '@/lib/auth';

export type IncomeRecordStatus = 'pending' | 'verified' | 'rejected';

export interface IncomeRecord {
  id: string;
  company_name: string;
  amount: number;
  currency: string;
  bank_account_id: string;
  receipt_file?: string;
  description?: string;
  income_date: string;
  status: IncomeRecordStatus;
  created_at: string;
  created_by: string;
  verified_at?: string;
  verified_by?: string;
  rejection_reason?: string;
}

export interface IncomeRecordSummary {
  id: string;
  company_name: string;
  amount: number;
  currency: string;
  bank_account_name: string;
  status: IncomeRecordStatus;
  income_date: string;
  created_at: string;
  has_receipt: boolean;
}

export interface IncomeRecordCreate {
  company_name: string;
  amount: number;
  currency?: string;
  bank_account_id: string;
  description?: string;
  income_date: string;
  receipt_file?: File;
}

export interface IncomeStatistics {
  total_records: number;
  pending_count: number;
  verified_count: number;
  rejected_count: number;
  total_verified_amount: number;
  current_month_income: number;
  previous_month_income: number;
  monthly_growth_rate: number;
  top_companies: Array<{
    company_name: string;
    total_amount: number;
    payment_count: number;
  }>;
  monthly_trend: Array<{
    month: string;
    total_amount: number;
    record_count: number;
  }>;
}

export const incomeRecordsApi = {
  // Create new income record with file upload
  async createRecord(data: IncomeRecordCreate): Promise<IncomeRecord> {
    console.log('Creating income record with data:', data);
    
    const formData = new FormData();
    formData.append('company_name', data.company_name);
    formData.append('amount', data.amount.toString());
    formData.append('currency', data.currency || 'TRY');
    formData.append('bank_account_id', data.bank_account_id);
    formData.append('income_date', data.income_date);
    
    if (data.description) {
      formData.append('description', data.description);
    }
    
    if (data.receipt_file) {
      formData.append('receipt_file', data.receipt_file);
    }

    console.log('Sending POST to /income-records with FormData');
    console.log('FormData entries:', Array.from(formData.entries()));

    const response = await api.post('/income-records/', formData);
    // Note: Don't set Content-Type for FormData, browser sets it automatically with boundary
    
    console.log('Income record created successfully:', response.data);
    return response.data;
  },

  // Get income records with filters
  async getRecords(params?: {
    status_filter?: IncomeRecordStatus;
    company_name?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
    skip?: number;
  }): Promise<IncomeRecordSummary[]> {
    const searchParams = new URLSearchParams();
    
    if (params?.status_filter) searchParams.append('status_filter', params.status_filter);
    if (params?.company_name) searchParams.append('company_name', params.company_name);
    if (params?.start_date) searchParams.append('start_date', params.start_date);
    if (params?.end_date) searchParams.append('end_date', params.end_date);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.skip) searchParams.append('skip', params.skip.toString());

    const queryString = searchParams.toString();
    const url = `/income-records/${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get(url);
    return response.data;
  },

  // Get income statistics  
  async getStatistics(): Promise<IncomeStatistics> {
    const response = await api.get('/income-records/statistics');
    return response.data;
  },

  // Verify income record (admin only)
  async verifyRecord(recordId: string): Promise<IncomeRecord> {
    const response = await api.put(`/income-records/${recordId}/verify`);
    return response.data;
  },

  // Reject income record (admin only)
  async rejectRecord(recordId: string, rejectionReason: string): Promise<IncomeRecord> {
    const formData = new FormData();
    formData.append('rejection_reason', rejectionReason);

    const response = await api.put(`/income-records/${recordId}/reject`, formData);
    return response.data;
  },

  // Delete income record
  async deleteRecord(recordId: string): Promise<void> {
    await api.delete(`/income-records/${recordId}`);
  },

  // Utility functions
  getStatusColor(status: IncomeRecordStatus): string {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  },

  getStatusLabel(status: IncomeRecordStatus): string {
    switch (status) {
      case 'verified':
        return 'Onaylandı';
      case 'pending':
        return 'Beklemede';
      case 'rejected':
        return 'Reddedildi';
      default:
        return status;
    }
  },

  formatCurrency(amount: number, currency: string = 'TRY'): string {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  },

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('tr-TR');
  },

  formatDateTime(dateString: string): string {
    return new Date(dateString).toLocaleString('tr-TR');
  }
};