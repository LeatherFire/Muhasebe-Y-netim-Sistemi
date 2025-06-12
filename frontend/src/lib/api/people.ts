import { api } from '@/lib/auth';

export interface Person {
  id: string;
  name: string;
  person_type: 'individual' | 'company';
  id_number?: string;
  tax_number?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  contact_person?: string;
  title?: string;
  sector?: string;
  notes?: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

export interface PersonCreate {
  name: string;
  person_type: 'individual' | 'company';
  id_number?: string;
  tax_number?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  contact_person?: string;
  title?: string;
  sector?: string;
  notes?: string;
}

export interface PersonUpdate {
  name?: string;
  person_type?: 'individual' | 'company';
  id_number?: string;
  tax_number?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  contact_person?: string;
  title?: string;
  sector?: string;
  notes?: string;
  is_active?: boolean;
}

export interface PersonSummary {
  id: string;
  name: string;
  person_type: 'individual' | 'company';
  total_received: number;
  total_sent: number;
  net_balance: number;
  transaction_count: number;
  last_transaction_date?: string;
}

export interface PersonStatistics {
  total_people: number;
  total_individuals: number;
  total_companies: number;
  active_people: number;
  people_with_balance: number;
  total_receivables: number;
  total_payables: number;
  top_customers: Array<{
    id: string;
    name: string;
    total_received: number;
    transaction_count: number;
  }>;
  top_suppliers: Array<{
    id: string;
    name: string;
    total_sent: number;
    transaction_count: number;
  }>;
}

export interface PersonAutoCreate {
  name: string;
  person_type?: 'individual' | 'company';
  phone?: string;
  id_number?: string;
  tax_number?: string;
  iban?: string;
  company?: string;
  source: string;
}

export interface PaymentDetail {
  id: string;
  person_id: string;
  transaction_id?: string;
  payment_type: 'outgoing' | 'incoming';
  amount: number;
  currency: string;
  description: string;
  payment_method: string;
  bank_account_id?: string;
  reference_number?: string;
  payment_date: string;
  receipt_urls: string[];
  status: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

export interface PaymentDetailCreate {
  person_id: string;
  transaction_id?: string;
  payment_type: 'outgoing' | 'incoming';
  amount: number;
  currency?: string;
  description: string;
  payment_method: string;
  bank_account_id?: string;
  reference_number?: string;
  payment_date: string;
  status?: string;
  notes?: string;
}

export interface PaymentDetailSummary {
  id: string;
  person_name: string;
  payment_type: string;
  amount: number;
  currency: string;
  description: string;
  payment_method: string;
  payment_date: string;
  status: string;
  receipt_count: number;
}

export interface PaymentDetailStatistics {
  total_payments: number;
  total_outgoing: number;
  total_incoming: number;
  net_flow: number;
  payments_today: number;
  payments_this_month: number;
  popular_payment_methods: Array<{
    method: string;
    count: number;
    total_amount: number;
  }>;
  top_recipients: Array<{
    person_id: string;
    person_name: string;
    total_amount: number;
    payment_count: number;
  }>;
  recent_payments: Array<{
    id: string;
    person_name: string;
    payment_type: string;
    amount: number;
    description: string;
    payment_date: string;
  }>;
}

export const peopleApi = {
  // Kişileri listele
  async getPeople(params?: {
    person_type?: 'individual' | 'company';
    active_only?: boolean;
    limit?: number;
    skip?: number;
  }): Promise<Person[]> {
    const searchParams = new URLSearchParams();
    if (params?.person_type) searchParams.append('person_type', params.person_type);
    if (params?.active_only) searchParams.append('active_only', params.active_only.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.skip) searchParams.append('skip', params.skip.toString());

    const queryString = searchParams.toString();
    const url = `/people${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get(url);
    return response.data;
  },

  // Kişi özet bilgilerini getir
  async getPeopleSummary(): Promise<PersonSummary[]> {
    const response = await api.get('/people/summary');
    return response.data;
  },

  // Kişi istatistiklerini getir
  async getPeopleStatistics(): Promise<PersonStatistics> {
    const response = await api.get('/people/statistics');
    return response.data;
  },

  // Tek kişi getir
  async getPerson(id: string): Promise<Person> {
    const response = await api.get(`/people/${id}`);
    return response.data;
  },

  // Yeni kişi oluştur
  async createPerson(data: PersonCreate): Promise<Person> {
    const response = await api.post('/people', data);
    return response.data;
  },

  // Kişi güncelle
  async updatePerson(id: string, data: PersonUpdate): Promise<Person> {
    const response = await api.put(`/people/${id}`, data);
    return response.data;
  },

  // Kişi sil
  async deletePerson(id: string): Promise<void> {
    await api.delete(`/people/${id}`);
  },

  // Kişiyi isimle ara
  async searchPeople(name: string): Promise<Person[]> {
    const response = await api.get(`/people/search?name=${encodeURIComponent(name)}`);
    return response.data;
  },

  // Otomatik kişi oluştur (basit)
  async autoCreatePerson(data: PersonAutoCreate): Promise<Person> {
    const response = await api.post('/people/auto-create', data);
    return response.data;
  },

  // Gelişmiş otomatik kişi oluştur
  async autoCreatePersonAdvanced(data: PersonAutoCreate): Promise<Person> {
    const response = await api.post('/people/auto-create-advanced', data);
    return response.data;
  },

  // Kişinin işlemlerini getir
  async getPersonTransactions(id: string, params?: {
    limit?: number;
    skip?: number;
  }): Promise<any[]> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.skip) searchParams.append('skip', params.skip.toString());

    const queryString = searchParams.toString();
    const url = `/people/${id}/transactions${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get(url);
    return response.data;
  },

  // Kişinin ödeme detaylarını getir
  async getPersonPayments(id: string, params?: {
    payment_type?: 'outgoing' | 'incoming';
    limit?: number;
    skip?: number;
  }): Promise<PaymentDetail[]> {
    const searchParams = new URLSearchParams();
    if (params?.payment_type) searchParams.append('payment_type', params.payment_type);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.skip) searchParams.append('skip', params.skip.toString());

    const queryString = searchParams.toString();
    const url = `/people/${id}/payments${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get(url);
    return response.data;
  },

  // Kişi için ödeme detayı oluştur
  async createPersonPayment(id: string, data: PaymentDetailCreate): Promise<PaymentDetail> {
    const response = await api.post(`/people/${id}/payments`, data);
    return response.data;
  },

  // Ödeme için dekont yükle
  async uploadPaymentReceipts(personId: string, paymentId: string, files: FileList): Promise<any> {
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });

    const response = await api.post(`/people/${personId}/payments/${paymentId}/upload-receipts`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Tüm ödeme detaylarının özetini getir
  async getPaymentsSummary(): Promise<PaymentDetailSummary[]> {
    const response = await api.get('/people/payments/summary');
    return response.data;
  },

  // Ödeme detayları istatistiklerini getir
  async getPaymentsStatistics(): Promise<PaymentDetailStatistics> {
    const response = await api.get('/people/payments/statistics');
    return response.data;
  }
};