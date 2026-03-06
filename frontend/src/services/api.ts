import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken, currentStore } = useAuthStore.getState();
    
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    
    if (currentStore) {
      config.headers['X-Store-Id'] = currentStore.id;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ message?: string; error?: string }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const { refreshToken, updateAccessToken, logout } = useAuthStore.getState();
      
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken,
          });
          
          const { accessToken } = response.data.data;
          updateAccessToken(accessToken);
          
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          logout();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        logout();
        window.location.href = '/login';
      }
    }
    
    // Handle other errors
    const errorData = error.response?.data as { message?: string; error?: string | { message?: string } } | undefined;
    let message = 'An error occurred';
    if (typeof errorData?.message === 'string') {
      message = errorData.message;
    } else if (typeof errorData?.error === 'string') {
      message = errorData.error;
    } else if (typeof errorData?.error === 'object' && errorData?.error?.message) {
      message = errorData.error.message;
    }
    
    if (error.response?.status !== 401) {
      toast.error(message);
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  
  register: (data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    storeName: string;
    storeType: string;
    currency?: string;
  }) => api.post('/auth/register', data),
  
  logout: () => api.post('/auth/logout'),
  
  getProfile: () => api.get('/auth/me'),
  
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
  
  updateProfile: (data: {
    name?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
  }) => api.put('/auth/profile', data),
  
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post('/auth/change-password', data),
};

// Store API
export const storeAPI = {
  getCurrent: () => api.get('/stores/current'),
  
  update: (storeId: string, data: {
    name?: string;
    businessType?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    phone?: string;
    email?: string;
    gstin?: string;
    currency?: string;
    timezone?: string;
    lowStockThreshold?: number;
  }) => api.put(`/stores/${storeId}`, data),
  
  updatePreferences: (storeId: string, data: {
    enableNotifications?: boolean;
    enableWeeklyReport?: boolean;
    darkMode?: boolean;
    lowStockThreshold?: number;
  }) => api.put(`/stores/${storeId}/preferences`, data),
  
  exportData: (storeId: string) => 
    api.get(`/stores/${storeId}/export`, { responseType: 'blob' }),
};

// Dashboard API
export const dashboardAPI = {
  getMetrics: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/dashboard/metrics', { params }),
  
  getTopProducts: (params?: { limit?: number }) =>
    api.get('/dashboard/top-products', { params }),
  
  getSalesChart: (params?: { period?: string; startDate?: string; endDate?: string }) =>
    api.get('/dashboard/sales-chart', { params }),
  
  getRevenueByCategory: () =>
    api.get('/dashboard/revenue-by-category'),
  
  getExpenseBreakdown: () =>
    api.get('/dashboard/expense-breakdown'),
  
  getLowStockAlerts: () =>
    api.get('/dashboard/low-stock'),
  
  getDeadStock: (params?: { days?: number }) =>
    api.get('/dashboard/dead-stock', { params }),
  
  getFastMoving: (params?: { limit?: number }) =>
    api.get('/dashboard/fast-moving', { params }),
};

// Product API
export const productAPI = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    lowStock?: boolean;
    sortBy?: string;
    order?: string;
  }) => api.get('/products', { params }),
  
  getById: (id: string) => api.get(`/products/${id}`),
  
  create: (data: {
    name: string;
    sku?: string;
    description?: string;
    categoryId?: string;
    costPrice: number;
    sellingPrice: number;
    stockQuantity: number;
    lowStockThreshold?: number;
    unit?: string;
    imageUrl?: string;
    barcode?: string;
  }) => api.post('/products', data),
  
  update: (id: string, data: Partial<{
    name: string;
    sku: string;
    description: string;
    categoryId: string;
    costPrice: number;
    sellingPrice: number;
    stockQuantity: number;
    lowStockThreshold: number;
    unit: string;
    imageUrl: string;
    barcode: string;
    isActive: boolean;
  }>) => api.patch(`/products/${id}`, data),
  
  delete: (id: string) => api.delete(`/products/${id}`),
  
  adjustStock: (id: string, data: {
    quantity: number;
    type: 'IN' | 'OUT' | 'ADJUSTMENT';
    reason?: string;
  }) => api.post(`/products/${id}/stock`, data),
  
  getStockHistory: (id: string, params?: { page?: number; limit?: number }) =>
    api.get(`/products/${id}/stock-history`, { params }),
};

// Category API
export const categoryAPI = {
  getAll: () => api.get('/products/categories'),
  
  create: (data: { name: string; description?: string }) =>
    api.post('/products/categories', data),
  
  update: (id: string, data: { name?: string; description?: string }) =>
    api.patch(`/products/categories/${id}`, data),
  
  delete: (id: string) => api.delete(`/products/categories/${id}`),
};

// Sale API
export const saleAPI = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    paymentMethod?: string;
    paymentStatus?: string;
  }) => api.get('/sales', { params }),
  
  getById: (id: string) => api.get(`/sales/${id}`),
  
  create: (data: {
    items: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      discount?: number;
    }>;
    customerId?: string;
    paymentMethod: string;
    discountAmount?: number;
    discountPercent?: number;
    paidAmount: number;
    notes?: string;
  }) => api.post('/sales', data),
  
  updatePaymentStatus: (id: string, data: { paymentStatus: string }) =>
    api.patch(`/sales/${id}/payment`, data),
  
  getDailyReport: (params?: { date?: string }) =>
    api.get('/sales/report/daily', { params }),
};

// Customer API
export const customerAPI = {
  getAll: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get('/sales/customers', { params }),
  
  create: (data: { name: string; phone?: string; email?: string; address?: string }) =>
    api.post('/sales/customers', data),
  
  getById: (id: string) => api.get(`/sales/customers/${id}`),
};

// Expense API
export const expenseAPI = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    category?: string;
  }) => api.get('/expenses', { params }),
  
  getById: (id: string) => api.get(`/expenses/${id}`),
  
  create: (data: {
    description: string;
    amount: number;
    category: string;
    date?: string;
    paymentMethod?: string;
    vendor?: string;
    receiptUrl?: string;
    notes?: string;
  }) => api.post('/expenses', data),
  
  update: (id: string, data: Partial<{
    description: string;
    amount: number;
    category: string;
    date: string;
    paymentMethod: string;
    vendor: string;
    receiptUrl: string;
    notes: string;
  }>) => api.patch(`/expenses/${id}`, data),
  
  delete: (id: string) => api.delete(`/expenses/${id}`),
  
  getSummary: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/expenses/summary', { params }),
  
  getCategories: () => api.get('/expenses/categories'),
};

// AI API
export const aiAPI = {
  chat: (data: { message: string; context?: { includeInventory?: boolean } }) =>
    api.post('/ai/chat', data),
  
  getSalesPrediction: (params?: { days?: number }) =>
    api.post('/ai/predict', { type: 'revenue', days: params?.days || 7 }),
  
  getRestockRecommendations: () =>
    api.get('/ai/restock-recommendations'),
  
  getMarketingSuggestions: () =>
    api.get('/ai/marketing-suggestions'),
  
  getGrowthInsights: () =>
    api.get('/ai/growth-insights'),
};

// Credits API
export const creditsAPI = {
  getBalance: () => api.get('/credits/balance'),
  
  getHistory: (params?: { page?: number; limit?: number }) =>
    api.get('/credits/history', { params }),
  
  getPlans: () => api.get('/credits/plans'),
  
  getUsageStats: () => api.get('/credits/usage'),
};

// Payment API (Stripe)
export const paymentAPI = {
  getPlans: () => api.get('/payments/plans'),
  
  createCheckout: (data: { planId: string }) =>
    api.post('/payments/create-checkout', data),
  
  verifyPayment: (data: { sessionId: string }) =>
    api.post('/payments/verify', data),
  
  getHistory: (params?: { page?: number; limit?: number }) =>
    api.get('/payments/history', { params }),
};

export default api;
