import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://nexvpn.onrender.com/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const authAPI = {
    register: (username, email, password) =>
        api.post('/auth/register', { username, email, password }),
    login: (username, password) =>
        api.post('/auth/login', { username, password }),
};

export const trafficAPI = {
    getStats: (userId) =>
        api.get(`/traffic/stats/${userId}`),
    getAllStats: () =>
        api.get('/traffic/all'),
};

export const cryptoAPI = {
    exchangeKey: (token) =>
        api.post('/crypto/exchange-key', { token }),
};

export const healthAPI = {
    check: () =>
        api.get('/health'),
};

export default api;
