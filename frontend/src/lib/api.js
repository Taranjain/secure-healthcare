/**
 * API Client
 * Axios wrapper with JWT interceptor and auto-refresh.
 */

import axios from 'axios';

const API_URL = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api')
    : 'http://backend:4000/api';

const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
});

// Request interceptor - attach access token
api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

// Response interceptor - auto-refresh on 401
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 &&
            error.response?.data?.code === 'TOKEN_EXPIRED' &&
            !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = localStorage.getItem('refreshToken');
                if (!refreshToken) throw new Error('No refresh token');

                const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
                localStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('refreshToken', data.refreshToken);

                originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                localStorage.clear();
                if (typeof window !== 'undefined') {
                    window.location.href = '/login';
                }
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

// Auth API
export const authAPI = {
    register: (data) => api.post('/auth/register', data),
    login: (data) => api.post('/auth/login', data),
    verifyMFA: (data) => api.post('/auth/verify-mfa', data),
    refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
    setupMFA: () => api.post('/auth/setup-mfa'),
    getProfile: () => api.get('/auth/profile'),
};

// Records API
export const recordsAPI = {
    create: (formData) => api.post('/records', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
    getMyRecords: () => api.get('/records/my'),
    getAccessible: () => api.get('/records/accessible'),
    getRecord: (id) => api.get(`/records/${id}`),
    downloadRecord: (id) => api.get(`/records/${id}/download`, { responseType: 'blob' }),
    deleteRecord: (id) => api.delete(`/records/${id}`),
};

// Consents API
export const consentsAPI = {
    grant: (data) => api.post('/consents', data),
    getMyConsents: () => api.get('/consents/my'),
    revoke: (id) => api.patch(`/consents/${id}/revoke`),
    listDoctors: () => api.get('/consents/doctors'),
};

// Audit API
export const auditAPI = {
    getLogs: (params) => api.get('/audit/logs', { params }),
    getBlockchain: (params) => api.get('/audit/blockchain', { params }),
    verifyBlockchain: () => api.get('/audit/blockchain/verify'),
};

// Admin API
export const adminAPI = {
    getUsers: () => api.get('/admin/users'),
    getDashboard: () => api.get('/admin/dashboard'),
};

export default api;
