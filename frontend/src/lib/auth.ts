import axios from 'axios';
import Cookies from 'js-cookie';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface User {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

// Axios instance with interceptors
const api = axios.create({
  baseURL: API_BASE_URL,
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = getToken();
  console.log('API Request:', config.method?.toUpperCase(), config.url, 'Token:', token ? 'Present' : 'Missing');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for handling auth errors
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config.method?.toUpperCase(), response.config.url);
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.status, error.response?.statusText, error.config?.method?.toUpperCase(), error.config?.url);
    if (error.response?.data) {
      console.error('Error details:', error.response.data);
      console.error('Error detail field:', error.response.data.detail);
    } else {
      console.error('No error data in response');
    }
    
    if (error.response?.status === 401) {
      logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const formatApiError = (error: any): string => {
  const errorDetail = error?.response?.data?.detail;
  if (Array.isArray(errorDetail)) {
    // Validation errors array
    const errorMessages = errorDetail.map((err: any) => err.msg).join(', ');
    return errorMessages;
  } else if (typeof errorDetail === 'string') {
    return errorDetail;
  } else {
    return 'Bir hata oluştu';
  }
};

export const login = async (credentials: LoginCredentials): Promise<User> => {
  const formData = new FormData();
  formData.append('username', credentials.username);
  formData.append('password', credentials.password);

  const response = await api.post<AuthResponse>('/auth/login', formData);
  const { access_token } = response.data;
  
  setToken(access_token);
  
  // Get user info after login
  const userResponse = await api.get<User>('/auth/me');
  return userResponse.data;
};

export const logout = () => {
  Cookies.remove('auth_token');
};

export const getToken = (): string | undefined => {
  return Cookies.get('auth_token');
};

export const setToken = (token: string) => {
  Cookies.set('auth_token', token, { expires: 1 }); // 1 day
};

export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const token = getToken();
    if (!token) return null;
    
    const response = await api.get<User>('/auth/me');
    return response.data;
  } catch (error) {
    logout();
    return null;
  }
};

export const isAuthenticated = (): boolean => {
  return !!getToken();
};

export { api };