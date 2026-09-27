/**
 * src/services/imageService.ts
 *
 * Client-side service for Image Generation & Image-to-Image in ChatBox AI Mobile.
 * Connects to the authenticated Mobile Backend with web API and Appwrite fallbacks.
 */

import { apiClient } from './api/client';
import {
  databases,
  DB_ID,
  IMAGE_GENERATION_COLLECTION_ID,
  Query,
} from '@/config/appwrite';
import { auth } from '@/config/firebase';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform, LogBox } from 'react-native';

// Suppress the upstream Expo Go media library warning banner
LogBox.ignoreLogs([
  'Due to changes in Androids permission requirements, Expo Go can no longer provide full access to the media library',
]);

const WEB_API_BASE_URL =
  process.env.EXPO_PUBLIC_WEB_API_URL || 'https://chatboxai.co.in';
const MOBILE_API_BASE_URL =
  process.env.EXPO_PUBLIC_MOBILE_API_URL || 'https://api-mobile.chatboxai.co.in';

const APPWRITE_PUBLIC_ENDPOINT =
  process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
const APPWRITE_PUBLIC_PROJECT_ID =
  process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || '';
const APPWRITE_PUBLIC_BUCKET_ID =
  process.env.EXPO_PUBLIC_APPWRITE_STORAGE_BUCKET_ID || '';

/**
 * Safely loads MediaLibrary dynamically at runtime inside try/catch blocks.
 * In Expo Go on Android, native media library access is restricted by Google Play policy,
 * which logs a warning banner if expo-media-library is loaded.
 * In Expo Go, we return null immediately so downloadImageToGallery uses native Sharing.shareAsync.
 * In standalone production APKs, isExpoGo is false, so full native MediaLibrary is used.
 */
function getSafeMediaLibrary(): any {
  // Detect if running inside Expo Go client
  const isExpoGo =
    typeof (globalThis as any).expo !== 'undefined' &&
    Boolean((globalThis as any).expo?.modules?.ExpoGo);

  if (isExpoGo) {
    return null;
  }

  try {
    const legacy = require('expo-media-library/legacy');
    if (
      legacy &&
      (typeof legacy.saveToLibraryAsync === 'function' ||
        typeof legacy.createAssetAsync === 'function' ||
        typeof legacy.requestPermissionsAsync === 'function')
    ) {
      return legacy;
    }
  } catch {
    // Legacy module unavailable
  }

  try {
    const next = require('expo-media-library');
    if (
      next &&
      (next.Asset ||
        typeof next.saveToLibraryAsync === 'function' ||
        typeof next.createAssetAsync === 'function' ||
        typeof next.requestPermissionsAsync === 'function')
    ) {
      return next;
    }
  } catch {
    // MediaLibrary module unavailable in this environment
  }

  return null;
}

export function normalizeImageUrl(rawUrl?: string, fileId?: string): string {
  const trimmed = typeof rawUrl === 'string' ? rawUrl.trim() : '';

  if (!trimmed && fileId) {
    return `${APPWRITE_PUBLIC_ENDPOINT}/storage/buckets/${APPWRITE_PUBLIC_BUCKET_ID}/files/${fileId}/view?project=${APPWRITE_PUBLIC_PROJECT_ID}`;
  }
  if (!trimmed) return '';

  if (
    trimmed.startsWith('file://') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }

  // If already absolute http/https
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // If it's hitting api-mobile or any domain for /api/mobile/image/file?fileId=...
    if (trimmed.includes('fileId=')) {
      const match = trimmed.match(/[?&]fileId=([a-zA-Z0-9_-]+)/);
      if (match?.[1]) {
        return `${APPWRITE_PUBLIC_ENDPOINT}/storage/buckets/${APPWRITE_PUBLIC_BUCKET_ID}/files/${match[1]}/view?project=${APPWRITE_PUBLIC_PROJECT_ID}`;
      }
    }

    // If it's accidentally hitting api-mobile for the web route /api/generate-image/file
    if (trimmed.includes('api-mobile.chatboxai.co.in/api/generate-image/file')) {
      const match = trimmed.match(/\/api\/generate-image\/file\/([a-zA-Z0-9_-]+)/);
      if (match?.[1]) {
        return `${APPWRITE_PUBLIC_ENDPOINT}/storage/buckets/${APPWRITE_PUBLIC_BUCKET_ID}/files/${match[1]}/view?project=${APPWRITE_PUBLIC_PROJECT_ID}`;
      }
      return trimmed.replace('api-mobile.chatboxai.co.in', 'chatboxai.co.in');
    }
    return trimmed;
  }

  // Legacy website proxy route
  if (trimmed.startsWith('/api/generate-image/file')) {
    const match = trimmed.match(/\/api\/generate-image\/file\/([a-zA-Z0-9_-]+)/);
    if (match?.[1]) {
      return `${APPWRITE_PUBLIC_ENDPOINT}/storage/buckets/${APPWRITE_PUBLIC_BUCKET_ID}/files/${match[1]}/view?project=${APPWRITE_PUBLIC_PROJECT_ID}`;
    }
    return `${WEB_API_BASE_URL}${trimmed}`;
  }

  // Mobile API proxy route
  if (trimmed.startsWith('/api/mobile/image/file')) {
    const match = trimmed.match(/[?&]fileId=([a-zA-Z0-9_-]+)/);
    if (match?.[1]) {
      return `${APPWRITE_PUBLIC_ENDPOINT}/storage/buckets/${APPWRITE_PUBLIC_BUCKET_ID}/files/${match[1]}/view?project=${APPWRITE_PUBLIC_PROJECT_ID}`;
    }
    return `${MOBILE_API_BASE_URL}${trimmed}`;
  }

  // Any other relative path
  if (trimmed.startsWith('/')) {
    return `${MOBILE_API_BASE_URL}${trimmed}`;
  }

  // If passed a plain Appwrite file ID
  if (/^[a-zA-Z0-9_-]{10,40}$/.test(trimmed)) {
    return `${APPWRITE_PUBLIC_ENDPOINT}/storage/buckets/${APPWRITE_PUBLIC_BUCKET_ID}/files/${trimmed}/view?project=${APPWRITE_PUBLIC_PROJECT_ID}`;
  }

  return trimmed;
}

export interface GenerateImagePayload {
  prompt: string;
  model?: string;
  provider?: 'cloudflare' | 'huggingface' | 'leonardo';
  width?: number;
  height?: number;
  referenceImage?: string | null;
  referenceImageBase64?: string | null;
  referenceImages?: string[] | null;
  libId?: string;
}

export interface GeneratedImageItem {
  $id?: string;
  entryId?: string;
  libId: string;
  userEmail: string;
  prompt: string;
  model: string;
  modelName?: string;
  width: number;
  height: number;
  status: 'generating' | 'completed' | 'failed';
  created_at: string;
  generatedImagePath?: string;
  publicUrl: string;
  displayUrl?: string;
  generationType?: 'text-to-image' | 'image-to-image';
  hasReferenceImage?: boolean;
  referenceImageCount?: number;
  failMessage?: string;
  isLocalPending?: boolean;
}

export interface GenerateImageResultResponse {
  success: boolean;
  docId: string;
  libId: string;
  imageUrl: string;
  publicUrl: string;
  prompt: string;
  model: string;
  modelName: string;
  provider: 'cloudflare' | 'huggingface' | 'leonardo';
  width: number;
  height: number;
  generationType: 'text-to-image' | 'image-to-image';
  hasReferenceImage: boolean;
  referenceImageCount?: number;
  modelWasSwitched: boolean;
  createdAt: string;
  message?: string;
}

export interface DownloadImageResult {
  success: boolean;
  savedToGallery: boolean;
  uri?: string;
  errorMessage?: string;
  permissionDenied?: boolean;
}

export const imageService = {
  /**
   * Submit an image generation (text-to-image or image-to-image) request to https://api-mobile.chatboxai.co.in
   */
  async generateImage(payload: GenerateImagePayload): Promise<GenerateImageResultResponse> {
    const user = auth.currentUser;
    const userEmail = user?.email || '';

    try {
      const response = await apiClient.post(
        '/api/mobile/image/generate',
        {
          ...payload,
          userEmail,
        },
        {
          timeout: 90000, // 90 seconds for inference and Appwrite persistence
        }
      );

      const data = response.data;
      if (!data || data.success === false) {
        throw new Error(data?.error || data?.details || 'Image generation failed');
      }

      const imageUrl = normalizeImageUrl(
        data.imageUrl || data.displayUrl || data.publicUrl,
        data.generatedImagePath || data.fileId
      );

      const hasRef = Boolean(
        data.hasReferenceImage ||
        payload.referenceImages?.length ||
        payload.referenceImageBase64 ||
        payload.referenceImage
      );

      return {
        success: true,
        docId: data.docId || data.generation?.$id || data.libId || `doc_${Date.now()}`,
        libId: data.libId,
        imageUrl,
        publicUrl: imageUrl,
        prompt: data.prompt || payload.prompt,
        model: data.model || payload.model || '',
        modelName: data.modelName || '',
        provider: data.provider || payload.provider || 'cloudflare',
        width: data.width || payload.width || 1024,
        height: data.height || payload.height || 1024,
        generationType: data.generationType || (hasRef ? 'image-to-image' : 'text-to-image'),
        hasReferenceImage: hasRef,
        referenceImageCount: data.referenceImageCount || (payload.referenceImages?.length ?? (hasRef ? 1 : 0)),
        modelWasSwitched: Boolean(data.modelWasSwitched),
        createdAt: data.createdAt || data.generation?.created_at || new Date().toISOString(),
        message: data.message,
      };
    } catch (err: any) {
      const message =
        err?.response?.data?.error ||
        err?.response?.data?.details ||
        err?.response?.data?.message ||
        err?.message ||
        'Image generation failed. Please try again.';
      throw new Error(message);
    }
  },

  /**
   * Fetch all generated image records in a conversation thread by libId from https://api-mobile.chatboxai.co.in
   */
  async fetchGenerations(libId: string): Promise<GeneratedImageItem[]> {
    if (!libId) return [];

    const user = auth.currentUser;
    if (!user?.email) return [];

    try {
      const response = await apiClient.get('/api/mobile/image/generations', {
        params: { libId },
        timeout: 20000,
      });

      const data = response.data;
      if (data?.success && Array.isArray(data.generations)) {
        return data.generations.map((doc: any) => ({
          ...doc,
          entryId: doc.$id || doc.entryId,
          libId: doc.libId || doc.$id,
          publicUrl: normalizeImageUrl(doc.publicUrl || doc.imageUrl, doc.generatedImagePath),
          displayUrl: normalizeImageUrl(doc.displayUrl || doc.imageUrl || doc.publicUrl, doc.generatedImagePath),
        }));
      }
    } catch {
      // Backend may be updating or direct appwrite fallback
    }

    // Direct Appwrite fallback if collections are configured
    if (!DB_ID || !user?.email) return [];

    try {
      const normalizedEmail = user.email.trim().toLowerCase();
      const res = await databases.listDocuments(DB_ID, IMAGE_GENERATION_COLLECTION_ID, [
        Query.equal('libId', libId),
        Query.equal('userEmail', normalizedEmail),
        Query.orderDesc('$createdAt'),
        Query.limit(100),
      ]);

      return (res.documents || []).map((doc: any) => ({
        ...doc,
        entryId: doc.$id,
        libId: doc.libId || doc.$id,
        publicUrl: normalizeImageUrl(doc.publicUrl || '', doc.generatedImagePath),
        displayUrl: normalizeImageUrl(doc.displayUrl || doc.publicUrl || '', doc.generatedImagePath),
      }));
    } catch {
      return [];
    }
  },

  /**
   * Delete an entire image conversation thread by libId from https://api-mobile.chatboxai.co.in
   */
  async deleteConversation(libId: string): Promise<boolean> {
    if (!libId) return false;

    try {
      const response = await apiClient.delete(`/api/mobile/image/conversation/${encodeURIComponent(libId)}`);
      return response.status === 200;
    } catch {
      return false;
    }
  },

  /**
   * Downloads generated image and saves it directly to the device Gallery/Photos.
   * Handles Android version-specific media permissions, base64 data URIs,
   * Appwrite storage URLs, and provides sharing fallback if gallery permission is denied.
   */
  async downloadImageToGallery(
    imageUrl: string,
    fileName?: string
  ): Promise<DownloadImageResult> {
    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) {
      return {
        success: false,
        savedToGallery: false,
        errorMessage: 'Invalid image URL',
      };
    }

    const targetUrl = normalizeImageUrl(imageUrl);
    if (!targetUrl) {
      return {
        success: false,
        savedToGallery: false,
        errorMessage: 'Could not resolve image URL',
      };
    }

    // 1. Determine clean filename and extension
    let cleanFileName = (fileName || `chatboxai_${Date.now()}`)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_');

    // Ensure valid image extension (.png preferred for high-fidelity generated images)
    if (!/\.(png|jpe?g|webp)$/i.test(cleanFileName)) {
      cleanFileName = `${cleanFileName}.png`;
    }

    const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
    const tempFileUri = `${cacheDir}${cleanFileName}`;

    try {
      // 2. Fetch/Save local file according to source format
      if (targetUrl.startsWith('data:')) {
        // Base64 Data URI
        const match = targetUrl.match(/^data:([^;]+);base64,(.+)$/);
        const base64Data = match?.[2] || targetUrl.replace(/^data:[^,]+,/, '');
        await FileSystem.writeAsStringAsync(tempFileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else if (targetUrl.startsWith('file://')) {
        // Already a local file
        if (targetUrl !== tempFileUri) {
          await FileSystem.copyAsync({ from: targetUrl, to: tempFileUri });
        }
      } else {
        // Remote HTTP / HTTPS URL
        const downloadResult = await FileSystem.downloadAsync(targetUrl, tempFileUri, {
          headers: {
            Accept: 'image/png,image/jpeg,image/*,*/*',
            ...(APPWRITE_PUBLIC_PROJECT_ID
              ? { 'X-Appwrite-Project': APPWRITE_PUBLIC_PROJECT_ID }
              : {}),
          },
        });

        if (downloadResult.status < 200 || downloadResult.status >= 300) {
          // If Appwrite /view failed, try /download endpoint as fallback
          let fallbackSuccess = false;
          if (targetUrl.includes('/view?')) {
            const downloadFallbackUrl = targetUrl.replace('/view?', '/download?');
            try {
              const fbResult = await FileSystem.downloadAsync(downloadFallbackUrl, tempFileUri, {
                headers: {
                  Accept: 'image/png,image/jpeg,image/*,*/*',
                  ...(APPWRITE_PUBLIC_PROJECT_ID
                    ? { 'X-Appwrite-Project': APPWRITE_PUBLIC_PROJECT_ID }
                    : {}),
                },
              });
              if (fbResult.status >= 200 && fbResult.status < 300) {
                fallbackSuccess = true;
              }
            } catch (fbErr) {
              console.warn('[imageService] Fallback download failed:', fbErr);
            }
          }

          if (!fallbackSuccess) {
            throw new Error(`Download failed with status ${downloadResult.status}`);
          }
        }
      }

      // Verify file exists and has size
      const fileInfo = await FileSystem.getInfoAsync(tempFileUri);
      if (!fileInfo.exists || !('size' in fileInfo) || fileInfo.size === 0) {
        throw new Error('Downloaded file is empty or missing');
      }

      // 3. Request permissions & save to device media library (Gallery)
      const mediaLib = getSafeMediaLibrary();

      // If native MediaLibrary is not available in the current environment (e.g. Expo Go)
      if (!mediaLib) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(tempFileUri, {
            mimeType: 'image/png',
            dialogTitle: 'Save Image',
          });
          return {
            success: true,
            savedToGallery: false,
            uri: tempFileUri,
          };
        }
        throw new Error('Media saving is not available in this client.');
      }

      let hasPermission = false;
      try {
        if (typeof mediaLib.getPermissionsAsync === 'function') {
          const permission = await mediaLib.getPermissionsAsync(true);
          if (permission.granted || permission.status === 'granted') {
            hasPermission = true;
          }
        }
        if (!hasPermission && typeof mediaLib.requestPermissionsAsync === 'function') {
          const req = await mediaLib.requestPermissionsAsync(true);
          hasPermission = req.granted || req.status === 'granted';
        }
      } catch (permErr) {
        console.warn('[imageService] MediaLibrary permission error:', permErr);
      }

      if (!hasPermission) {
        // Fallback to native sharing sheet if gallery permission was denied
        if (await Sharing.isAvailableAsync()) {
          try {
            await Sharing.shareAsync(tempFileUri, {
              mimeType: 'image/png',
              dialogTitle: 'Save Image',
            });
            return {
              success: true,
              savedToGallery: false,
              uri: tempFileUri,
              permissionDenied: true,
            };
          } catch (shareErr) {
            console.warn('[imageService] Sharing fallback failed:', shareErr);
          }
        }

        return {
          success: false,
          savedToGallery: false,
          permissionDenied: true,
          errorMessage: 'Storage permission denied. Please allow gallery access in Settings.',
        };
      }

      // 4. Save to Device Media Library (Gallery/Photos)
      let savedAsset: any = null;
      let saveError: any = null;

      // Method 1: saveToLibraryAsync
      if (typeof mediaLib.saveToLibraryAsync === 'function') {
        try {
          await mediaLib.saveToLibraryAsync(tempFileUri);
          savedAsset = { uri: tempFileUri };
        } catch (err1) {
          saveError = err1;
          console.warn('[imageService] saveToLibraryAsync attempt error:', err1);
        }
      }

      // Method 2: createAssetAsync
      if (!savedAsset && typeof mediaLib.createAssetAsync === 'function') {
        try {
          savedAsset = await mediaLib.createAssetAsync(tempFileUri);
        } catch (err2) {
          saveError = err2;
          console.warn('[imageService] createAssetAsync attempt error:', err2);
        }
      }

      // Method 3: Asset.create (SDK 57)
      if (!savedAsset && typeof mediaLib.Asset?.create === 'function') {
        try {
          savedAsset = await mediaLib.Asset.create(tempFileUri);
        } catch (err3) {
          saveError = err3;
          console.warn('[imageService] Asset.create attempt error:', err3);
        }
      }

      if (!savedAsset) {
        // Fallback to Sharing if MediaLibrary write failed in this environment
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(tempFileUri, {
            mimeType: 'image/png',
            dialogTitle: 'Save Image',
          });
          return {
            success: true,
            savedToGallery: false,
            uri: tempFileUri,
          };
        }
        throw saveError || new Error('Could not save image to gallery');
      }

      // Optional: Add to 'ChatBox AI' album in Gallery
      try {
        if (savedAsset && typeof mediaLib.getAlbumAsync === 'function') {
          const album = await mediaLib.getAlbumAsync('ChatBox AI');
          if (!album && typeof mediaLib.createAlbumAsync === 'function') {
            await mediaLib.createAlbumAsync('ChatBox AI', savedAsset, false);
          } else if (album && typeof mediaLib.addAssetsToAlbumAsync === 'function') {
            await mediaLib.addAssetsToAlbumAsync([savedAsset], album, false);
          }
        }
      } catch (albumErr) {
        console.log('[imageService] Gallery album group notice (non-fatal):', albumErr);
      }

      // Clean up temporary cache file after successful gallery save
      try {
        await FileSystem.deleteAsync(tempFileUri, { idempotent: true });
      } catch {
        // Non-fatal
      }

      return {
        success: true,
        savedToGallery: true,
        uri: savedAsset.uri || tempFileUri,
      };
    } catch (error: any) {
      console.error('[imageService] downloadImageToGallery error:', error);

      // Final fallback: try native share if temp file was created
      try {
        const fileInfo = await FileSystem.getInfoAsync(tempFileUri);
        if (fileInfo.exists && (await Sharing.isAvailableAsync())) {
          await Sharing.shareAsync(tempFileUri, {
            mimeType: 'image/png',
            dialogTitle: 'Save Image',
          });
          return {
            success: true,
            savedToGallery: false,
            uri: tempFileUri,
          };
        }
      } catch {
        // fallback failed
      }

      return {
        success: false,
        savedToGallery: false,
        errorMessage: error?.message || 'Download and save failed',
      };
    }
  },

  /**
   * Backward-compatible wrapper for existing callers.
   */
  async downloadAndShareImage(imageUrl: string, fileName?: string): Promise<{ success: boolean; uri?: string }> {
    const res = await this.downloadImageToGallery(imageUrl, fileName);
    return { success: res.success, uri: res.uri };
  },
};
