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

  // 1. Production standalone release build:
  // In release APK (!__DEV__), ALWAYS use secure HTTPS production endpoint (never local IP or localhost)
  if (!__DEV__) {
    if (envUrl && envUrl.startsWith('https://')) {
      return envUrl;
    }
    return PRODUCTION_DEFAULT_URL;
  }

  // 2. Development explicit override:
  if (envUrl && envUrl.length > 0) {
    return envUrl;
  }

  // 3. Development automatic host detection:
  // In Expo Go, debuggerHost provides the exact LAN IP of the host machine
  try {
    const expoGoConfig = getExpoGoProjectConfig();
    const debuggerHost = expoGoConfig?.debuggerHost;
    if (typeof debuggerHost === 'string' && debuggerHost.length > 0) {
      const host = debuggerHost.split(':')[0];
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return `http://${host}:3001`;
      }
    }
  } catch {
    // Non-fatal, check next method
  }

  // Detect the IP address from which the JS bundle was downloaded
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL;
    if (typeof scriptURL === 'string' && scriptURL.length > 0) {
      const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
      if (match && match[1]) {
        const host = match[1];
        if (host !== 'localhost' && host !== '127.0.0.1') {
          return `http://${host}:3001`;
        }
      }
    }
  } catch {
    // Non-fatal, fall through to platform defaults
  }

  // 4. Development platform default fallback (Android Emulator or iOS Simulator)
  return Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001';
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
