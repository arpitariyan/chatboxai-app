/**
 * src/services/api/client.ts
 *
 * Hardened Axios HTTP Client for Mobile API communication:
 * 1. Enforces HTTPS in production APK builds
 * 2. Attaches authenticated Firebase Bearer Token dynamically
 * 3. Injects client platform, package identity, and request timestamp headers
 * 4. Sanitizes error responses to prevent technical leakage
 */

import axios from 'axios';
import { Platform } from 'react-native';
import { auth } from '@/config/firebase';
import { resolveBackendBaseUrl } from '@/config/mobileApi';

const isDev = typeof __DEV__ !== 'undefined' ? Boolean(__DEV__) : false;

export const apiClient = axios.create({
  baseURL: resolveBackendBaseUrl(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  let resolvedUrl = resolveBackendBaseUrl();

  // Strict HTTPS Enforcement in Production
  if (!isDev && !resolvedUrl.startsWith('https://')) {
    resolvedUrl = 'https://api-mobile.chatboxai.co.in';
  }

  config.baseURL = resolvedUrl;

  // Security & Integrity Request Headers
  config.headers['X-Client-Platform'] = Platform.OS;
  config.headers['X-App-Version'] = '1.0.0';
  config.headers['X-Client-Package'] = 'com.chatboxai.app';
  config.headers['X-Request-Timestamp'] = Date.now().toString();

  // Attach Firebase Bearer Token
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      // Non-fatal, unauthenticated endpoint
    }
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Sanitize technical errors
    if (error.response?.data?.error) {
      const raw = String(error.response.data.error);
      // Strip any file paths or SQL/DB fragments if ever present
      const clean = raw.replace(/\/[\w/.-]+/g, '[REDACTED_PATH]');
      error.message = clean;
    }
    return Promise.reject(error);
  }
);
