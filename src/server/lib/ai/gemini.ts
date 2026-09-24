/**
 * src/server/lib/ai/gemini.ts
 *
 * Gemini Multimodal Provider with key rotation and cooldown management.
 * Matches Master Specification Section 13.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleGenAI } from '@google/genai';
import { logger } from '../logger';

// Collect all available Gemini / Google API keys
const rawKeys = [
  process.env.GEMINI_API_KEY,
  process.env.GOOGLE_API_KEY,
  process.env.GOOGLE_GENAI_API_KEY,
  process.env.EXPO_PUBLIC_GOOGLE_API_KEY,
  process.env.EXPO_PUBLIC_GOOGLE_API_KEY_2,
  process.env.EXPO_PUBLIC_GOOGLE_API_KEY_3,
  process.env.EXPO_PUBLIC_GOOGLE_API_KEY_4,
  process.env.EXPO_PUBLIC_GOOGLE_API_KEY_5,
];

export const geminiKeys: string[] = rawKeys
  .filter((k): k is string => typeof k === 'string' && k.trim().length > 10)
  .map((k) => k.trim())
  .filter((k, i, arr) => arr.indexOf(k) === i);

const keyCooldowns = new Map<string, number>();

function isKeyCoolingDown(key: string): boolean {
  const until = keyCooldowns.get(key);
  return typeof until === 'number' && Date.now() < until;
}

function markKeyFailed(key: string, error: unknown) {
  const msg = String(error instanceof Error ? error.message : error).toLowerCase();
  const isQuota = msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted');
  // 3 minutes for quota, 30 minutes for invalid/blocked
  const duration = isQuota ? 3 * 60 * 1000 : 30 * 60 * 1000;
  keyCooldowns.set(key, Date.now() + duration);
  logger.warn('Marked Gemini key on cooldown:', {
    suffix: key.slice(-6),
    durationSec: duration / 1000,
    isQuota,
  });
}

export interface GeminiInlineFile {
  mimeType: string;
  buffer: Buffer;
  fileName?: string;
}

export interface GeminiDocumentContext {
  fileName: string;
  format: string;
  text: string;
}

export interface GeminiAnalysisOptions {
  prompt: string;
  inlineFiles?: GeminiInlineFile[];
  documents?: GeminiDocumentContext[];
  systemInstruction?: string;
}

/**
 * Executes multimodal & document analysis using Gemini with key failover.
 */
export async function runGeminiAnalysis(
  options: GeminiAnalysisOptions
): Promise<{ text: string; model: string }> {
  const { prompt, inlineFiles = [], documents = [], systemInstruction } = options;

  if (geminiKeys.length === 0) {
    throw new Error('No Gemini API keys configured on server');
  }

  const modelCandidates = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  let lastError: Error | null = null;

  for (const modelName of modelCandidates) {
    for (const key of geminiKeys) {
      if (isKeyCoolingDown(key)) continue;

      try {
        // Build parts array
        const parts: any[] = [];

        if (systemInstruction) {
          parts.push({ text: `System Instructions:\n${systemInstruction}\n\n` });
        }

        // Attach extracted document texts
        for (const doc of documents) {
          parts.push({
            text: `\n=== ATTACHED DOCUMENT: ${doc.fileName} (${doc.format}) ===\n${doc.text}\n=== END DOCUMENT: ${doc.fileName} ===\n`,
          });
        }

        // Attach native multimodal files (Images, PDFs, Audio, Video)
        for (const f of inlineFiles) {
          parts.push({
            inlineData: {
              mimeType: f.mimeType,
              data: f.buffer.toString('base64'),
            },
          });
          if (f.fileName) {
            parts.push({ text: `[Attachment: ${f.fileName} (${f.mimeType})]` });
          }
        }

        // Add user prompt
        parts.push({
          text: `\n=== USER QUESTION / INSTRUCTIONS ===\n${prompt}\n\nPlease thoroughly analyze all provided attachments and documents to answer the question above accurately.`,
        });

        // Try primary @google/genai client
        try {
          const aiClient = new GoogleGenAI({ apiKey: key });
          const response = await aiClient.models.generateContent({
            model: modelName,
            contents: parts,
          });

          const text = response?.text || '';
          if (text.trim()) {
            return { text: text.trim(), model: modelName };
          }
        } catch (sdkError: any) {
          // Fallback to @google/generative-ai
          const legacyAI = new GoogleGenerativeAI(key);
          const legacyModel = legacyAI.getGenerativeModel({ model: modelName });
          const result = await legacyModel.generateContent(parts);
          const response = await result.response;
          const text = response.text();
          if (text.trim()) {
            return { text: text.trim(), model: modelName };
          }
          throw sdkError;
        }
      } catch (err: any) {
        lastError = err;
        markKeyFailed(key, err);
        logger.warn('Gemini attempt failed, rotating key:', {
          model: modelName,
          keySuffix: key.slice(-6),
          error: err.message,
        });
      }
    }
  }

  throw lastError || new Error('All Gemini API keys failed for multimodal analysis');
}
