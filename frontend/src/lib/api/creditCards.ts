import { api } from '@/lib/auth';

export interface CreditCard {
  id: string;
  name: string;
  bank_name: string;
  limit: number;
  used_amount: number;
  available_limit: number;
  usage_percentage: number;
  statement_date: number;
  due_date: number;
  flexible_account: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CreditCardSummary {
  id: string;
  name: string;
  bank_name: string;
  limit: number;
  used_amount: number;
  available_limit: number;
  usage_percentage: number;
  statement_date: number;
  due_date: number;
  flexible_account: boolean;
  days_to_statement: number;
  days_to_due: number;
}

export interface CreditCardCreate {
  name: string;
  bank_name: string;
  limit: number;
  used_amount?: number;
  statement_date: number;
  due_date: number;
  flexible_account?: boolean;
}

export interface CreditCardUpdate {
  name?: string;
  bank_name?: string;
  limit?: number;
  used_amount?: number;
  statement_date?: number;
  due_date?: number;
  flexible_account?: boolean;
}

export interface CreditCardTransaction {
  id: string;
  credit_card_id: string;
  amount: number;
  description: string;
  category?: string;
  merchant?: string;
  transaction_date: string;
  installments: number;
  installment_amount?: number;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

export interface CreditCardTransactionCreate {
  credit_card_id: string;
  amount: number;
  description: string;
  category?: string;
  merchant?: string;
  transaction_date: string;
  installments?: number;
}

export interface CreditCardPayment {
  id: string;
  credit_card_id: string;
  amount: number;
  payment_date: string;
  payment_type: string;
  bank_account_id?: string;
  description?: string;
  created_by: string;
  created_at: string;
}

export interface CreditCardPaymentCreate {
  credit_card_id: string;
  amount: number;
  payment_date: string;
  payment_type: string;
  bank_account_id?: string;
  description?: string;
}

export const creditCardsApi = {
  getAll: async (): Promise<CreditCard[]> => {
    const response = await api.get('/credit-cards/');
    return response.data;
  },

  getSummary: async (): Promise<CreditCardSummary[]> => {
    const response = await api.get('/credit-cards/summary');
    return response.data;
  },

  getById: async (id: string): Promise<CreditCard> => {
    const response = await api.get(`/credit-cards/${id}`);
    return response.data;
  },

  create: async (cardData: CreditCardCreate): Promise<CreditCard> => {
    console.log('API: Creating credit card with data:', cardData);
    console.log('Data types:', {
      name: typeof cardData.name,
      bank_name: typeof cardData.bank_name,
      limit: typeof cardData.limit,
      used_amount: typeof cardData.used_amount,
      statement_date: typeof cardData.statement_date,
      due_date: typeof cardData.due_date,
      flexible_account: typeof cardData.flexible_account
    });
    const response = await api.post('/credit-cards/', cardData);
    return response.data;
  },

  update: async (id: string, cardData: CreditCardUpdate): Promise<CreditCard> => {
    const response = await api.put(`/credit-cards/${id}`, cardData);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/credit-cards/${id}`);
  },

  // Transaction operations
  getTransactions: async (cardId: string, params?: {
    limit?: number;
    skip?: number;
  }): Promise<CreditCardTransaction[]> => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }
    
    const response = await api.get(`/credit-cards/${cardId}/transactions?${searchParams.toString()}`);
    return response.data;
  },

  createTransaction: async (cardId: string, transactionData: CreditCardTransactionCreate): Promise<CreditCardTransaction> => {
    const response = await api.post(`/credit-cards/${cardId}/transactions`, transactionData);
    return response.data;
  },

  // Payment operations
  createPayment: async (cardId: string, paymentData: CreditCardPaymentCreate): Promise<CreditCardPayment> => {
    const response = await api.post(`/credit-cards/${cardId}/payments`, paymentData);
    return response.data;
  },
};

export const paymentTypeLabels: Record<string, string> = {
  minimum: 'Minimum Ödeme',
  full: 'Tam Ödeme',
  partial: 'Kısmi Ödeme'
};

export const categoryLabels: Record<string, string> = {
  food: 'Yiyecek & İçecek',
  shopping: 'Alışveriş',
  fuel: 'Yakıt',
  bills: 'Faturalar',
  entertainment: 'Eğlence',
  travel: 'Seyahat',
  health: 'Sağlık',
  education: 'Eğitim',
  other: 'Diğer'
};