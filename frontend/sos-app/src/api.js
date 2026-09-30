import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from './config';

const api = axios.create({ baseURL: BASE_URL, timeout: 20000 });

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

api.interceptors.request.use(async (config) => {
  const url = config.url || '';
  const isAuthRoute =
    url.includes('/register/') ||
    url.includes('/login/') ||
    url.includes('/forgot-password/') ||
    url.includes('/reset-password/') ||
    url.includes('/send-otp/') ||
    url.includes('/verify-otp/');

  if (!isAuthRoute) {
    const token = await AsyncStorage.getItem('access');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    const url = error.config?.url || '';
    const isAuthRoute =
      url.includes('/register/') ||
      url.includes('/login/') ||
      url.includes('/forgot-password/') ||
      url.includes('/reset-password/') ||
      url.includes('/send-otp/') ||
      url.includes('/verify-otp/');
    if (error.response?.status === 401 && !isAuthRoute) onUnauthorized();
    return Promise.reject(error);
  }
);

export function errorText(e) {
  if (!e.response) {
    return e.isAxiosError ? 'Cannot reach the server. Check Wi-Fi and the IP in src/config.js.' : (e.message || 'Network error');
  }
  const d = e.response.data;
  if (typeof d === 'string') return `Server error (${e.response.status}): ${d}`;
  if (d?.detail) return String(d.detail);
  if (Array.isArray(d)) return d.join('\n');
  if (d && typeof d === 'object') {
    const entries = Object.entries(d);
    if (entries.length > 0) {
      return entries
        .map(([k, v]) => {
          const valStr = Array.isArray(v) ? v.join(', ') : (typeof v === 'object' ? JSON.stringify(v) : String(v));
          return `${k}: ${valStr}`;
        })
        .join('\n');
    }
  }
  return 'Something went wrong';
}

export default api;