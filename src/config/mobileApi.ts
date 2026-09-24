/**
 * src/config/mobileApi.ts
 *
 * Configuration and URL builder for the dedicated ChatBox AI mobile backend.
 * Provides resilient, automatic host resolution for both:
 *   1. Development (Expo Go, Android Emulator, physical phone on LAN, or custom tunnel)
 *   2. Production (Standalone release APK, cloud deployment)
 */

import { Platform, NativeModules } from 'react-native';
import { getExpoGoProjectConfig } from 'expo';

const PRODUCTION_DEFAULT_URL = 'https://api-mobile.chatboxai.co.in';

/**
 * Resolves the backend base URL cleanly for development or production APK.
 */
export function resolveBackendBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_MOBILE_API_URL?.trim().replace(/\/+$/, '');

  // 1. If explicit HTTPS URL is provided, use it everywhere (dev and prod)
  if (envUrl && envUrl.startsWith('https://')) {
    return envUrl;
  }

  // 2. Production release APK: ALWAYS guarantee HTTPS production domain
  if (!__DEV__) {
    return PRODUCTION_DEFAULT_URL;
  }

  // 3. In development: only use local HTTP if explicitly set and NOT an old stale LAN IP
  if (envUrl && envUrl.startsWith('http://') && !envUrl.includes('10.218.56.237')) {
    return envUrl;
  }

  // 4. Default for all environments: The official hosted cloud API!
  return PRODUCTION_DEFAULT_URL;
}

export const MOBILE_API_URL = resolveBackendBaseUrl();

/**
 * Builds the canonical authenticated mobile file retrieval URL.
 */
export function toMobileFileUrl(fileId: string): string {
  return `${resolveBackendBaseUrl()}/api/mobile/file?fileId=${encodeURIComponent(fileId)}`;
}

/**
 * Endpoint for uploading mobile attachments.
 */
export function toMobileUploadUrl(): string {
  return `${resolveBackendBaseUrl()}/api/mobile/upload`;
}

/**
 * Endpoint for AI file analysis.
 */
export function toMobileAnalyzeUrl(): string {
  return `${resolveBackendBaseUrl()}/api/mobile/analyze`;
}

/**
 * Endpoint for backend health check.
 */
export function toMobileHealthUrl(): string {
  return `${resolveBackendBaseUrl()}/api/mobile/health`;
}
