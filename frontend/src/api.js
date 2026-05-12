import axios from 'axios';
import { getDraft, markResumeAfterAuth } from './utils/chatbotDraft';

// Automatically use environment variable or the current hostname
const getBaseUrl = () => {
    // In production (Hugging Face or similar), we prefer serving everything on the same origin
    // This ensures monolithic deployments work correctly regardless of env variables.
    if (process.env.NODE_ENV === 'production') {
        const protocol = window.location.protocol;
        const host = window.location.host; // includes port if any
        return `${protocol}//${host}/api/`;
    }

    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    
    // Fallback for local development
    return `http://${window.location.hostname}:8000/api/`;
};

const API_BASE_URL = getBaseUrl();

const api = axios.create({

    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 20000, // 20 second timeout for heavier dashboard payloads
});

const PUBLIC_ENDPOINT_PATTERNS = [
    /\/?users\/forgot_password\/?$/,
    /\/?users\/reset_password\/?$/,
    /\/?auth\/login\/?$/,
    /\/?auth\/register\/?$/,
];

const isPublicEndpoint = (url = '') => PUBLIC_ENDPOINT_PATTERNS.some((pattern) => pattern.test(String(url)));

// Request interceptor - add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token && !isPublicEndpoint(config.url)) {
            config.headers.Authorization = `Token ${token}`;
        }
        // Default Content-Type is application/json; multipart needs boundary from the runtime.
        if (config.data instanceof FormData) {
            const headers = config.headers;
            if (headers && typeof headers.delete === 'function') {
                headers.delete('Content-Type');
            } else if (headers) {
                delete headers['Content-Type'];
                delete headers['content-type'];
            }
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
            if (isPublicEndpoint(error.config?.url)) {
                return Promise.reject(error);
            }
            // Token expired or invalid
            if (getDraft()) {
                markResumeAfterAuth();
            }
            localStorage.removeItem('token');
            window.location.href = '/login';
        } else if (error.response?.status === 403) {
            console.error('Forbidden: You do not have permission');
        } else if (
            error.response?.status >= 500 &&
            !(error.response.status === 503 && String(error.config?.url || '').includes('ai-analyze'))
        ) {
            console.error('Server error occurred');
        } else if (error.code === 'ECONNABORTED') {
            console.error('Request timeout');
        }
        return Promise.reject(error);
    }
);

export default api;
