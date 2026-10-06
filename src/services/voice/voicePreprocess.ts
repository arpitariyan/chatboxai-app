/**
 * src/services/voice/voicePreprocess.ts
 *
 * Lightweight TTS Natural Language Preprocessing Layer for mobile client.
 * Adapts website lib/voice/preprocess.ts.
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const ORDINAL_SUFFIXES: Record<number, string> = {
  1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth',
  6: 'sixth', 7: 'seventh', 8: 'eighth', 9: 'ninth', 10: 'tenth',
  11: 'eleventh', 12: 'twelfth', 13: 'thirteenth', 14: 'fourteenth', 15: 'fifteenth',
  16: 'sixteenth', 17: 'seventeenth', 18: 'eighteenth', 19: 'nineteenth', 20: 'twentieth',
  21: 'twenty-first', 22: 'twenty-second', 23: 'twenty-third', 24: 'twenty-fourth',
  25: 'twenty-fifth', 26: 'twenty-sixth', 27: 'twenty-seventh', 28: 'twenty-eighth',
  29: 'twenty-ninth', 30: 'thirtieth', 31: 'thirty-first'
};

export function stripMarkdownAndMarkup(text: string): string {
  if (!text) return '';

  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\[\d+\]|\[citation\]/gi, '')
    .replace(/^#+\s+/gm, '')
    .replace(/(\*\*|__|\*|_)/g, '')
    .replace(/^[\*\-\+]\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/\n+/g, ' ')
    .trim();
}

export function normalizeDates(text: string): string {
  return text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_, year, month, day) => {
    const mIdx = parseInt(month, 10) - 1;
    const dNum = parseInt(day, 10);
    const monthStr = MONTH_NAMES[mIdx] || month;
    const dayStr = ORDINAL_SUFFIXES[dNum] || `${dNum}th`;
    return `${monthStr} ${dayStr}, ${year}`;
  });
}

export function normalizeCurrencies(text: string): string {
  return text
    .replace(/₹\s?([\d,]+(\.\d+)?)/g, '$1 rupees')
    .replace(/\$\s?([\d,]+(\.\d+)?)/g, '$1 dollars')
    .replace(/€\s?([\d,]+(\.\d+)?)/g, '$1 euros')
    .replace(/£\s?([\d,]+(\.\d+)?)/g, '$1 pounds');
}

export function normalizePhoneNumbers(text: string): string {
  return text.replace(/(\+\d{1,3})\s?(\d{5})\s?(\d{5})/g, (_, countryCode, part1, part2) => {
    const formattedCountry = countryCode.replace('+', 'plus ');
    const spacedPart1 = part1.split('').join(' ');
    const spacedPart2 = part2.split('').join(' ');
    return `${formattedCountry}, ${spacedPart1}, ${spacedPart2}`;
  });
}

export function preprocessTextForTTS(rawText: string, maxLength = 500): string {
  if (!rawText || !rawText.trim()) return '';

  let cleaned = stripMarkdownAndMarkup(rawText);
  cleaned = normalizeDates(cleaned);
  cleaned = normalizeCurrencies(cleaned);
  cleaned = normalizePhoneNumbers(cleaned);
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  if (cleaned.length > maxLength) {
    const truncated = cleaned.slice(0, maxLength);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('?'),
      truncated.lastIndexOf('!')
    );

    if (lastSentenceEnd > 50) {
      cleaned = truncated.slice(0, lastSentenceEnd + 1);
    } else {
      cleaned = truncated.trim() + '.';
    }
  }

  return cleaned;
}
