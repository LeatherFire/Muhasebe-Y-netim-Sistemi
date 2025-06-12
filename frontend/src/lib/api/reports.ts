import { api } from '@/lib/auth';

export interface ReportRequest {
  report_type: 'income_expense' | 'monthly_summary' | 'yearly_summary' | 'bank_account_summary' | 'person_summary' | 'payment_method_analysis' | 'cash_flow';
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  start_date: string;
  end_date: string;
  bank_account_ids?: string[];
  person_ids?: string[];
  include_pending?: boolean;
  format?: 'json' | 'pdf' | 'excel' | 'csv';
  group_by_currency?: boolean;
}

export interface IncomeExpenseReportData {
  total_income: number;
  total_expense: number;
  net_profit: number;
  transaction_count: number;
  income_by_month: Array<{ month: string; amount: number }>;
  expense_by_month: Array<{ month: string; amount: number }>;
  top_income_sources?: Array<{ name: string; amount: number }>;
  top_expense_categories?: Array<{ name: string; amount: number }>;
}

export interface CashFlowReportData {
  opening_balance: number;
  closing_balance: number;
  total_inflow: number;
  total_outflow: number;
  net_cash_flow: number;
  daily_flows?: Array<{ date: string; inflow: number; outflow: number }>;
  bank_account_flows?: Array<{ account_name: string; inflow: number; outflow: number }>;
}

export interface BankAccountSummaryData {
  account_id: string;
  account_name: string;
  currency: string;
  opening_balance: number;
  closing_balance: number;
  total_income: number;
  total_expense: number;
  transaction_count: number;
  average_daily_balance?: number;
}

export interface PersonSummaryData {
  person_id: string;
  person_name: string;
  person_type: string;
  total_sent: number;
  total_received: number;
  net_balance: number;
  transaction_count: number;
  last_transaction_date?: string;
}

export interface PaymentMethodAnalysisData {
  method: string;
  transaction_count: number;
  total_amount: number;
  percentage: number;
  average_amount: number;
}

export interface ReportData {
  income_expense?: IncomeExpenseReportData;
  cash_flow?: CashFlowReportData;
  bank_accounts?: BankAccountSummaryData[];
  people?: PersonSummaryData[];
  payment_methods?: PaymentMethodAnalysisData[];
  custom_data?: Record<string, any>;
}

export interface Report {
  id: string;
  report_type: string;
  title: string;
  description?: string;
  period: string;
  start_date: string;
  end_date: string;
  generated_at: string;
  generated_by: string;
  data: ReportData;
  metadata: Record<string, any>;
  file_path?: string;
  status: string;
  created_at: string;
  updated_at?: string;
}

export interface ReportSummary {
  id: string;
  title: string;
  report_type: string;
  period: string;
  start_date: string;
  end_date: string;
  generated_at: string;
  status: string;
  file_path?: string;
}

export interface DashboardStats {
  current_month_income: number;
  current_month_expense: number;
  current_month_profit: number;
  total_bank_balance: number;
  pending_payments: number;
  active_debts: number;
  recent_transactions: Array<{
    id: string;
    type: string;
    amount: number;
    description: string;
    transaction_date: string;
    bank_account_name?: string;
    person_name?: string;
  }>;
  monthly_trends: Array<{
    month: string;
    income: number;
    expense: number;
  }>;
  top_expenses: Array<{
    amount: number;
    description: string;
    transaction_date: string;
    person_name?: string;
  }>;
  cash_flow_forecast?: Array<{
    date: string;
    projected_balance: number;
  }>;
}

export const reportsApi = {
  // Dashboard istatistiklerini getir
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await api.get('/reports/dashboard-stats');
    return response.data;
  },

  // Rapor oluştur
  async generateReport(data: ReportRequest): Promise<Report> {
    const response = await api.post('/reports/generate', data);
    return response.data;
  },

  // Raporları listele
  async getReports(params?: {
    limit?: number;
    skip?: number;
  }): Promise<ReportSummary[]> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.skip) searchParams.append('skip', params.skip.toString());

    const queryString = searchParams.toString();
    const url = `/reports${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get(url);
    return response.data;
  },

  // Tek rapor getir
  async getReport(id: string): Promise<Report> {
    const response = await api.get(`/reports/${id}`);
    return response.data;
  },

  // Rapor sil
  async deleteReport(id: string): Promise<void> {
    await api.delete(`/reports/${id}`);
  },

  // Hızlı rapor oluştur (ön tanımlı parametrelerle)
  async generateQuickReport(type: 'monthly' | 'yearly' | 'current_month'): Promise<Report> {
    const now = new Date();
    let start_date: string;
    let end_date: string;
    let period: ReportRequest['period'];
    let report_type: ReportRequest['report_type'];

    switch (type) {
      case 'monthly':
        start_date = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        end_date = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        period = 'monthly';
        report_type = 'income_expense';
        break;
      case 'yearly':
        start_date = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        end_date = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
        period = 'yearly';
        report_type = 'income_expense';
        break;
      case 'current_month':
        start_date = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        end_date = now.toISOString().split('T')[0];
        period = 'monthly';
        report_type = 'cash_flow';
        break;
      default:
        throw new Error('Geçersiz hızlı rapor türü');
    }

    return this.generateReport({
      report_type,
      period,
      start_date,
      end_date,
      include_pending: false,
      group_by_currency: true
    });
  }
};