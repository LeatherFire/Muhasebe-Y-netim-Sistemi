import { api } from '@/lib/auth';

export interface BankAccount {
  _id: string;
  name: string;
  iban: string;
  bank_name: string;
  account_type: 'checking' | 'savings' | 'business' | 'foreign';
  currency: string;
  current_balance: number;
  initial_balance: number;
  created_at: string;
  updated_at?: string;
}

export interface BankAccountCreate {
  name: string;
  iban: string;
  bank_name: string;
  account_type: 'checking' | 'savings' | 'business' | 'foreign';
  currency?: string;
  initial_balance: number;
}

export interface BankAccountUpdate {
  name?: string;
  bank_name?: string;
  account_type?: 'checking' | 'savings' | 'business' | 'foreign';
  currency?: string;
}

export interface BankAccountSummary {
  id: string;
  name: string;
  bank_name: string;
  current_balance: number;
  currency: string;
  account_type: 'checking' | 'savings' | 'business' | 'foreign';
}

export const bankAccountsApi = {
  // Tüm hesapları getir
  getAll: async (): Promise<BankAccount[]> => {
    const response = await api.get('/bank-accounts/');
    return response.data;
  },

  // Özet bilgileri getir
  getSummary: async (): Promise<BankAccountSummary[]> => {
    const response = await api.get('/bank-accounts/summary');
    return response.data;
  },

  // Tek hesap getir
  getById: async (id: string): Promise<BankAccount> => {
    const response = await api.get(`/bank-accounts/${id}`);
    return response.data;
  },

  // Yeni hesap oluştur
  create: async (data: BankAccountCreate): Promise<BankAccount> => {
    const response = await api.post('/bank-accounts/', data);
    return response.data;
  },

  // Hesap güncelle
  update: async (id: string, data: BankAccountUpdate): Promise<BankAccount> => {
    const response = await api.put(`/bank-accounts/${id}`, data);
    return response.data;
  },

  // Hesap sil
  delete: async (id: string): Promise<void> => {
    await api.delete(`/bank-accounts/${id}`);
  },

  // Bakiye güncelle
  updateBalance: async (id: string, amount: number, description: string): Promise<any> => {
    const response = await api.post(`/bank-accounts/${id}/update-balance`, null, {
      params: { amount, description }
    });
    return response.data;
  },
};