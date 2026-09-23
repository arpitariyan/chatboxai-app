import axios from 'axios';
import { auth } from '@/config/firebase';

import { resolveBackendBaseUrl } from '@/config/mobileApi';

export const apiClient = axios.create({
  baseURL: resolveBackendBaseUrl(),
  timeout: 25000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  // Dynamically update baseURL so detected Metro LAN IP is used as soon as available
  config.baseURL = resolveBackendBaseUrl();

  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.error('Failed to attach Firebase token', e);
    }
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});
