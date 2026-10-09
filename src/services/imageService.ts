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
import { chatService } from './chatService';
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
  process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || '69a3eac50018b30b4556';
const APPWRITE_PUBLIC_BUCKET_ID =
  process.env.EXPO_PUBLIC_APPWRITE_STORAGE_BUCKET_ID || '69a69b9c0009d1b683dd';

/**
 * Safely probes whether an Expo native module is registered in the current runtime
 * WITHOUT triggering Metro's fatal guardedLoadModule exception.
 */
function isNativeModuleAvailable(moduleName: string): boolean {
  try {
    const { requireOptionalNativeModule } = require('expo');
    if (typeof requireOptionalNativeModule === 'function') {
      const mod = requireOptionalNativeModule(moduleName);
      if (mod) return true;
    }
  } catch {
    // ignore
  }

  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).expo?.modules?.[moduleName]) {
      return true;
    }
  } catch {
    // ignore
  }

  try {
    const { NativeModules } = require('react-native');
    if (NativeModules && (NativeModules[moduleName] || NativeModules.NativeModulesProxy?.[moduleName])) {
      return true;
    }
  } catch {
    // ignore
  }

  return false;
}

/**
 * Safely loads MediaLibrary dynamically at runtime inside try/catch blocks.
 *
 * In Expo SDK 57, `expo-media-library` unconditionally calls `requireNativeModule('ExpoMediaLibraryNext')`
 * at module evaluation time. If the native module is not present in the runtime binary
 * (such as in Expo Go or clients without the native module linked), Metro's require loader
 * reports this as a fatal uncaught error.
 *
 * To avoid this crash:
 * 1. We probe whether 'ExpoMediaLibraryNext' or 'ExpoMediaLibrary' is actually registered.
 * 2. If neither is available, we return null immediately without requiring the package.
 * 3. The caller (`downloadImageToGallery`) then seamlessly falls back to `expo-sharing`.
 */
function getSafeMediaLibrary(): { mode: 'sdk57' | 'legacy'; module: any } | null {
  // 1. SDK 57 new class-based API
  // Only require 'expo-media-library' if 'ExpoMediaLibraryNext' native module is verified to exist.
  if (isNativeModuleAvailable('ExpoMediaLibraryNext')) {
    try {
      const next = require('expo-media-library');
      if (
        next &&
        next.Asset &&
        typeof next.Asset.create === 'function' &&
        typeof next.requestPermissionsAsync === 'function'
      ) {
        return { mode: 'sdk57', module: next };
      }
    } catch (err) {
      console.warn('[imageService] Failed to load expo-media-library:', err);
    }
  }

  // 2. Legacy module fallback (SDK < 57 or custom builds with legacy module)
  // Only require 'expo-media-library/legacy' if 'ExpoMediaLibrary' native module is verified to exist.
  if (isNativeModuleAvailable('ExpoMediaLibrary')) {
    try {
      const legacy = require('expo-media-library/legacy');
      if (
        legacy &&
        (typeof legacy.saveToLibraryAsync === 'function' ||
          typeof legacy.createAssetAsync === 'function' ||
          typeof legacy.requestPermissionsAsync === 'function')
      ) {
        return { mode: 'legacy', module: legacy };
      }
    } catch (err) {
      console.warn('[imageService] Failed to load expo-media-library/legacy:', err);
    }
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
    // If it has /storage/buckets/.../files/.../view or download
    if (trimmed.includes('/storage/buckets/') && trimmed.includes('/files/')) {
      const match = trimmed.match(/\/files\/([a-zA-Z0-9_-]+)/);
      if (match?.[1]) {
        return `${APPWRITE_PUBLIC_ENDPOINT}/storage/buckets/${APPWRITE_PUBLIC_BUCKET_ID}/files/${match[1]}/view?project=${APPWRITE_PUBLIC_PROJECT_ID}`;
      }
    }

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

interface ImageCacheEntry {
  data: GeneratedImageItem[];
  timestamp: number;
}
const ALL_IMAGES_CACHE = new Map<string, ImageCacheEntry>();
const ALL_IMAGES_IN_FLIGHT = new Map<string, Promise<GeneratedImageItem[]>>();
const ALL_IMAGES_CACHE_TTL_MS = 25 * 1000; // 25 seconds

export function clearImagesCache(email?: string) {
  if (email) {
    ALL_IMAGES_CACHE.delete(email.trim().toLowerCase());
  } else {
    ALL_IMAGES_CACHE.clear();
  }
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

      const result: GenerateImageResultResponse = {
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
      if (userEmail) {
        clearImagesCache(userEmail);
      }
      return result;
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
   * Fetch ALL generated images across all conversations for the logged-in user.
   * Multi-tier strategy: Direct Appwrite DB -> Mobile API -> Web History API -> Conversation crawl
   */
  async fetchAllUserImages(email: string, forceRefresh = false): Promise<GeneratedImageItem[]> {
    if (!email) return [];
    const normalizedEmail = email.trim().toLowerCase();

    // 1. In-memory TTL cache
    if (!forceRefresh) {
      const cached = ALL_IMAGES_CACHE.get(normalizedEmail);
      if (cached && Date.now() - cached.timestamp < ALL_IMAGES_CACHE_TTL_MS) {
        return cached.data;
      }
    }

    // 2. In-flight request deduplication
    if (ALL_IMAGES_IN_FLIGHT.has(normalizedEmail)) {
      return ALL_IMAGES_IN_FLIGHT.get(normalizedEmail)!;
    }

    const fetchPromise = (async (): Promise<GeneratedImageItem[]> => {
      try {
        const result = await imageService._performFetchAllUserImages(normalizedEmail);
        ALL_IMAGES_CACHE.set(normalizedEmail, { data: result, timestamp: Date.now() });
        return result;
      } finally {
        ALL_IMAGES_IN_FLIGHT.delete(normalizedEmail);
      }
    })();

    ALL_IMAGES_IN_FLIGHT.set(normalizedEmail, fetchPromise);
    return fetchPromise;
  },

  async _performFetchAllUserImages(normalizedEmail: string): Promise<GeneratedImageItem[]> {
    // ── Tier 1: Direct Appwrite Query (Instant, complete across all user's image generations) ──
    if (DB_ID && IMAGE_GENERATION_COLLECTION_ID) {
      try {
        const res = await databases.listDocuments(DB_ID, IMAGE_GENERATION_COLLECTION_ID, [
          Query.equal('userEmail', normalizedEmail),
          Query.orderDesc('$createdAt'),
          Query.limit(100),
        ]);

        if (res.documents && res.documents.length > 0) {
          const directImages: GeneratedImageItem[] = res.documents
            .map((doc: any) => ({
              ...doc,
              entryId: doc.$id,
              libId: doc.libId || doc.$id,
              userEmail: doc.userEmail || normalizedEmail,
              prompt: doc.prompt || '',
              model: doc.model || '',
              status: doc.status || 'completed',
              width: doc.width || 1024,
              height: doc.height || 1024,
              created_at: doc.created_at || doc.$createdAt,
              publicUrl: normalizeImageUrl(doc.publicUrl, doc.generatedImagePath),
              displayUrl: normalizeImageUrl(doc.displayUrl || doc.publicUrl, doc.generatedImagePath),
            }))
            .filter((item: GeneratedImageItem) => Boolean(item.displayUrl || item.publicUrl));

          if (directImages.length > 0) {
            return directImages;
          }
        }
      } catch (appwriteErr: any) {
        if (__DEV__) {
          console.debug('[imageService] Direct Appwrite query fallback:', appwriteErr?.message || appwriteErr);
        }
      }
    }

    // ── Tier 2: Authenticated Mobile API Proxy (/api/mobile/image/generations?libId=all) ──
    try {
      const res = await apiClient.get('/api/mobile/image/generations', {
        params: { libId: 'all' },
        timeout: 15000,
      });

      if (res.data?.success && Array.isArray(res.data?.generations) && res.data.generations.length > 0) {
        return res.data.generations.map((doc: any) => ({
          ...doc,
          entryId: doc.entryId || doc.$id,
          libId: doc.libId || doc.$id,
          userEmail: doc.userEmail || normalizedEmail,
          prompt: doc.prompt || '',
          model: doc.model || '',
          status: doc.status || 'completed',
          width: doc.width || 1024,
          height: doc.height || 1024,
          created_at: doc.created_at || doc.$createdAt,
          publicUrl: normalizeImageUrl(doc.publicUrl || doc.imageUrl || '', doc.generatedImagePath),
          displayUrl: normalizeImageUrl(doc.displayUrl || doc.publicUrl || doc.imageUrl || '', doc.generatedImagePath),
        }));
      }
    } catch (apiErr: any) {
      if (__DEV__) {
        console.debug('[imageService] Mobile API all generations fallback:', apiErr?.message || apiErr);
      }
    }

    // ── Tier 3: Official Web API (/api/library/history) ──
    try {
      const token = await auth.currentUser?.getIdToken();
      const webUrl = `${WEB_API_BASE_URL}/api/library/history?email=${encodeURIComponent(normalizedEmail)}`;
      const res = await fetch(webUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success && Array.isArray(data.imageGenDocs) && data.imageGenDocs.length > 0) {
          return data.imageGenDocs.map((doc: any) => ({
            ...doc,
            entryId: doc.$id || doc.entryId,
            libId: doc.libId || doc.$id,
            userEmail: doc.userEmail || normalizedEmail,
            prompt: doc.prompt || '',
            model: doc.model || '',
            status: doc.status || 'completed',
            width: doc.width || 1024,
            height: doc.height || 1024,
            created_at: doc.created_at || doc.$createdAt,
            publicUrl: normalizeImageUrl(doc.publicUrl || doc.imageUrl || '', doc.generatedImagePath),
            displayUrl: normalizeImageUrl(doc.displayUrl || doc.publicUrl || doc.imageUrl || '', doc.generatedImagePath),
          }));
        }
      }
    } catch (webErr: any) {
      if (__DEV__) {
        console.debug('[imageService] Web history images fallback:', webErr?.message || webErr);
      }
    }

    // ── Tier 4: Fetch by each image conversation libId ──
    try {
      const allConversations = await chatService.fetchUserConversations(normalizedEmail);
      const imageConversations = allConversations.filter(c => c.type === 'image-generation');

      const fetchPromises = imageConversations.map(async (conv) => {
        try {
          return await this.fetchGenerations(conv.libId);
        } catch {
          return [];
        }
      });

      const results = await Promise.all(fetchPromises);
      const combined: GeneratedImageItem[] = [];
      for (const list of results) {
        combined.push(...list);
      }

      combined.sort((a, b) => new Date(b.created_at || (b as any).$createdAt).getTime() - new Date(a.created_at || (a as any).$createdAt).getTime());
      return combined;
    } catch (fallbackErr: any) {
      if (__DEV__) {
        console.debug('[imageService] Conversation-level fallback failed:', fallbackErr?.message || fallbackErr);
      }
      return [];
    }
  },

  /**
   * Alias for fetchGenerations for backwards compatibility
   */
  fetchGenerationsByLibId(libId: string) {
    return this.fetchGenerations(libId);
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
      const mediaResult = getSafeMediaLibrary();

      // If native MediaLibrary is not available in the current environment (e.g. Expo Go)
      if (!mediaResult) {
        if (await Sharing.isAvailableAsync()) {
          try {
            await Sharing.shareAsync(tempFileUri, {
              mimeType: 'image/png',
              dialogTitle: 'Save Image',
            });
          } catch (shareErr) {
            console.warn('[imageService] Sharing sheet dismissed or failed:', shareErr);
          }
          return {
            success: true,
            savedToGallery: false,
            uri: tempFileUri,
          };
        }
        return {
          success: true,
          savedToGallery: false,
          uri: tempFileUri,
        };
      }

      const { mode: mediaMode, module: mediaLib } = mediaResult;

      // Request write permissions
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

      if (mediaMode === 'sdk57') {
        // ── SDK 57 class-based API (primary path for production APKs) ──
        // Asset.create is the correct method; saveToLibraryAsync/createAssetAsync are deprecated stubs that throw.
        try {
          savedAsset = await mediaLib.Asset.create(tempFileUri);
        } catch (err: any) {
          saveError = err;
          console.warn('[imageService] SDK57 Asset.create error:', err?.message || err);
        }
      } else {
        // ── Legacy API fallback ──
        // Method 1: saveToLibraryAsync
        if (typeof mediaLib.saveToLibraryAsync === 'function') {
          try {
            await mediaLib.saveToLibraryAsync(tempFileUri);
            savedAsset = { uri: tempFileUri };
          } catch (err1: any) {
            saveError = err1;
            console.warn('[imageService] legacy saveToLibraryAsync error:', err1?.message || err1);
          }
        }

        // Method 2: createAssetAsync
        if (!savedAsset && typeof mediaLib.createAssetAsync === 'function') {
          try {
            savedAsset = await mediaLib.createAssetAsync(tempFileUri);
          } catch (err2: any) {
            saveError = err2;
            console.warn('[imageService] legacy createAssetAsync error:', err2?.message || err2);
          }
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
        if (mediaMode === 'sdk57') {
          // SDK 57: Album.get / Album.create
          if (mediaLib.Album && typeof mediaLib.Album.get === 'function') {
            const album = await mediaLib.Album.get('ChatBox AI');
            if (!album && typeof mediaLib.Album.create === 'function') {
              await mediaLib.Album.create('ChatBox AI', savedAsset, false);
            } else if (album && typeof album.add === 'function') {
              await album.add([savedAsset], false);
            }
          }
        } else {
          // Legacy: getAlbumAsync / createAlbumAsync / addAssetsToAlbumAsync
          if (typeof mediaLib.getAlbumAsync === 'function') {
            const album = await mediaLib.getAlbumAsync('ChatBox AI');
            if (!album && typeof mediaLib.createAlbumAsync === 'function') {
              await mediaLib.createAlbumAsync('ChatBox AI', savedAsset, false);
            } else if (album && typeof mediaLib.addAssetsToAlbumAsync === 'function') {
              await mediaLib.addAssetsToAlbumAsync([savedAsset], album, false);
            }
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
        uri: savedAsset.uri || savedAsset.localUri || tempFileUri,
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
