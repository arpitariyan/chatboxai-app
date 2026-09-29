/**
 * src/server/services/research/search-utils.ts
 *
 * Query complexity, search intent checking, URL canonicalization,
 * and source quality scoring utilities for Deep Research.
 */

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with', 'by', 'is', 'are', 'was',
  'were', 'be', 'as', 'at', 'from', 'that', 'this', 'it', 'its', 'their', 'your', 'you', 'about'
]);

export function tokenize(text = ''): string[] {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token && !STOP_WORDS.has(token));
}

export function keywordOverlapScore(left = '', right = ''): number {
  const leftTokens = new Set(tokenize(left));
  if (!leftTokens.size) return 0;
  const rightTokens = new Set(tokenize(right));
  let overlap = 0;
  leftTokens.forEach(token => {
    if (rightTokens.has(token)) overlap += 1;
  });
  return overlap / leftTokens.size;
}

export function computeComplexityScore(query: string): number {
  if (!query) return 0;
  const lowerQuery = query.toLowerCase();
  let score = 0;

  const complexKeywords = ['compare', 'vs', 'latest', 'benchmark', 'pricing', 'best', '2025', '2026', 'difference'];
  complexKeywords.forEach(kw => {
    if (lowerQuery.includes(kw)) score += 15;
  });

  const commas = (lowerQuery.match(/,/g) || []).length;
  score += Math.min(commas * 10, 20);

  const words = lowerQuery.split(/\s+/).length;
  score += Math.min(Math.max(0, words - 12) * 2, 20);

  return Math.min(score, 100);
}

export function needsSearch(query: string): boolean {
  if (!query) return false;
  const lowerQuery = query.toLowerCase();

  const factualMarkers = [
    'latest', 'news', '2024', '2025', '2026', 'update', 'price',
    'who', 'where', 'when', 'which', 'vs', 'compare', 'review',
    'best', 'buy', 'how to', 'what is', 'statistics', 'trend'
  ];
  const hasFactualMarker = factualMarkers.some(kw => lowerQuery.includes(kw));

  const reasoningPatterns = [
    /agar\s+.+\s+(toh|to)\b/i,
    /\bsuppose\b/i,
    /\bimagine\b/i,
    /\bwhat\s+would\s+happen\s+if\b/i,
    /\bthought\s+experiment\b/i,
    /\bcalculate\b/i,
    /\bprove\b/i,
  ];
  const hasReasoningPattern = reasoningPatterns.some(rx => rx.test(query));

  if (hasReasoningPattern && !hasFactualMarker) return false;
  if (lowerQuery.length > 150 && !hasFactualMarker) return false;

  return true;
}

export function canonicalizeUrl(url = ''): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.hostname = parsed.hostname.replace(/^www\./, '');
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'ref'];
    trackingParams.forEach(param => parsed.searchParams.delete(param));
    // Remove trailing slash unless root path
    let cleaned = parsed.toString();
    if (parsed.pathname !== '/' && cleaned.endsWith('/')) {
      cleaned = cleaned.slice(0, -1);
    }
    // Also remove trailing ? if empty search
    return cleaned.replace(/\?$/, '');
  } catch {
    return String(url || '').trim();
  }
}

export function getDomain(url = ''): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

export interface SourceQualityResult {
  score: number;
  band: 'high' | 'medium' | 'low';
  domain: string;
}

export function calculateSourceQualityScore(item: any = {}, originalQuery = ''): SourceQualityResult {
  const url = item?.link || item?.url || '';
  const domain = getDomain(url);
  const snippet = String(item?.snippet || item?.description || item?.content || '');
  const overlap = keywordOverlapScore(originalQuery, snippet) * 20;

  let score = 40 + overlap;

  if (/\.(gov|edu)$/i.test(domain)) score += 20;
  else if (/(wikipedia|nature|arxiv|forbes|harvard|mit|who\.int|oecd|worldbank|reuters|bloomberg)/i.test(domain)) score += 12;

  const publishDateRaw = item?.pagemap?.metatags?.[0]?.['article:published_time'] || item?.publishedDate;
  if (publishDateRaw) {
    const publishedAt = new Date(publishDateRaw).getTime();
    if (!Number.isNaN(publishedAt)) {
      const daysOld = (Date.now() - publishedAt) / (1000 * 60 * 60 * 24);
      if (daysOld <= 30) score += 12;
      else if (daysOld <= 180) score += 8;
      else if (daysOld <= 365) score += 5;
      else if (daysOld > 1825) score -= 6;
    }
  }

  if (/(forum|reddit|quora|medium\.com\/u\/)/i.test(domain)) score -= 4;
  if (!snippet || snippet.length < 40) score -= 5;

  const bounded = Math.max(0, Math.min(100, Math.round(score)));
  let band: 'high' | 'medium' | 'low' = 'medium';
  if (bounded >= 75) band = 'high';
  else if (bounded < 45) band = 'low';

  return { score: bounded, band, domain };
}
