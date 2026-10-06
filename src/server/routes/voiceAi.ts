/**
 * src/server/routes/voiceAi.ts
 *
 * Dedicated Voice AI Conversational Processing Route.
 * Adapts website app/api/voice-ai/route.js.
 * Generates concise, natural, emotionally expressive conversational voice responses.
 */

import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../lib/logger';

export const voiceAiRouter = Router();

function getGeminiApiKeys(): string[] {
  return [
    process.env.EXPO_PUBLIC_GOOGLE_API_KEY,
    process.env.EXPO_PUBLIC_GOOGLE_API_KEY_2,
    process.env.EXPO_PUBLIC_GOOGLE_API_KEY_3,
    process.env.EXPO_PUBLIC_GOOGLE_API_KEY_4,
    process.env.EXPO_PUBLIC_GOOGLE_API_KEY_5,
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_API_KEY_2,
  ].filter((k): k is string => Boolean(k && k.trim() !== ''));
}

async function callGemini(prompt: string): Promise<string> {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) {
    throw new Error('No Gemini API keys configured.');
  }

  let lastError: any = null;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      if (text && text.trim()) return text;
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  throw lastError || new Error('All Gemini API keys failed');
}

function isCreatorQuery(query: string): boolean {
  const normalized = query.toLowerCase().trim();
  const creatorPatterns = [
    /who\s+(created|made|built|developed|designed)\s+you/i,
    /who\s+(is\s+your|are\s+your)\s+(creator|maker|developer|builder)/i,
    /who\s+are\s+you\s+(created|made|built)\s+by/i,
    /what\s+(company|organization|team)\s+(created|made|built|developed)\s+you/i,
    /who\s+owns\s+you/i,
    /who\s+founded\s+you/i,
    /tumhein\s*(kisne|kaun)\s*(banaya|develop\s*kiya)/i,
    /tumhara\s*(creator|maker)\s*kaun\s*hai/i,
  ];
  return creatorPatterns.some((pattern) => pattern.test(normalized));
}

function getCreatorResponse(language = 'en'): string {
  const responses: Record<string, string> = {
    en: 'ChatBox AI created me.',
    hi: 'ChatBox AI ने मुझे बनाया।',
    es: 'ChatBox AI me creó.',
    fr: "ChatBox AI m'a créé.",
    de: 'ChatBox AI hat mich erstellt.',
  };
  return responses[language] || responses.en;
}

voiceAiRouter.post('/voice-ai', async (req: Request, res: Response) => {
  try {
    const { query, language = 'en', conversationHistory = [] } = req.body || {};

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'Query is required' });
    }

    if (isCreatorQuery(query)) {
      const resp = getCreatorResponse(language);
      return res.status(200).json({
        response: resp,
        language,
        isCreatorQuery: true,
      });
    }

    // Context from conversation turns
    const context = Array.isArray(conversationHistory) && conversationHistory.length > 0
      ? conversationHistory.slice(-4).map((msg: any) =>
          `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
        ).join('\n') + '\n\n'
      : '';

    const prompt = `${context}User asks: "${query}"

Please provide a short, clear, and natural conversational voice response (2-3 sentences maximum).
- Sound like you are speaking naturally in real-time conversation
- Be concise, direct, and helpful
- Do not use markdown symbols, bullet points, citations, or formatting
- If the user spoke in Hindi or another language, respond in that same language

Response:`;

    const aiText = await callGemini(prompt);

    // Clean up response for speech output
    let cleaned = aiText
      .replace(/[#*_`\[\]()]/g, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleaned.length > 500) {
      const sentences = cleaned.split(/[.!?]+/).filter((s) => s.trim());
      cleaned = sentences.slice(0, 2).join('. ').trim() + '.';
    }

    return res.status(200).json({
      response: cleaned,
      language,
      isCreatorQuery: false,
    });
  } catch (error: any) {
    logger.error('Voice AI Route Error:', { error: error.message });
    return res.status(500).json({
      error: error.message || 'Voice query processing failed',
    });
  }
});
