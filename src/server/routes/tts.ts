/**
 * src/server/routes/tts.ts
 *
 * Dedicated Server-Side Text-To-Speech Route.
 * Adapts website app/api/tts/route.ts.
 * Keeps ELEVENLABS_API_KEY strictly server-side.
 */

import { Router, Request, Response } from 'express';
import { preprocessTextForTTS } from '../services/voicePreprocess';
import { synthesizeElevenLabsAudio, getVoiceOptionById } from '../services/elevenlabs';
import { logger } from '../lib/logger';

export const ttsRouter = Router();

// In-memory LRU cache to avoid re-synthesizing repeated queries
interface CacheEntry {
  buffer: Buffer;
  timestamp: number;
}
const ttsCache = new Map<string, CacheEntry>();
const MAX_CACHE_ENTRIES = 50;
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

function getCacheKey(text: string, voiceOptionId: string): string {
  return `${text.trim()}:${voiceOptionId.toLowerCase()}`;
}

ttsRouter.post('/tts', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const rawText = body.text || '';

    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return res.status(400).json({ error: 'Text field is required for TTS synthesis.' });
    }

    // Preprocess text
    const processedText = preprocessTextForTTS(rawText, 500);
    if (!processedText) {
      return res.status(400).json({ error: 'Provided text contains no synthesizable words.' });
    }

    const voiceOptionId = body.voiceOptionId || body.voiceId || 'voice-1';
    const approvedVoice = getVoiceOptionById(voiceOptionId);

    // Check LRU cache
    const cacheKey = getCacheKey(processedText, approvedVoice.id);
    const cached = ttsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', cached.buffer.length.toString());
      res.setHeader('X-TTS-Cache', 'HIT');
      return res.status(200).send(cached.buffer);
    }

    // Synthesize audio
    const audioBuffer = await synthesizeElevenLabsAudio({
      text: processedText,
      voiceOptionId: approvedVoice.id,
      voiceId: approvedVoice.voiceId,
      modelId: body.modelId,
    });

    // Save to LRU cache
    if (audioBuffer && audioBuffer.length > 0) {
      if (ttsCache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = ttsCache.keys().next().value;
        if (oldestKey) ttsCache.delete(oldestKey);
      }
      ttsCache.set(cacheKey, {
        buffer: audioBuffer,
        timestamp: Date.now(),
      });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length.toString());
    res.setHeader('X-TTS-Cache', 'MISS');
    return res.status(200).send(audioBuffer);

  } catch (error: any) {
    logger.error('TTS Route Error:', { error: error.message });
    return res.status(500).json({
      error: error.message || 'TTS synthesis failed',
    });
  }
});
