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
import { Share, Platform } from 'react-native';

const MOBILE_API_BASE_URL =
  process.env.EXPO_PUBLIC_MOBILE_API_URL || 'https://api-mobile.chatboxai.co.in';

export function normalizeImageUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  if (
    rawUrl.startsWith('http://') ||
    rawUrl.startsWith('https://') ||
    rawUrl.startsWith('file://') ||
    rawUrl.startsWith('data:')
  ) {
    return rawUrl;
  }
  if (rawUrl.startsWith('/')) {
    return `${MOBILE_API_BASE_URL}${rawUrl}`;
  }
  return rawUrl;
}

export interface GenerateImagePayload {
  prompt: string;
  model?: string;
  provider?: 'huggingface' | 'leonardo';
  width?: number;
  height?: number;
  referenceImage?: string | null;
  referenceImageBase64?: string | null;
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
  provider: 'huggingface' | 'leonardo';
  width: number;
  height: number;
  generationType: 'text-to-image' | 'image-to-image';
  hasReferenceImage: boolean;
  modelWasSwitched: boolean;
  createdAt: string;
  message?: string;
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

      const imageUrl = normalizeImageUrl(data.imageUrl || data.displayUrl || data.publicUrl);
      return {
        success: true,
        docId: data.docId || data.generation?.$id || data.libId || `doc_${Date.now()}`,
        libId: data.libId,
        imageUrl,
        publicUrl: imageUrl,
        prompt: data.prompt || payload.prompt,
        model: data.model || payload.model || '',
        modelName: data.modelName || '',
        provider: data.provider || payload.provider || 'huggingface',
        width: data.width || payload.width || 1024,
        height: data.height || payload.height || 1024,
        generationType: data.generationType || (payload.referenceImageBase64 ? 'image-to-image' : 'text-to-image'),
        hasReferenceImage: Boolean(data.hasReferenceImage || payload.referenceImageBase64),
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
          publicUrl: normalizeImageUrl(doc.publicUrl || doc.imageUrl),
          displayUrl: normalizeImageUrl(doc.displayUrl || doc.imageUrl || doc.publicUrl),
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
        publicUrl: normalizeImageUrl(doc.publicUrl || ''),
        displayUrl: normalizeImageUrl(doc.displayUrl || doc.publicUrl || ''),
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
   * Download and save/share generated image
   */
  async downloadAndShareImage(imageUrl: string, fileName?: string): Promise<{ success: boolean; uri?: string }> {
    if (!imageUrl) return { success: false };

    const targetUrl = normalizeImageUrl(imageUrl);

    try {
      const cleanFileName = fileName || `chatboxai_${Date.now()}.png`;
      const fileUri = `${FileSystem.cacheDirectory}${cleanFileName}`;

      const downloadResult = await FileSystem.downloadAsync(targetUrl, fileUri);

      if (downloadResult.status !== 200) {
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }

      // Open share dialog so user can save to photos/files or send to any app
      if (Platform.OS === 'ios') {
        await Share.share({
          title: 'Generated Image',
          url: downloadResult.uri,
          message: 'Generated with ChatBox AI',
        });
      } else {
        await Share.share({
          title: 'Generated Image',
          message: `ChatBox AI Image: ${downloadResult.uri}`,
        });
      }

      return { success: true, uri: downloadResult.uri };
    } catch (error) {
      console.error('[imageService] Download/share error:', error);
      // Fallback: share the public URL directly
      try {
        await Share.share({
          title: 'Generated Image',
          url: targetUrl,
          message: targetUrl,
        });
        return { success: true, uri: targetUrl };
      } catch {
        return { success: false };
      }
    }
  },
};
