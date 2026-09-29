/**
 * src/server/services/research/page-scraper.ts
 *
 * Lightweight, non-blocking page content fetcher and heuristic summarizer.
 */

import axios from 'axios';
import { logger } from '../../lib/logger';

export interface HeuristicSummaryResult {
  summary: string;
  keyPoints: string[];
}

export async function fetchPageContent(url: string, timeoutMs = 8000): Promise<string> {
  if (!url || !url.startsWith('http')) return '';

  try {
    const resp = await axios.get(url, {
      timeout: timeoutMs,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (ChatBoxAI-Mobile-Research)',
        Accept: 'text/html,application/xhtml+xml',
      },
      maxRedirects: 3,
      responseType: 'text',
    });

    const html = String(resp.data || '');
    const cleanText = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<header[\s\S]*?<\/header>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();

    return cleanText.slice(0, 6000);
  } catch (err: any) {
    // Non-blocking failure: many sites block scraping or timeout
    return '';
  }
}

export function heuristicSummary(text: string): HeuristicSummaryResult {
  if (!text || text.length < 50) {
    return { summary: '', keyPoints: [] };
  }

  const sentences = text
    .split(/(?<=\.)\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 300);

  const summary = sentences.slice(0, 3).join(' ');
  const keyPoints = sentences.slice(3, 7);

  return { summary, keyPoints };
}
