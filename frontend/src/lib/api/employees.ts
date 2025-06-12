import { getToken } from '../auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export enum EmployeeStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PROBATION = 'probation'
}

export enum EmployeePosition {
  CHEF = 'chef',
  SOUS_CHEF = 'sous_chef',
  COOK = 'cook',
  KITCHEN_HELPER = 'kitchen_helper',
  DISHWASHER = 'dishwasher',
  SERVER = 'server',
  CASHIER = 'cashier',
  MANAGER = 'manager',
  CLEANER = 'cleaner',
  OTHER = 'other'
}

export enum DocumentType {
  ID_CARD = 'id_card',
  HEALTH_CERTIFICATE = 'health_certificate',
  WORK_PERMIT = 'work_permit',
  CONTRACT = 'contract',
  DIPLOMA = 'diploma',
  REFERENCE = 'reference',
  OTHER = 'other'
}

export interface EmployeeDocument {
  type: DocumentType;
  filename: string;
  file_path: string;
  upload_date: string;
  description?: string;
}

export interface EmployeeBase {
  first_name: string;
  last_name: string;
  tc_number: string;
  phone: string;
  email?: string;
  address: string;
  birth_date: string;
  position: EmployeePosition;
  department: string;
  hire_date: string;
  salary: number;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  work_schedule?: string;
  contract_type?: string;
  notes?: string;
}

export interface EmployeeCreate extends EmployeeBase {}

export interface EmployeeUpdate {
  first_name?: string;
  last_name?: string;
  tc_number?: string;
  phone?: string;
  email?: string;
  address?: string;
  birth_date?: string;
  position?: EmployeePosition;
  department?: string;
  hire_date?: string;
  salary?: number;
  status?: EmployeeStatus;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  work_schedule?: string;
  contract_type?: string;
  notes?: string;
}

export interface Employee extends EmployeeBase {
  id: string;
  status: EmployeeStatus;
  documents: EmployeeDocument[];
  ai_profile_summary?: string;
  ai_generated_avatar?: string;
  ai_analysis_date?: string;
  created_at: string;
  updated_at?: string;
  created_by: string;
}

export interface EmployeeSummary {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  position: EmployeePosition;
  department: string;
  status: EmployeeStatus;
  hire_date: string;
  salary: number;
  phone: string;
  has_avatar: boolean;
  document_count: number;
}

export interface EmployeeStatistics {
  total_employees: number;
  active_employees: number;
  inactive_employees: number;
  probation_employees: number;
  total_monthly_salary: number;
  average_salary: number;
  departments: Record<string, number>;
  positions: Record<string, number>;
  recent_hires: EmployeeSummary[];
}

export interface EmployeeDraft {
  employee_data: EmployeeCreate;
  ai_analysis: {
    profile_summary: string;
    avatar_url: string;
    analysis_date: string;
    confidence_score: number;
  };
}

// Pozisyon etiketleri
export const positionLabels: Record<EmployeePosition, string> = {
  [EmployeePosition.CHEF]: 'Şef',
  [EmployeePosition.SOUS_CHEF]: 'Sous Şef',
  [EmployeePosition.COOK]: 'Aşçı',
  [EmployeePosition.KITCHEN_HELPER]: 'Mutfak Yardımcısı',
  [EmployeePosition.DISHWASHER]: 'Bulaşıkçı',
  [EmployeePosition.SERVER]: 'Servis Elemanı',
  [EmployeePosition.CASHIER]: 'Kasiyer',
  [EmployeePosition.MANAGER]: 'Müdür',
  [EmployeePosition.CLEANER]: 'Temizlik Görevlisi',
  [EmployeePosition.OTHER]: 'Diğer'
};

// Durum etiketleri
export const statusLabels: Record<EmployeeStatus, string> = {
  [EmployeeStatus.ACTIVE]: 'Aktif',
  [EmployeeStatus.INACTIVE]: 'Pasif',
  [EmployeeStatus.PROBATION]: 'Deneme'
};

// Durum renkleri
export const statusColors: Record<EmployeeStatus, string> = {
  [EmployeeStatus.ACTIVE]: 'bg-green-100 text-green-800',
  [EmployeeStatus.INACTIVE]: 'bg-red-100 text-red-800',
  [EmployeeStatus.PROBATION]: 'bg-yellow-100 text-yellow-800'
};

// Belge türü etiketleri
export const documentTypeLabels: Record<DocumentType, string> = {
  [DocumentType.ID_CARD]: 'Kimlik',
  [DocumentType.HEALTH_CERTIFICATE]: 'Sağlık Raporu',
  [DocumentType.WORK_PERMIT]: 'Çalışma İzni',
  [DocumentType.CONTRACT]: 'Sözleşme',
  [DocumentType.DIPLOMA]: 'Diploma',
  [DocumentType.REFERENCE]: 'Referans',
  [DocumentType.OTHER]: 'Diğer'
};

class EmployeeAPI {
  private async request(endpoint: string, options?: RequestInit) {
    const token = getToken();
    
    const response = await fetch(`${API_BASE_URL}/employees${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Bir hata oluştu' }));
      let errorMessage = error.detail || 'Bir hata oluştu';
      
      // Validation errors array ise mesajları birleştir
      if (Array.isArray(error.detail)) {
        errorMessage = error.detail.map((err: any) => err.msg || err.message || err).join(', ');
      }
      
      throw new Error(errorMessage);
    }

    return response.json();
  }

  private async uploadRequest(endpoint: string, formData: FormData) {
    const token = getToken();
    
    const response = await fetch(`${API_BASE_URL}/employees${endpoint}`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Bir hata oluştu' }));
      throw new Error(error.detail || 'Bir hata oluştu');
    }

    return response.json();
  }

  // Çalışan taslağı oluştur (AI analizi ile)
  async createEmployeeDraft(employeeData: EmployeeCreate): Promise<{ success: boolean; draft: EmployeeDraft; message: string }> {
    return this.request('/', {
      method: 'POST',
      body: JSON.stringify(employeeData),
    });
  }

  // AI analizini onaylayıp çalışanı kaydet
  async confirmEmployee(draftData: EmployeeDraft): Promise<Employee> {
    return this.request('/confirm', {
      method: 'POST',
      body: JSON.stringify(draftData),
    });
  }

  // Çalışanları listele
  async getEmployees(filters?: {
    status_filter?: EmployeeStatus;
    position_filter?: EmployeePosition;
    department_filter?: string;
  }): Promise<EmployeeSummary[]> {
    const params = new URLSearchParams();
    
    if (filters?.status_filter) params.append('status_filter', filters.status_filter);
    if (filters?.position_filter) params.append('position_filter', filters.position_filter);
    if (filters?.department_filter) params.append('department_filter', filters.department_filter);
    
    const query = params.toString();
    return this.request(query ? `/?${query}` : '/');
  }

  // Çalışan istatistikleri
  async getEmployeeStatistics(): Promise<EmployeeStatistics> {
    return this.request('/statistics');
  }

  // Tek çalışan detayı
  async getEmployee(id: string): Promise<Employee> {
    return this.request(`/${id}`);
  }

  // Çalışan güncelle
  async updateEmployee(id: string, employeeData: EmployeeUpdate): Promise<Employee> {
    return this.request(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(employeeData),
    });
  }

  // Çalışan durumunu güncelle
  async updateEmployeeStatus(id: string, status: EmployeeStatus): Promise<{ message: string }> {
    return this.request(`/${id}/status?status=${status}`, {
      method: 'PUT',
    });
  }

  // Çalışan belge yükle
  async uploadEmployeeDocument(
    employeeId: string, 
    documentType: DocumentType,
    file: File,
    description?: string
  ): Promise<{ message: string; filename: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', documentType);
    if (description) formData.append('description', description);

    return this.uploadRequest(`/${employeeId}/documents`, formData);
  }

  // Çalışan sil
  async deleteEmployee(id: string): Promise<{ message: string }> {
    return this.request(`/${id}`, {
      method: 'DELETE',
    });
  }

  // Belge görüntüleme URL'i oluştur
  getDocumentUrl(employeeId: string, filename: string): string {
    const token = getToken();
    return `${API_BASE_URL}/employees/${employeeId}/documents/${filename}?token=${token}`;
  }

  // Belge sil
  async deleteEmployeeDocument(employeeId: string, filename: string): Promise<{ message: string }> {
    return this.request(`/${employeeId}/documents/${filename}`, {
      method: 'DELETE',
    });
  }
}

export const employeesApi = new EmployeeAPI();