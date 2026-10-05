/**
 * SvglIcon — Domain-to-SVG brand icon mapper
 *
 * Strategy (priority order):
 *  1. Static inline SVG map — ~25 most common domains, zero network latency
 *  2. SVGL API (https://api.svgl.app) — dynamic lookup with in-memory cache
 *  3. Globe fallback — for unknown domains with no SVGL match
 *
 * react-native-svg is already installed (v15.15.5).
 * SvgUri from react-native-svg is used to render API-fetched SVGs.
 */
import React, { useState, useEffect } from 'react';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';
import { SvgUri } from 'react-native-svg';

// ── Types ────────────────────────────────────────────────────────────────────
interface SvglIconProps {
  domain: string;
  size?: number;
  color?: string;
}

type IconRenderer = (size: number, color: string) => React.ReactElement;

interface SvglApiSVG {
  id: number;
  title: string;
  category: string | string[];
  route: string | { light: string; dark: string };
  url: string;
}

// ── In-memory cache: domain → SVG URL or null (null = no icon) ───────────────
const API_CACHE = new Map<string, string | null>();
const PENDING = new Set<string>();

// ── Domain root → better SVGL search term ───────────────────────────────────
const SEARCH_OVERRIDES: Record<string, string> = {
  stackoverflow: 'stack overflow',
  typescriptlang: 'typescript',
  reactnative: 'react',
  mozilla: 'firefox',
  huggingface: 'hugging face',
  geeksforgeeks: 'geeksforgeeks',
  freecodecamp: 'freecodecamp',
  codesandbox: 'codesandbox',
  codepen: 'codepen',
  hashnode: 'hashnode',
  openai: 'openai',
  anthropic: 'anthropic',
  perplexity: 'perplexity',
  cloudflare: 'cloudflare',
  digitalocean: 'digitalocean',
  figma: 'figma',
  notion: 'notion',
  stripe: 'stripe',
  shopify: 'shopify',
  mongodb: 'mongodb',
  postgresql: 'postgresql',
  supabase: 'supabase',
  firebase: 'firebase',
  prisma: 'prisma',
  docker: 'docker',
  kubernetes: 'kubernetes',
  netlify: 'netlify',
  railway: 'railway',
  angular: 'angular',
  svelte: 'svelte',
  nuxt: 'nuxt',
  astro: 'astro',
  vite: 'vite',
  twitch: 'twitch',
  spotify: 'spotify',
  discord: 'discord',
  slack: 'slack',
  replit: 'replit',
  leetcode: 'leetcode',
  hackerrank: 'hackerrank',
  gitlab: 'gitlab',
};

// ── SVGL API fetch ────────────────────────────────────────────────────────────
async function fetchSvglIcon(domain: string): Promise<string | null> {
  const root = domain.replace(/^www\./, '').split('.')[0];
  const searchTerm = SEARCH_OVERRIDES[root] || root;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(
      `https://api.svgl.app?search=${encodeURIComponent(searchTerm)}&limit=8`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (!res.ok) return null;

    const results: SvglApiSVG[] = await res.json();
    if (!results.length) return null;

    // Prefer an entry whose brand URL contains our domain
    const normalised = domain.replace(/^www\./, '');
    const best =
      results.find((r) => {
        try {
          const brandHost = new URL(r.url).hostname.replace(/^www\./, '');
          return brandHost === normalised || brandHost.endsWith(`.${normalised}`) || normalised.endsWith(`.${brandHost}`);
        } catch {
          return false;
        }
      }) || results[0];

    const route = best.route;
    // Prefer dark variant for dark-mode apps
    if (typeof route === 'string') return route;
    return route.dark || route.light;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export const getDomainFromUrl = (rawUrl: string): string => {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, '');
  } catch {
    return rawUrl;
  }
};

// ── Globe fallback ────────────────────────────────────────────────────────────
const GlobeIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5" />
    <Path
      d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </Svg>
);

// ── Static inline icon map ────────────────────────────────────────────────────
// Only perfectly tested, reliable paths live here.
// Everything else falls back to SVGL API.
const ICON_MAP: Record<string, IconRenderer> = {
  // ── GitHub ──────────────────────────────────────────────────────────────────
  'github.com': (s) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"
        fill="#ffffff"
      />
    </Svg>
  ),

  // ── Google ───────────────────────────────────────────────────────────────────
  'google.com': (s) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  ),

  // ── YouTube ──────────────────────────────────────────────────────────────────
  'youtube.com': (s) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#FF0000" />
    </Svg>
  ),

  // ── Twitter / X ──────────────────────────────────────────────────────────────
  'twitter.com': (s, c) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.26 5.632 5.905-5.632zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" fill={c} />
    </Svg>
  ),
  'x.com': (s, c) => ICON_MAP['twitter.com'](s, c),

  // ── Reddit ───────────────────────────────────────────────────────────────────
  'reddit.com': (s) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="12" fill="#FF4500" />
      <Path d="M20 12a1.96 1.96 0 0 0-3.26-1.47 9.64 9.64 0 0 0-5.18-1.64l.88-4.14 2.87.61a1.38 1.38 0 1 0 .14-.66l-3.2-.68-.98 4.62a9.64 9.64 0 0 0-5.1 1.63A1.96 1.96 0 1 0 4.4 13.8a3.5 3.5 0 0 0-.04.5c0 2.56 2.98 4.64 6.64 4.64s6.64-2.08 6.64-4.64a3.5 3.5 0 0 0-.04-.5 1.96 1.96 0 0 0 2.4-1.8zM8.5 13a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm7 2.75c-.63.63-1.64.94-3 .94s-2.37-.31-3-.94a.34.34 0 0 1 .48-.48c.49.49 1.35.73 2.52.73s2.03-.24 2.52-.73a.34.34 0 0 1 .48.48zm-.5-1.75a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" fill="white" />
    </Svg>
  ),

  // ── Stack Overflow ────────────────────────────────────────────────────────────
  'stackoverflow.com': (s) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path d="M18.986 21.865v-6.404h2.134V24H1.844v-8.539h2.13v6.404h15.012z" fill="#BCBBBB" />
      <Path d="M6.036 20.095l8.562 1.855.437-2.054-8.561-1.807zM7.517 15.479l7.975 3.792.908-1.951-7.975-3.792zm2.883-4.952l6.617 5.547 1.346-1.64-6.617-5.547zm5.205-4.455L13.96 7.775l5.027 6.72 1.645-1.209zM6.032 22.189h8.728v-2.137H6.032v2.137z" fill="#F48024" />
    </Svg>
  ),

  // ── LinkedIn ──────────────────────────────────────────────────────────────────
  'linkedin.com': (s) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" fill="#0A66C2" />
    </Svg>
  ),

  // ── Medium ────────────────────────────────────────────────────────────────────
  'medium.com': (s, c) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path d="M13.54 12a6.8 6.8 0 0 1-6.77 6.82A6.8 6.8 0 0 1 0 12a6.8 6.8 0 0 1 6.77-6.82A6.8 6.8 0 0 1 13.54 12zm7.42 0c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z" fill={c} />
    </Svg>
  ),

  // ── npm ───────────────────────────────────────────────────────────────────────
  'npmjs.com': (s) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Rect width="24" height="24" rx="2" fill="#CB3837" />
      <Path d="M4 4h16v12H12V8H8v8H4V4z" fill="white" />
      <Rect x="14" y="8" width="2" height="4" fill="#CB3837" />
    </Svg>
  ),

  // ── Wikipedia ─────────────────────────────────────────────────────────────────
  'wikipedia.org': (s, c) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path d="M3.01 4.5H5.5l3.109 6.312 1.605-3.124L7.894 4.5H10.5l3.5 7.5 1.5-3.25L13.5 4.5H16l3 7-1.5 3.25L21 19.5h-2.5l-2.5-5.5-1.5 3.25 1.5 3.25H13.5l-1.5-3.25-1.5 3.25H8l1.5-3.25L8 10.5 6 14l-1.5 3-2-1 3.01-11z" fill={c} />
    </Svg>
  ),

  // ── Expo ─────────────────────────────────────────────────────────────────────
  'expo.dev': (s, c) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path d="M0 21.688a1.188 1.188 0 0 0 2.057.808l9.943-10.97 9.943 10.97a1.188 1.188 0 0 0 2.057-.808V2.312a1.188 1.188 0 0 0-2.057-.808L12 12.474 2.057 1.504A1.188 1.188 0 0 0 0 2.312v19.376z" fill={c} />
    </Svg>
  ),

  // ── React / React Native ──────────────────────────────────────────────────────
  'reactnative.dev': (s) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="2.05" fill="#61DAFB" />
      <Path d="M12 4.5c4.418 0 8 3.358 8 7.5s-3.582 7.5-8 7.5S4 16.142 4 12s3.582-7.5 8-7.5z" stroke="#61DAFB" strokeWidth="1.2" fill="none" />
      <Path d="M12 4.5c2.761 4.3 2.761 15 0 15" stroke="#61DAFB" strokeWidth="1.2" fill="none" />
      <Path d="M4 12h16" stroke="#61DAFB" strokeWidth="1.2" />
      <Path d="M5.5 7.5C9.8 9.761 18.5 9.761 18.5 12s-8.7 2.239-13 4.5" stroke="#61DAFB" strokeWidth="1.2" fill="none" />
      <Path d="M5.5 16.5C9.8 14.239 18.5 14.239 18.5 12S9.8 9.761 5.5 7.5" stroke="#61DAFB" strokeWidth="1.2" fill="none" />
    </Svg>
  ),
  'react.dev': (s, c) => ICON_MAP['reactnative.dev'](s, c),

  // ── Vercel ────────────────────────────────────────────────────────────────────
  'vercel.com': (s, c) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path d="M24 22.525H0l12-21.05 12 21.05z" fill={c} />
    </Svg>
  ),

  // ── Next.js ───────────────────────────────────────────────────────────────────
  'nextjs.org': (s, c) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="12" fill={c} />
      <Path d="M19.07 20.628L8.16 7H7v10h1.96v-7.386l10.01 12.68A12.04 12.04 0 0 1 12 24C5.373 24 0 18.627 0 12S5.373 0 12 0s12 5.373 12 12a11.97 11.97 0 0 1-.93 4.628z" fill={c === '#ffffff' ? '#18181b' : '#ffffff'} />
      <Rect x="14" y="7" width="2" height="10" fill={c === '#ffffff' ? '#18181b' : '#ffffff'} />
    </Svg>
  ),

  // ── Tailwind CSS ──────────────────────────────────────────────────────────────
  'tailwindcss.com': (s) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path d="M12.001 4.8c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.913.228 1.565.89 2.288 1.624C13.666 10.618 15.027 12 18.001 12c3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.913-.228-1.565-.89-2.288-1.624C16.337 6.182 14.976 4.8 12.001 4.8zm-6 7.2c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.913.228 1.565.89 2.288 1.624 1.177 1.194 2.538 2.576 5.512 2.576 3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.913-.228-1.565-.89-2.288-1.624C10.337 13.382 8.976 12 6.001 12z" fill="#38BDF8" />
    </Svg>
  ),

  // ── Discord ───────────────────────────────────────────────────────────────────
  'discord.com': (s) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.01.022.02.043.032.054a19.875 19.875 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
        fill="#5865F2"
      />
    </Svg>
  ),

  // ── Telegram ──────────────────────────────────────────────────────────────────
  'telegram.org': (s) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path
        d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"
        fill="#2AABEE"
      />
    </Svg>
  ),
  't.me': (s, c) => ICON_MAP['telegram.org'](s, c),

  // ── Instagram ─────────────────────────────────────────────────────────────────
  'instagram.com': (s) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"
        fill="#E1306C"
      />
    </Svg>
  ),

  // ── Facebook ──────────────────────────────────────────────────────────────────
  'facebook.com': (s) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
        fill="#1877F2"
      />
    </Svg>
  ),

  // ── Vue.js ────────────────────────────────────────────────────────────────────
  'vuejs.org': (s) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path d="M2 3h3.5L12 15 18.5 3H22L12 21 2 3z" fill="#42B883" />
      <Path d="M6 3h4l2 3.5L14 3h4l-6 10.5L6 3z" fill="#35495E" />
    </Svg>
  ),
  'vue.org': (s, c) => ICON_MAP['vuejs.org'](s, c),

  // ── TypeScript ────────────────────────────────────────────────────────────────
  'typescriptlang.org': (s) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Rect width="24" height="24" rx="3" fill="#3178C6" />
      <Path
        d="M11.5 11H9v-1.5h7V11h-2.5v7H11.5v-7zM17 16.5v1.25c.33.2.73.3 1.2.3.3 0 .58-.05.82-.14.25-.1.45-.23.62-.4.17-.18.3-.4.38-.64.09-.25.13-.53.13-.83 0-.35-.06-.65-.17-.9-.1-.26-.26-.48-.46-.67-.2-.19-.43-.35-.7-.48l-.85-.38c-.23-.1-.4-.2-.52-.3a.82.82 0 0 1-.27-.3.83.83 0 0 1-.07-.37c0-.12.02-.23.07-.33a.74.74 0 0 1 .19-.25c.08-.07.18-.12.3-.16.12-.04.25-.06.4-.06.28 0 .53.07.76.21v-1.2c-.22-.1-.5-.15-.84-.15-.28 0-.54.05-.78.14-.24.1-.45.23-.62.4-.18.17-.32.38-.42.63-.1.25-.15.53-.15.83 0 .37.07.69.2.94.14.25.33.47.58.65.25.18.54.34.88.48l.6.25c.22.1.38.2.5.31.12.11.2.23.24.36.04.13.06.28.06.44 0 .14-.03.26-.08.37z"
        fill="white"
      />
    </Svg>
  ),

  // ── Dev.to ────────────────────────────────────────────────────────────────────
  'dev.to': (s, c) => (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Rect width="24" height="24" rx="3" fill={c} />
      <Path
        d="M7.42 10.05c-.18-.16-.46-.23-.84-.23H6l.02 2.44.04 2.45.56-.02c.41 0 .63-.07.83-.26.24-.24.26-.36.26-2.2 0-1.91-.02-1.96-.29-2.18zM0 4.94v14.12h24V4.94H0zM8.56 15.3c-.44.58-1.06.77-2.53.77H4.71V8.53h1.4c1.67 0 2.16.18 2.6.9.27.43.29.6.32 2.57.05 2.23-.02 2.73-.47 3.3zm5.09-5.47h-2.47v1.77h1.52v1.28l-.72.04-.75.03v1.77l1.22.03 1.2.04v1.28h-1.6c-1.53 0-1.6-.01-1.87-.3l-.3-.28v-3.16c0-3.02.01-3.18.25-3.48.23-.31.25-.31 1.88-.31h1.64v1.29zm4.68 5.45c-.17.43-.64.79-1 .79-.18 0-.45-.15-.67-.39-.32-.32-.45-.63-.82-2.08l-.9-3.39-.45-1.67h.76c.4 0 .75.02.75.05 0 .06 1.16 4.54 1.26 4.83.04.15.32-.7.73-2.3l.66-2.52.74-.04c.4-.02.73 0 .73.04 0 .14-1.67 6.38-1.8 6.68z"
        fill={c === '#ffffff' ? '#18181b' : '#ffffff'}
      />
    </Svg>
  ),
};

// ── Static map resolver ──────────────────────────────────────────────────────
const resolveStaticIcon = (domain: string): IconRenderer | null => {
  const lower = domain.toLowerCase().replace(/^www\./, '');
  if (ICON_MAP[lower]) return ICON_MAP[lower];

  // Suffix match: "docs.github.com" → "github.com"
  for (const key of Object.keys(ICON_MAP)) {
    if (lower.endsWith(`.${key}`)) return ICON_MAP[key];
  }

  // Root match: "api.discord.gg" → match "discord" root
  for (const key of Object.keys(ICON_MAP)) {
    const root = key.split('.')[0];
    if (lower.startsWith(`${root}.`) || lower === root) return ICON_MAP[key];
  }

  return null;
};

// ── SvglIcon component ────────────────────────────────────────────────────────
export const SvglIcon: React.FC<SvglIconProps> = ({
  domain,
  size = 16,
  color = '#9a9da3',
}) => {
  const normalised = domain.toLowerCase().replace(/^www\./, '');
  const staticRenderer = resolveStaticIcon(normalised);

  const [apiUri, setApiUri] = useState<string | null>(
    API_CACHE.has(normalised) ? (API_CACHE.get(normalised) ?? null) : null
  );
  const [apiError, setApiError] = useState(false);

  useEffect(() => {
    if (staticRenderer) return;
    if (API_CACHE.has(normalised)) return;
    if (PENDING.has(normalised)) return;

    PENDING.add(normalised);
    let cancelled = false;

    fetchSvglIcon(normalised).then((uri) => {
      PENDING.delete(normalised);
      API_CACHE.set(normalised, uri);
      if (!cancelled) setApiUri(uri);
    });

    return () => {
      cancelled = true;
    };
  }, [normalised, staticRenderer]);

  // 1. Instant static icon
  if (staticRenderer) {
    return staticRenderer(size, color) as React.ReactElement;
  }

  // 2. API-fetched icon via SvgUri
  if (apiUri && !apiError) {
    return (
      <SvgUri
        width={size}
        height={size}
        uri={apiUri}
        onError={() => setApiError(true)}
      />
    );
  }

  // 3. Globe fallback
  return <GlobeIcon size={size} color={color} />;
};
