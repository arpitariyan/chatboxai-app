/**
 * src/server/lib/ai/index.ts
 *
 * Unified AI Multimodal Analysis Router.
 * Directs files to Gemini and NVIDIA according to their genuine modality capabilities.
 *
 * - Gemini Flash (gemini-2.5-flash / gemini-2.0-flash):
 *   Natively processes Images, PDFs, Audio, and Video via inlineData.
 *   Receives extracted text for Word, PowerPoint, Excel, CSV, and Text files.
 *
 * - NVIDIA Omni (nvidia/nemotron-3-nano-omni-30b-a3b-reasoning):
 *   Processes Images via image_url data URIs.
 *   Processes Documents and PDFs via extracted text context.
 *   Separates <think>...</think> reasoning traces from the final answer.
 */

import { runGeminiAnalysis, GeminiInlineFile, GeminiDocumentContext } from './gemini';
import { runNvidiaAnalysis, NvidiaImagePart, NvidiaDocumentPart } from './nvidia';
import { extractDocumentContent, getFileModality, FileModality } from './extractor';
import { AuthenticatedUser } from '../firebase-admin';
import { logger } from '../logger';
import { BadRequestError } from '../errors';

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

  if (!files || files.length === 0) {
    throw new BadRequestError('At least one file attachment is required for analysis');
  }

  // 1. Verify modality and detect unsupported formats
  const categorized = files.map((file) => {
    const modality = getFileModality(file.mimeType, file.fileName);
    return { file, modality };
  });

  const unsupported = categorized.filter((item) => item.modality === 'unsupported');
  if (unsupported.length > 0) {
    const badNames = unsupported.map((u) => `"${u.file.fileName}" (${u.file.mimeType || 'unknown'})`).join(', ');
    throw new BadRequestError(
      `Unsupported file format detected: ${badNames}. Supported formats include PDF, Word (.docx, .doc), PowerPoint (.pptx, .ppt), Excel (.xlsx, .csv), plain text, images, video, and audio files.`
    );
  }

  // 2. Build system instructions with conversation history context
  let systemInstruction =
    'You are ChatBox AI, a helpful, precise, and highly capable multimodal assistant. ' +
    'Thoroughly inspect and analyze all provided attachments, documents, spreadsheets, images, audio, or video files. ' +
    'Provide answers grounded directly in the facts, data points, text, and visual elements found in the attached files. ' +
    'Use clear, well-structured Markdown formatting with headings and bullet points where helpful.';

  if (conversationHistory.length > 0) {
    const recentHistory = conversationHistory
      .slice(-6)
      .map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`)
      .join('\n\n');
    systemInstruction += `\n\nRecent Conversation Context:\n${recentHistory}`;
  }

  // 3. Separate files into native multimodal parts and document extraction parts
  const inlineFiles: GeminiInlineFile[] = [];
  const extractedDocuments: GeminiDocumentContext[] = [];

  for (const item of categorized) {
    const { file, modality } = item;

    if (modality === 'image' || modality === 'pdf' || modality === 'video' || modality === 'audio') {
      // Native multimodal formats for Gemini
      inlineFiles.push({
        mimeType: file.mimeType,
        buffer: file.buffer,
        fileName: file.fileName,
      });
    } else if (modality === 'document') {
      // Extract text content from Word, PowerPoint, Excel, CSV, or Text
      const extracted = await extractDocumentContent(file.buffer, file.mimeType, file.fileName);
      extractedDocuments.push({
        fileName: file.fileName,
        format: extracted.format,
        text: extracted.text,
      });
    }
  }

  logger.info('Prepared files for multimodal analysis:', {
    totalFiles: files.length,
    inlineMultimodalCount: inlineFiles.length,
    extractedDocumentCount: extractedDocuments.length,
    modalities: categorized.map((c) => c.modality),
  });

  // 4. Primary Provider: Google Gemini Flash (2.5 / 2.0)
  try {
    logger.info('Attempting Gemini multimodal analysis', {
      inlineCount: inlineFiles.length,
      documentCount: extractedDocuments.length,
    });

    const geminiRes = await runGeminiAnalysis({
      prompt,
      inlineFiles,
      documents: extractedDocuments,
      systemInstruction,
    });

    return {
      aiResponse: geminiRes.text,
      thinkingContent: null,
    };
  } catch (geminiError: any) {
    logger.warn('Gemini multimodal failed, attempting NVIDIA Omni fallback:', {
      error: geminiError.message,
    });

    // 5. Fallback Provider: NVIDIA Omni
    try {
      const nvidiaImages: NvidiaImagePart[] = [];
      const nvidiaDocs: NvidiaDocumentPart[] = [...extractedDocuments];

      // For any PDF or image in inlineFiles, convert appropriately for NVIDIA
      for (const f of inlineFiles) {
        if (f.mimeType.startsWith('image/')) {
          nvidiaImages.push({
            mimeType: f.mimeType,
            buffer: f.buffer,
            fileName: f.fileName || 'image',
          });
        } else if (f.mimeType === 'application/pdf') {
          // Extract text from PDF for NVIDIA
          const pdfExtracted = await extractDocumentContent(f.buffer, f.mimeType, f.fileName || 'document.pdf');
          nvidiaDocs.push({
            fileName: f.fileName || 'document.pdf',
            format: 'PDF Document',
            text: pdfExtracted.text,
          });
        } else {
          // Video or audio (not supported as data URIs by NVIDIA)
          const mediaType = f.mimeType.startsWith('video/') ? 'Video' : 'Audio';
          nvidiaDocs.push({
            fileName: f.fileName || `${mediaType} file`,
            format: `${mediaType} File (${f.mimeType})`,
            text: `[Attached ${mediaType} file: ${f.fileName} (${f.mimeType}). Size: ${f.buffer.length} bytes.]`,
          });
        }
      }

      const nvidiaRes = await runNvidiaAnalysis({
        prompt,
        images: nvidiaImages,
        documents: nvidiaDocs,
        systemInstruction,
      });

      return {
        aiResponse: nvidiaRes.text,
        thinkingContent: nvidiaRes.thinkingContent,
      };
    } catch (nvidiaError: any) {
      logger.error('Both Gemini and NVIDIA multimodal providers failed:', {
        gemini: geminiError.message,
        nvidia: nvidiaError.message,
      });
      throw new Error(
        `Failed to analyze attachments: ${geminiError.message || 'All AI providers unavailable'}`
      );
    }
  }
}
