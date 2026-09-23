/**
 * src/server/lib/ai/nvidia.ts
 *
 * NVIDIA Omni Multimodal Provider with key rotation and reasoning extraction.
 * Matches Master Specification Section 13.
 */

import { logger } from '../logger';

const rawKeys = [
  process.env.NVIDIA_API_KEY,
  process.env.EXPO_PUBLIC_NVIDIA_API_KEY,
  process.env.EXPO_PUBLIC_NVIDIA_API_KEY_2,
  process.env.EXPO_PUBLIC_NVIDIA_API_KEY_3,
  process.env.EXPO_PUBLIC_NVIDIA_API_KEY_4,
];

export const nvidiaKeys: string[] = rawKeys
  .filter((k): k is string => typeof k === 'string' && k.trim().length > 10)
  .map((k) => k.trim())
  .filter((k, i, arr) => arr.indexOf(k) === i);

const NVIDIA_API_BASE = 'https://integrate.api.nvidia.com/v1';
const NVIDIA_OMNI_MODEL = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';

let nvidiaKeyIndex = 0;

function getNextNvidiaKey(): string | null {
  if (nvidiaKeys.length === 0) return null;
  const key = nvidiaKeys[nvidiaKeyIndex % nvidiaKeys.length];
  nvidiaKeyIndex = (nvidiaKeyIndex + 1) % nvidiaKeys.length;
  return key;
}

/**
 * Extracts <think>...</think> reasoning trace from NVIDIA model output.
 */
export function extractThinking(text = ''): { thinkingContent: string | null; cleanResponse: string } {
  if (!text) return { thinkingContent: null, cleanResponse: '' };
  const match = text.match(/<think>([\s\S]*?)<\/think>/i);
  const thinkingContent = match ? match[1].trim() : null;
  const cleanResponse = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  return { thinkingContent, cleanResponse: cleanResponse || text.trim() };
}

export interface NvidiaFilePart {
  mimeType: string;
  buffer: Buffer;
  fileName: string;
}

/**
 * Executes multimodal analysis using NVIDIA API with key failover.
 */
export async function runNvidiaAnalysis(
  prompt: string,
  files: NvidiaFilePart[],
  systemInstruction?: string
): Promise<{ text: string; thinkingContent: string | null; model: string }> {
  if (nvidiaKeys.length === 0) {
    throw new Error('No NVIDIA API keys configured on server');
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < nvidiaKeys.length; attempt++) {
    const apiKey = getNextNvidiaKey()!;

    try {
      const userContentParts: any[] = [{ type: 'text', text: prompt }];

      // NVIDIA only accepts data URLs for image MIME types
      for (const f of files) {
        if (f.mimeType.startsWith('image/')) {
          const dataUri = `data:${f.mimeType};base64,${f.buffer.toString('base64')}`;
          userContentParts.push({
            type: 'image_url',
            image_url: { url: dataUri, detail: 'high' },
          });
        } else {
          userContentParts.push({
            type: 'text',
            text: `[Attached File: ${f.fileName} (${f.mimeType})]\nContent: ${f.buffer.toString('utf-8').slice(0, 10000)}`,
          });
        }
      }

      const messages: any[] = [];
      if (systemInstruction) {
        messages.push({
          role: 'system',
          content: systemInstruction,
        });
      }

      messages.push({
        role: 'user',
        content: userContentParts,
      });

      const response = await fetch(`${NVIDIA_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: NVIDIA_OMNI_MODEL,
          messages,
          temperature: 0.6,
          max_tokens: 3072,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`NVIDIA HTTP ${response.status}: ${errorText}`);
      }

      const data: any = await response.json();
      const rawText = data?.choices?.[0]?.message?.content || '';
      const { thinkingContent, cleanResponse } = extractThinking(rawText);

      return {
        text: cleanResponse,
        thinkingContent,
        model: NVIDIA_OMNI_MODEL,
      };
    } catch (err: any) {
      lastError = err;
      logger.warn('NVIDIA analysis attempt failed, trying next key:', {
        keySuffix: apiKey.slice(-6),
        error: err.message,
      });
    }
  }

  throw lastError || new Error('All NVIDIA API keys failed for multimodal analysis');
}
