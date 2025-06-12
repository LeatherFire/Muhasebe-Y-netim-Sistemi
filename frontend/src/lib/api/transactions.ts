import { api } from '@/lib/auth';

export interface TransactionSummary {
  id: string;
  _id?: string; // Backend compatibility
  type: 'income' | 'expense' | 'transfer' | 'fee' | 'interest' | 'refund';
  amount: number;
  currency: string;
  description: string;
  bank_account_name: string;
  person_name?: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  transaction_date: string;
  receipt_url?: string;
  total_fees: number;
}

export interface Transaction extends TransactionSummary {
  _id?: string; // Backend compatibility
  reference_number?: string;
  bank_account_id: string;
  payment_order_id?: string;
  person_id?: string;
  fees: Record<string, number>;
  ai_extracted_data?: any;
  net_amount: number;
  balance_impact: number;
  receipt_filename?: string;
  receipt_analysis?: any;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

export interface ReceiptAnalysisResult {
  success: boolean;
  extracted_amount?: number;
  extracted_date?: string;
  extracted_bank?: string;
  extracted_account?: string;
  extracted_reference?: string;
  extracted_fees?: Record<string, number>;
  total_extracted_fees?: number;
  recipient_info?: Record<string, string>;
  confidence_score?: number;
  raw_text?: string;
  error_message?: string;
}

export interface ProcessReceiptPaymentResponse {
  message: string;
  transaction_id: string;
  extracted_amount: number;
  total_fees: number;
  net_deducted: number;
  new_balance: number;
  ai_confidence: number;
  receipt_filename: string;
}

export const transactionsApi = {
  getAll: async (params?: {
    transaction_type?: string;
    bank_account_id?: string;
    status_filter?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
    skip?: number;
  }): Promise<Transaction[]> => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          searchParams.append(key, value.toString());
        }
      });
    }
    
    const response = await api.get(`/transactions/?${searchParams.toString()}`);
    return response.data;
  },

  getSummary: async (): Promise<TransactionSummary[]> => {
    const response = await api.get('/transactions/summary');
    return response.data;
  },

  getById: async (id: string): Promise<Transaction> => {
    const response = await api.get(`/transactions/${id}`);
    return response.data;
  },

  analyzeReceipt: async (file: File, paymentOrderId?: string): Promise<ReceiptAnalysisResult> => {
    const formData = new FormData();
    formData.append('file', file);
    if (paymentOrderId) {
      formData.append('payment_order_id', paymentOrderId);
    }

    const response = await api.post('/transactions/analyze-receipt', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  processReceiptPayment: async (
    paymentOrderId: string,
    file: File,
    bankAccountId: string
  ): Promise<ProcessReceiptPaymentResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post(
      `/transactions/process-receipt-payment?payment_order_id=${paymentOrderId}&bank_account_id=${bankAccountId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  downloadReceipt: async (transactionId: string): Promise<Blob> => {
    const response = await api.get(`/transactions/download-receipt/${transactionId}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // AI ile sohbet
  chatWithAI: async (transactionId: string, message: string): Promise<{response: string}> => {
    const response = await api.post(`/transactions/${transactionId}/chat`, {
      message: message
    });
    return response.data;
  },

  // AI ile işlem analizi
  analyzeTransaction: async (transactionId: string): Promise<{analysis: string}> => {
    const response = await api.post(`/transactions/${transactionId}/analyze`);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/transactions/${id}`);
  },
};

export const typeLabels: Record<string, string> = {
  income: 'Gelir',
  expense: 'Gider', 
  transfer: 'Transfer',
  fee: 'Ücret',
  interest: 'Faiz',
  refund: 'İade'
};

export const statusLabels: Record<string, string> = {
  pending: 'Bekliyor',
  completed: 'Tamamlandı',
  failed: 'Başarısız',
  cancelled: 'İptal Edildi'
};

export const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800'
};

export const typeColors: Record<string, string> = {
  income: 'text-green-600',
  expense: 'text-red-600',
  transfer: 'text-blue-600',
  fee: 'text-orange-600',
  interest: 'text-purple-600',
  refund: 'text-indigo-600'
};