/**
 * src/server/lib/ai/index.ts
 *
 * Unified AI Multimodal Analysis Router.
 * Matches Master Specification Section 13.
 */

import { runGeminiAnalysis } from './gemini';
import { runNvidiaAnalysis } from './nvidia';
import { AuthenticatedUser } from '../firebase-admin';
import { logger } from '../logger';

export interface AnalysisFileItem {
  fileId: string;
  bucketId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

export interface AnalyzeOptions {
  user: AuthenticatedUser;
  prompt: string;
  files: AnalysisFileItem[];
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  memoryEnabled?: boolean;
}

export interface NormalizedAnalysisResult {
  aiResponse: string;
  thinkingContent: string | null;
  searchResult?: any;
}

export async function analyzeFiles(options: AnalyzeOptions): Promise<NormalizedAnalysisResult> {
  const { prompt, files, conversationHistory = [] } = options;

  let systemInstruction =
    'You are ChatBox AI, a helpful, precise, and intelligent multimodal assistant. ' +
    'Thoroughly inspect all provided attachments, documents, and images to answer the user question accurately. ' +
    'Use clear, structured markdown formatting.';

  if (conversationHistory.length > 0) {
    const recentHistory = conversationHistory
      .slice(-6)
      .map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`)
      .join('\n\n');
    systemInstruction += `\n\nRecent Conversation Context:\n${recentHistory}`;
  }

  // Check if any video or audio files are attached
  const hasAudioOrVideo = files.some(
    (f) => f.mimeType.startsWith('video/') || f.mimeType.startsWith('audio/')
  );

  // If audio or video -> route directly to NVIDIA Omni
  if (hasAudioOrVideo) {
    logger.info('Routing to NVIDIA Omni for media analysis', { fileCount: files.length });
    const nvidiaRes = await runNvidiaAnalysis(
      prompt,
      files.map((f) => ({ mimeType: f.mimeType, buffer: f.buffer, fileName: f.fileName })),
      systemInstruction
    );

    return {
      aiResponse: nvidiaRes.text,
      thinkingContent: nvidiaRes.thinkingContent,
    };
  }

  // Otherwise try Gemini first, falling back to NVIDIA on error
  try {
    logger.info('Attempting Gemini multimodal analysis', { fileCount: files.length });
    const geminiRes = await runGeminiAnalysis(
      prompt,
      files.map((f) => ({ mimeType: f.mimeType, buffer: f.buffer })),
      systemInstruction
    );

    return {
      aiResponse: geminiRes.text,
      thinkingContent: null,
    };
  } catch (geminiError: any) {
    logger.warn('Gemini multimodal failed, attempting NVIDIA fallback:', {
      error: geminiError.message,
    });

    try {
      const nvidiaRes = await runNvidiaAnalysis(
        prompt,
        files.map((f) => ({ mimeType: f.mimeType, buffer: f.buffer, fileName: f.fileName })),
        systemInstruction
      );

      return {
        aiResponse: nvidiaRes.text,
        thinkingContent: nvidiaRes.thinkingContent,
      };
    } catch (nvidiaError: any) {
      logger.error('Both Gemini and NVIDIA multimodal failed:', {
        gemini: geminiError.message,
        nvidia: nvidiaError.message,
      });
      throw new Error('All AI analysis providers failed to process attachments. Please try again.');
    }
  }
}
