/**
 * src/services/search/webSearchService.ts
 *
 * Client-side Web Search Service for Normal Search:
 * - Dispatches fast search request to Mobile Backend (/api/mobile/search/execute)
 * - Robust, offline-friendly client fallback: executes direct web search if server is unreachable
 * - Returns structured SearchResultItem objects compatible with SourceChips and LLM context injection
 */

import axios from 'axios';
import { toMobileSearchExecuteUrl } from '../../config/mobileApi';

export interface SearchResultItem {
  id?: number;
  title: string;
  url: string;
  description: string;
  displayLink?: string;
  sourceHost?: string;
  content?: string;
  deepResearch?: boolean;
}

/**
 * Strips tracking parameters and canonicalizes URLs on the client.
 */
function canonicalizeUrl(url = ''): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.hostname = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'gclid', 'fbclid', 'igshid', 'ref', 'source', 'tracking_id'
    ];
    trackingParams.forEach(p => parsed.searchParams.delete(p));
    let cleaned = parsed.toString();
    if (parsed.pathname !== '/' && cleaned.endsWith('/')) {
      cleaned = cleaned.slice(0, -1);
    }
    return cleaned.replace(/\?$/, '');
  } catch {
    return String(url || '').trim();
  }
}

function getTavilyKeys(): string[] {
  return [
    process.env.EXPO_PUBLIC_TAVILY_API_KEY,
    process.env.EXPO_PUBLIC_TAVILY_API_KEY_2,
    process.env.EXPO_PUBLIC_TAVILY_API_KEY_3,
    process.env.EXPO_PUBLIC_TAVILY_API_KEY_4,
    process.env.EXPO_PUBLIC_TAVILY_API_KEY_5,
    process.env.EXPO_PUBLIC_TAVILY_API_KEY_6,
    process.env.TAVILY_API_KEY,
    process.env.TAVILY_API_KEY2,
    process.env.TAVILY_API_KEY3,
    process.env.TAVILY_API_KEY4,
    process.env.TAVILY_API_KEY5,
    process.env.TAVILY_API_KEY6,
  ].filter((k): k is string => Boolean(k && k.trim().length > 5));
}

async function clientTavilySearch(query: string, maxResults = 8): Promise<SearchResultItem[]> {
  const keys = getTavilyKeys();
  if (keys.length === 0) return [];

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      const response = await axios.post(
        'https://api.tavily.com/search',
        {
          api_key: key,
          query,
          search_depth: 'basic',
          include_answer: true,
          max_results: maxResults,
        },
        {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const items = response.data?.results || [];
      if (items.length > 0) {
        return items.map((r: any, idx: number) => {
          const cleanUrl = canonicalizeUrl(r.url);
          return {
            id: idx + 1,
            title: r.title || 'Source',
            url: cleanUrl,
            description: r.content || r.snippet || '',
            content: r.content || '',
            displayLink: cleanUrl ? new URL(cleanUrl).hostname.replace(/^www\./, '') : '',
            sourceHost: cleanUrl ? new URL(cleanUrl).hostname.replace(/^www\./, '') : '',
          };
        });
      }
    } catch {
      // Continue to next key in pool
    }
  }
  return [];
}

/**
 * Unescapes basic HTML entities in scraped text.
 */
function unescapeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * Direct client-side DuckDuckGo HTML scraper fallback when backend is unreachable.
 */
async function clientDuckDuckGoSearch(query: string, maxResults = 8): Promise<SearchResultItem[]> {
  try {
    const encoded = encodeURIComponent(query);
    const res = await axios.get(`https://html.duckduckgo.com/html/?q=${encoded}`, {
      timeout: 9000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const html = String(res.data || '');
    const results: SearchResultItem[] = [];
    const resultBlocks = html.split('<div class="result results_links');

    for (let i = 1; i < resultBlocks.length && results.length < maxResults; i++) {
      const block = resultBlocks[i];

      // Robust attribute-order-independent regex for DuckDuckGo result__a link
      const titleMatch = block.match(/<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      const linkMatch =
        block.match(/<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i) ||
        block.match(/<a[^>]+class="[^"]*result__url[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);

      let rawUrl = titleMatch ? titleMatch[1] : (linkMatch ? linkMatch[1] : '');
      if (rawUrl.includes('uddg=')) {
        try {
          const matchUddg = rawUrl.match(/uddg=([^&]+)/);
          if (matchUddg) rawUrl = decodeURIComponent(matchUddg[1]);
        } catch (_) {}
      } else if (rawUrl.startsWith('//')) {
        rawUrl = 'https:' + rawUrl;
      }

      const rawTitle = titleMatch ? unescapeHtml(titleMatch[2]) : '';
      const snippetMatch =
        block.match(/<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ||
        block.match(/<div[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      const rawSnippet = snippetMatch ? unescapeHtml(snippetMatch[1]) : '';

      if (rawUrl && rawTitle) {
        const cleanUrl = canonicalizeUrl(rawUrl);
        if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
          let domain = '';
          try {
            domain = new URL(cleanUrl).hostname.replace(/^www\./, '');
          } catch {}

          results.push({
            id: results.length + 1,
            title: rawTitle,
            url: cleanUrl,
            description: rawSnippet,
            displayLink: domain,
            sourceHost: domain,
          });
        }
      }
    }

    return results;
  } catch (err: any) {
    console.log('[webSearchService] Client DuckDuckGo HTML search fallback failed:', err.message);
    return [];
  }
}

/**
 * Direct client-side Wikipedia Opensearch fallback for high-authority, reliable sources.
 */
async function clientWikipediaSearch(query: string, maxResults = 5): Promise<SearchResultItem[]> {
  try {
    const encoded = encodeURIComponent(query);
    const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encoded}&limit=${maxResults}&namespace=0&format=json`;
    const res = await axios.get(url, {
      timeout: 6000,
      headers: { Accept: 'application/json' },
    });
    const data = res.data;
    if (!Array.isArray(data) || data.length < 4) return [];

    const titles = data[1] || [];
    const snippets = data[2] || [];
    const urls = data[3] || [];
    const results: SearchResultItem[] = [];

    for (let i = 0; i < titles.length; i++) {
      const u = urls[i];
      const t = titles[i];
      const s = snippets[i];
      if (u && t && (u.startsWith('http://') || u.startsWith('https://'))) {
        results.push({
          id: results.length + 1,
          title: t,
          url: u,
          description: s || `${t} — Wikipedia encyclopedic source`,
          displayLink: 'wikipedia.org',
          sourceHost: 'wikipedia.org',
        });
      }
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * Direct client-side DuckDuckGo Instant Answer API fallback as last resort.
 */
async function clientInstantAnswerSearch(query: string): Promise<SearchResultItem[]> {
  try {
    const encoded = encodeURIComponent(query);
    const url = `https://api.duckduckgo.com/?q=${encoded}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    const results: SearchResultItem[] = [];

    if (data.AbstractURL && data.Abstract) {
      results.push({
        id: 1,
        title: data.Heading || query,
        description: data.Abstract,
        url: canonicalizeUrl(data.AbstractURL),
        displayLink: data.AbstractSource || new URL(data.AbstractURL).hostname.replace(/^www\./, ''),
      });
    }

    const topics: any[] = data.RelatedTopics || [];
    for (const t of topics) {
      if (t.FirstURL && t.Text && results.length < 6) {
        const cleanUrl = canonicalizeUrl(t.FirstURL);
        results.push({
          id: results.length + 1,
          title: t.Text.split(' - ')[0] || t.Text.slice(0, 60),
          description: t.Text,
          url: cleanUrl,
          displayLink: new URL(cleanUrl).hostname.replace(/^www\./, ''),
        });
      }
    }

    return results;
  } catch {
    return [];
  }
}

export const webSearchService = {
  /**
   * Performs a fast, lightweight web search:
   * 1. First tries Mobile Backend endpoint (leveraging Tavily 12-key pool + DDG + Appwrite 6h cache)
   * 2. If backend is unavailable or fails, gracefully falls back to client-side search:
   *    - DuckDuckGo HTML parser (real live web results)
   *    - Wikipedia Opensearch (reliable factual reference sources)
   *    - DuckDuckGo Instant Answer API
   */
  async search(query: string, maxSources = 8): Promise<SearchResultItem[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    // 1. Try Mobile Backend Search Endpoint
    try {
      const url = toMobileSearchExecuteUrl();
      const res = await axios.post(
        url,
        {
          searchInput: cleanQuery,
          maxSources,
        },
        {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        }
      );

      if (res.data?.success && Array.isArray(res.data.sources) && res.data.sources.length > 0) {
        return res.data.sources.map((s: any, idx: number) => ({
          id: s.id || idx + 1,
          title: s.title || 'Source',
          url: canonicalizeUrl(s.url),
          description: s.description || s.content || '',
          content: s.content,
          displayLink: s.displayLink || (s.url ? new URL(s.url).hostname.replace(/^www\./, '') : ''),
          sourceHost: s.sourceHost || (s.url ? new URL(s.url).hostname.replace(/^www\./, '') : ''),
        }));
      }
    } catch (backendErr: any) {
      console.log('[webSearchService] Backend search unavailable, attempting client fallback:', backendErr.message);
    }

    // 2. Client-side Fallback: Direct Tavily Search via API keys pool (if keys configured)
    const tavilyResults = await clientTavilySearch(cleanQuery, maxSources);
    if (tavilyResults.length > 0) {
      return tavilyResults;
    }

    // 3. Client-side Fallback: DuckDuckGo HTML Search
    const ddgHtmlResults = await clientDuckDuckGoSearch(cleanQuery, maxSources);
    if (ddgHtmlResults.length >= 3) {
      return ddgHtmlResults;
    }

    // 4. Client-side Supplementary Fallback: Wikipedia Opensearch
    const wikiResults = await clientWikipediaSearch(cleanQuery, maxSources);
    if (ddgHtmlResults.length > 0 || wikiResults.length > 0) {
      // Merge unique by URL
      const seen = new Set<string>();
      const merged: SearchResultItem[] = [];
      for (const item of [...ddgHtmlResults, ...wikiResults]) {
        if (!seen.has(item.url)) {
          seen.add(item.url);
          merged.push({ ...item, id: merged.length + 1 });
        }
        if (merged.length >= maxSources) break;
      }
      if (merged.length > 0) return merged;
    }

    // 5. Last Resort Fallback: Instant Answer
    return await clientInstantAnswerSearch(cleanQuery);
  },
};

