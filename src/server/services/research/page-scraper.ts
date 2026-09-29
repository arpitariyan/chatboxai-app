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
  extractedClaims?: string[];
  isThin?: boolean;
}

export async function fetchPageContent(url: string, timeoutMs = 3500): Promise<string> {
  if (!url || !url.startsWith('http')) return '';

  try {
    const resp = await axios.get(url, {
      timeout: timeoutMs,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (ChatBoxAI-Mobile-Research)',
        Accept: 'text/html,application/xhtml+xml',
      },
      maxRedirects: 2,
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
      .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
      .replace(/<form[\s\S]*?<\/form>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();

    // Stage 6 & 7: Thin-page rejection - ignore pages with less than 120 characters of actual content
    if (cleanText.length < 120) {
      return '';
    }

    return cleanText.slice(0, 6000);
  } catch (err: any) {
    // Non-blocking failure: many sites block scraping, return 403, or timeout within 3.5s
    return '';
  }
}

export function heuristicSummary(text: string): HeuristicSummaryResult {
  if (!text || text.length < 120) {
    return { summary: '', keyPoints: [], extractedClaims: [], isThin: true };
  }

  const sentences = text
    .split(/(?<=[.?!])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 25 && s.length < 350 && !/cookie|privacy policy|terms of service|all rights reserved/i.test(s));

  const summary = sentences.slice(0, 3).join(' ');
  const keyPoints = sentences.slice(3, 7);

  // Extract factual claims: statements containing concrete figures, percentages, dates, or specifications
  const claimRegex = /(?:\b\d+(?:\.\d+)?%|\$\d+|\b202[4-9]\b|\bv?\d+\.\d+(?:\.\d+)?\b|\b(?:ms|gb|mb|kb|fps|ghz|mhz)\b|\b(?:faster|slower|increased|decreased|benchmark|price|cost)\b)/i;
  const extractedClaims = sentences
    .filter(s => claimRegex.test(s))
    .slice(0, 5);

  return { summary, keyPoints, extractedClaims, isThin: false };
}
