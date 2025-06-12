import { api } from '@/lib/auth';

export type PaymentStatus = 'pending' | 'approved' | 'completed' | 'rejected' | 'cancelled';
export type PaymentCategory = 'office_supplies' | 'utilities' | 'salary' | 'rent' | 'insurance' | 'tax' | 'loan' | 'supplier' | 'service' | 'other';

export interface PaymentOrder {
  _id: string;
  recipient_name: string;
  recipient_iban: string;
  amount: number;
  currency: string;
  description: string;
  category?: PaymentCategory;
  due_date?: string;
  created_by: string;
  status: PaymentStatus;
  ai_processed_description?: string;
  ai_suggested_category?: PaymentCategory;
  receipt_url?: string;
  bank_account_id?: string;
  approved_by?: string;
  completed_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface PaymentOrderCreate {
  recipient_name: string;
  recipient_iban: string;
  amount: number;
  currency?: string;
  description: string;
  category?: PaymentCategory;
  due_date?: string;
}

export interface PaymentOrderUpdate {
  recipient_name?: string;
  recipient_iban?: string;
  amount?: number;
  currency?: string;
  description?: string;
  category?: PaymentCategory;
  due_date?: string;
  status?: PaymentStatus;
}

export interface PaymentOrderSummary {
  id: string;
  recipient_name: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  category?: PaymentCategory;
  created_at: string;
  due_date?: string;
}

export const paymentOrdersApi = {
  // Tüm emirleri getir
  getAll: async (params?: {
    status_filter?: PaymentStatus;
    category?: PaymentCategory;
    limit?: number;
    skip?: number;
  }): Promise<PaymentOrder[]> => {
    const response = await api.get('/payment-orders/', { params });
    return response.data;
  },

  // Özet bilgileri getir
  getSummary: async (): Promise<PaymentOrderSummary[]> => {
    const response = await api.get('/payment-orders/summary');
    return response.data;
  },

  // Bekleyen emirleri getir (admin için)
  getPending: async (): Promise<PaymentOrder[]> => {
    const response = await api.get('/payment-orders/pending');
    return response.data;
  },

  // Tek emir getir
  getById: async (id: string): Promise<PaymentOrder> => {
    const response = await api.get(`/payment-orders/${id}`);
    return response.data;
  },

  // Yeni emir oluştur
  create: async (data: PaymentOrderCreate): Promise<PaymentOrder> => {
    const response = await api.post('/payment-orders/', data);
    return response.data;
  },

  // Emir güncelle
  update: async (id: string, data: PaymentOrderUpdate): Promise<PaymentOrder> => {
    const response = await api.put(`/payment-orders/${id}`, data);
    return response.data;
  },

  // Emir sil
  delete: async (id: string): Promise<void> => {
    await api.delete(`/payment-orders/${id}`);
  },

  // Emir onayla (admin)
  approve: async (id: string): Promise<any> => {
    const response = await api.post(`/payment-orders/${id}/approve`);
    return response.data;
  },

  // Emir reddet (admin)
  reject: async (id: string, reason: string): Promise<any> => {
    const response = await api.post(`/payment-orders/${id}/reject`, null, {
      params: { reason }
    });
    return response.data;
  },

  // Emir tamamla (admin)
  complete: async (id: string, bankAccountId: string): Promise<any> => {
    const response = await api.post(`/payment-orders/${id}/complete`, null, {
      params: { bank_account_id: bankAccountId }
    });
    return response.data;
  },

  // Dekont yükle (admin)
  uploadReceipt: async (id: string, file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post(`/payment-orders/${id}/upload-receipt`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Dekont ile ödeme doğrulama (1. aşama)
  verifyPayment: async (id: string, bankAccountId: string, file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('bank_account_id', bankAccountId);
    formData.append('receipt_file', file);
    
    const response = await api.post(`/payment-orders/${id}/verify-payment`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Doğrulama sonrası ödeme onaylama (2. aşama)
  confirmPayment: async (id: string, tempFilePath: string, bankAccountId: string): Promise<any> => {
    const formData = new FormData();
    formData.append('temp_file_path', tempFilePath);
    formData.append('bank_account_id', bankAccountId);
    
    const response = await api.post(`/payment-orders/${id}/confirm-payment`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Dekont ile ödeme yap (eski method - geriye uyumluluk için)
  completeWithReceipt: async (id: string, bankAccountId: string, file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('bank_account_id', bankAccountId);
    formData.append('receipt_file', file);
    
    const response = await api.post(`/payment-orders/${id}/complete-with-receipt`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

export const categoryLabels: Record<PaymentCategory, string> = {
  office_supplies: 'Ofis Malzemeleri',
  utilities: 'Faturalar',
  salary: 'Maaş',
  rent: 'Kira',
  insurance: 'Sigorta',
  tax: 'Vergi',
  loan: 'Kredi',
  supplier: 'Tedarikçi',
  service: 'Hizmet',
  other: 'Diğer'
};

export const statusLabels: Record<PaymentStatus, string> = {
  pending: 'Bekliyor',
  approved: 'Onaylandı',
  completed: 'Tamamlandı',
  rejected: 'Reddedildi',
  cancelled: 'İptal edildi'
};

export const statusColors: Record<PaymentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800'
};