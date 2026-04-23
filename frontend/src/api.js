import axios from 'axios';
import { getDraft, markResumeAfterAuth } from './utils/chatbotDraft';

// Automatically use environment variable or the current hostname for development
const getBaseUrl = () => {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    return `http://${window.location.hostname}:8000/api/`;
};

const API_BASE_URL = getBaseUrl();
console.log('API Base URL:', API_BASE_URL);

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 20000, // 20 second timeout for heavier dashboard payloads
});

// Request interceptor - add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Token ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - handle token expiration and errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid
            if (getDraft()) {
                markResumeAfterAuth();
            }
            localStorage.removeItem('token');
            window.location.href = '/login';
        } else if (error.response?.status === 403) {
            console.error('Forbidden: You do not have permission');
        } else if (error.response?.status >= 500) {
            console.error('Server error occurred');
        } else if (error.code === 'ECONNABORTED') {
            console.error('Request timeout');
        }
        return Promise.reject(error);
    }
);

export default api;
