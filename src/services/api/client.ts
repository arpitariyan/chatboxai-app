import axios from 'axios';
import { auth } from '@/config/firebase';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.10:3000'; // Replace with local machine IP if needed during dev

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
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
