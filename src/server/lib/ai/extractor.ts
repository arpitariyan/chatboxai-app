/**
 * src/server/lib/ai/extractor.ts
 *
 * Zero-dependency document text and tabular data extraction engine.
 * Supports Word (.docx, .doc), PowerPoint (.pptx, .ppt), Excel (.xlsx, .xls),
 * CSV, TSV, PDF text streams, Code, JSON, XML, and Plain Text.
 *
 * Uses built-in Node.js `zlib` for zip and flate decompression without any
 * external npm packages, ensuring 100% reliability in Vercel Serverless and Node CLI.
 */

import zlib from 'zlib';
import { logger } from '../logger';

export type FileModality = 'image' | 'pdf' | 'video' | 'audio' | 'document' | 'unsupported';

export interface ExtractedDocument {
  text: string;
  format: string;
  wordCount: number;
  metadata?: Record<string, any>;
}

/**
 * Classifies a file into its primary AI modality.
 */
export function getFileModality(mimeType = '', fileName = ''): FileModality {
  const mime = (mimeType || '').toLowerCase();
  const ext = (fileName.split('.').pop() || '').toLowerCase();

  // 1. Images
  if (
    mime.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'bmp', 'svg'].includes(ext)
  ) {
    return 'image';
  }

  // 2. PDF
  if (mime === 'application/pdf' || ext === 'pdf') {
    return 'pdf';
  }

  // 3. Video
  if (
    mime.startsWith('video/') ||
    ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', '3gp', 'm4v'].includes(ext)
  ) {
    return 'video';
  }

  // 4. Audio
  if (
    mime.startsWith('audio/') ||
    ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'wma', 'opus'].includes(ext)
  ) {
    return 'audio';
  }

  // 5. Documents & Data
  if (
    mime.includes('word') ||
    mime.includes('presentation') ||
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime.includes('powerpoint') ||
    mime.startsWith('text/') ||
    mime.includes('json') ||
    mime.includes('xml') ||
    mime.includes('csv') ||
    [
      'docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls', 'csv', 'tsv',
      'txt', 'md', 'markdown', 'json', 'xml', 'html', 'css', 'js',
      'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'cs', 'php',
      'rb', 'go', 'rs', 'sql', 'sh', 'yaml', 'yml', 'log', 'rtf',
    ].includes(ext)
  ) {
    return 'document';
  }

  // 6. Unsupported / Executables / Binary blobs
  return 'unsupported';
}

/**
 * Zero-dependency ZIP file reader for OpenXML packages (.docx, .pptx, .xlsx).
 * Parses Central Directory for robust file extraction.
 */
export function unzipEntries(buffer: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  if (!buffer || buffer.length < 22) return entries;

  // 1. Locate End of Central Directory (EOCD): 0x06054b50
  let eocdOffset = -1;
  const maxSearch = Math.min(buffer.length - 22, 65536 + 22);
  for (let i = buffer.length - 22; i >= buffer.length - maxSearch && i >= 0; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset !== -1) {
    const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
    const cdOffset = buffer.readUInt32LE(eocdOffset + 16);
    let pos = cdOffset;

    for (let i = 0; i < totalEntries && pos < eocdOffset; i++) {
      if (pos + 46 > buffer.length || buffer.readUInt32LE(pos) !== 0x02014b50) break;

      const method = buffer.readUInt16LE(pos + 10);
      const compSize = buffer.readUInt32LE(pos + 20);
      const nameLen = buffer.readUInt16LE(pos + 28);
      const extraLen = buffer.readUInt16LE(pos + 30);
      const commentLen = buffer.readUInt16LE(pos + 32);
      const localHeaderOffset = buffer.readUInt32LE(pos + 42);

      const name = buffer.toString('utf8', pos + 46, pos + 46 + nameLen);
      pos += 46 + nameLen + extraLen + commentLen;

      if (localHeaderOffset + 30 > buffer.length) continue;
      if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) continue;

      const localNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + localNameLen + localExtraLen;

      if (dataOffset + compSize > buffer.length) continue;
      const compData = buffer.subarray(dataOffset, dataOffset + compSize);

      let uncompData: Buffer | undefined;
      if (method === 0) {
        uncompData = compData;
      } else if (method === 8) {
        try {
          uncompData = zlib.inflateRawSync(compData);
        } catch {
          // Ignore corrupt entry
        }
      }

      if (uncompData) {
        entries.set(name, uncompData);
      }
    }

    if (entries.size > 0) return entries;
  }

  // 2. Fallback: Parse sequentially from local headers
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) break;
    const method = buffer.readUInt16LE(offset + 8);
    const compSize = buffer.readUInt32LE(offset + 18);
    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);
    const name = buffer.toString('utf8', offset + 30, offset + 30 + nameLen);
    const dataOffset = offset + 30 + nameLen + extraLen;

    if (dataOffset + compSize > buffer.length) break;
    const compData = buffer.subarray(dataOffset, dataOffset + compSize);

    let uncompData: Buffer | undefined;
    if (method === 0) uncompData = compData;
    else if (method === 8) {
      try {
        uncompData = zlib.inflateRawSync(compData);
      } catch {
        // Skip
      }
    }
    if (uncompData) entries.set(name, uncompData);
    offset = dataOffset + compSize;
  }

  return entries;
}

/**
 * Extracts plain text from DOCX Word XML body.
 */
export function extractDocxText(buffer: Buffer): ExtractedDocument {
  const entries = unzipEntries(buffer);
  const docXmlBuf = entries.get('word/document.xml');

  if (!docXmlBuf) {
    // If not a standard DOCX zip, try plain string extraction
    return extractAsciiStrings(buffer, 'Word Document (Binary/Legacy)');
  }

  const xml = docXmlBuf.toString('utf8');

  // Replace paragraph starts and breaks
  const formattedXml = xml
    .replace(/<w:p[ >]/g, '\n<w:p ')
    .replace(/<w:br\s*\/?>/g, '\n')
    .replace(/<w:tab\s*\/?>/g, '\t');

  const lines = formattedXml.split('\n');
  const paragraphs: string[] = [];

  for (const line of lines) {
    let pText = '';
    const regex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(line)) !== null) {
      pText += match[1];
    }
    const clean = pText.trim();
    if (clean) {
      paragraphs.push(clean);
    }
  }

  const text = paragraphs.join('\n\n');
  return {
    text: text || 'Document appears to be empty or contains only embedded images.',
    format: 'Microsoft Word Document (.docx)',
    wordCount: text.split(/\s+/).filter(Boolean).length,
    metadata: { paragraphCount: paragraphs.length },
  };
}

/**
 * Extracts slide-by-slide text from PowerPoint PPTX.
 */
export function extractPptxText(buffer: Buffer): ExtractedDocument {
  const entries = unzipEntries(buffer);
  const slideKeys: string[] = [];

  for (const key of entries.keys()) {
    if (/^ppt\/slides\/slide\d+\.xml$/i.test(key)) {
      slideKeys.push(key);
    }
  }

  // Sort slides numerically: slide1.xml, slide2.xml, slide10.xml
  slideKeys.sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });

  if (slideKeys.length === 0) {
    return extractAsciiStrings(buffer, 'PowerPoint Presentation (Binary/Legacy)');
  }

  const slideTexts: string[] = [];

  slideKeys.forEach((key, idx) => {
    const xml = entries.get(key)!.toString('utf8');
    const lines: string[] = [];

    // Extract text in <a:p> paragraphs and <a:t> text nodes
    const pMatches = xml.split(/<a:p[ >]/);
    for (const p of pMatches) {
      let runText = '';
      const tRegex = /<a:t>([\s\S]*?)<\/a:t>/g;
      let m: RegExpExecArray | null;
      while ((m = tRegex.exec(p)) !== null) {
        runText += m[1];
      }
      const trimmed = runText.trim();
      if (trimmed) lines.push(trimmed);
    }

    if (lines.length > 0) {
      slideTexts.push(`--- Slide ${idx + 1} ---\n${lines.join('\n')}`);
    } else {
      slideTexts.push(`--- Slide ${idx + 1} ---\n[Visual slide without text]`);
    }
  });

  const text = slideTexts.join('\n\n');
  return {
    text: text || 'Presentation contains no text.',
    format: 'Microsoft PowerPoint (.pptx)',
    wordCount: text.split(/\s+/).filter(Boolean).length,
    metadata: { slideCount: slideKeys.length },
  };
}

/**
 * Extracts tabular data and text from Excel XLSX.
 */
export function extractXlsxText(buffer: Buffer): ExtractedDocument {
  const entries = unzipEntries(buffer);

  // 1. Shared Strings Table
  const sharedStrings: string[] = [];
  const sstBuf = entries.get('xl/sharedStrings.xml');
  if (sstBuf) {
    const sstXml = sstBuf.toString('utf8');
    const siRegex = /<si>([\s\S]*?)<\/si>/g;
    let siMatch: RegExpExecArray | null;
    while ((siMatch = siRegex.exec(sstXml)) !== null) {
      let str = '';
      const tRegex = /<t[^>]*>([\s\S]*?)<\/t>/g;
      let tMatch: RegExpExecArray | null;
      while ((tMatch = tRegex.exec(siMatch[1])) !== null) {
        str += tMatch[1];
      }
      sharedStrings.push(str);
    }
  }

  // 2. Worksheets
  const sheetKeys = Array.from(entries.keys())
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k))
    .sort();

  if (sheetKeys.length === 0) {
    return extractAsciiStrings(buffer, 'Excel Spreadsheet (Binary/Legacy)');
  }

  const sheetOutputs: string[] = [];

  sheetKeys.slice(0, 3).forEach((key, sheetIdx) => {
    const xml = entries.get(key)!.toString('utf8');
    const rows: string[][] = [];

    const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/g;
    let rMatch: RegExpExecArray | null;
    while ((rMatch = rowRegex.exec(xml)) !== null && rows.length < 200) {
      const rowContent = rMatch[1];
      const cellRegex = /<c\s+r="([A-Z]+[0-9]+)"(?:\s+t="([a-z]+)")?[^>]*>(?:<v>([\s\S]*?)<\/v>)?/g;
      let cMatch: RegExpExecArray | null;
      const rowCells: string[] = [];

      while ((cMatch = cellRegex.exec(rowContent)) !== null) {
        const type = cMatch[2];
        const val = cMatch[3] || '';
        let cellText = val;

        if (type === 's') {
          const idx = parseInt(val, 10);
          cellText = sharedStrings[idx] ?? val;
        }

        rowCells.push(cellText.replace(/[\r\n\t]/g, ' ').trim());
      }

      if (rowCells.some((c) => c.length > 0)) {
        rows.push(rowCells);
      }
    }

    if (rows.length > 0) {
      let sheetMarkdown = `### Sheet ${sheetIdx + 1} (${rows.length} rows)\n`;
      // Render as Markdown table or CSV lines
      if (rows[0] && rows[0].length > 0) {
        const header = rows[0];
        sheetMarkdown += `| ${header.join(' | ')} |\n`;
        sheetMarkdown += `| ${header.map(() => '---').join(' | ')} |\n`;
        rows.slice(1, 50).forEach((r) => {
          sheetMarkdown += `| ${r.join(' | ')} |\n`;
        });
        if (rows.length > 50) {
          sheetMarkdown += `\n*... and ${rows.length - 50} more rows*\n`;
        }
      }
      sheetOutputs.push(sheetMarkdown);
    }
  });

  const text = sheetOutputs.join('\n\n');
  return {
    text: text || 'Spreadsheet contains no data.',
    format: 'Microsoft Excel Spreadsheet (.xlsx)',
    wordCount: text.split(/\s+/).filter(Boolean).length,
    metadata: { sheetsCount: sheetKeys.length },
  };
}

/**
 * Extracts tabular CSV data with clean header formatting.
 */
export function extractCsvText(buffer: Buffer): ExtractedDocument {
  const raw = buffer.toString('utf8');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { text: 'Empty CSV file', format: 'CSV', wordCount: 0 };
  }

  const headers = lines[0].split(',').map((h) => h.replace(/^["']|["']$/g, '').trim());
  const rows = lines.slice(1, Math.min(60, lines.length)).map((line) => {
    return line.split(',').map((c) => c.replace(/^["']|["']$/g, '').trim());
  });

  let markdown = `**CSV Dataset Overview (${lines.length - 1} records, ${headers.length} columns)**\n\n`;
  markdown += `| ${headers.join(' | ')} |\n`;
  markdown += `| ${headers.map(() => '---').join(' | ')} |\n`;

  for (const row of rows) {
    markdown += `| ${row.join(' | ')} |\n`;
  }

  if (lines.length > 60) {
    markdown += `\n*... and ${lines.length - 60} more rows.*\n`;
  }

  return {
    text: markdown,
    format: 'Comma-Separated Values (.csv)',
    wordCount: markdown.split(/\s+/).filter(Boolean).length,
    metadata: { rows: lines.length - 1, cols: headers.length },
  };
}

/**
 * Extracts text stream fragments from a PDF for text-based analysis or fallback.
 */
export function extractPdfTextStream(buffer: Buffer): ExtractedDocument {
  const raw = buffer.toString('binary');
  const textBlocks: string[] = [];

  // Match /Filter /FlateDecode streams
  const streamRegex = /<<[^>]*\/Filter\s*\/FlateDecode[^>]*>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(raw)) !== null && textBlocks.length < 150) {
    const streamBytes = Buffer.from(match[1], 'binary');
    try {
      const decompressed = zlib.inflateSync(streamBytes).toString('utf8');
      // Extract text operators (text) Tj or [(text)] TJ
      const tjRegex = /\(([\s\S]*?)\)\s*Tj/g;
      let tjMatch: RegExpExecArray | null;
      while ((tjMatch = tjRegex.exec(decompressed)) !== null) {
        const cleaned = tjMatch[1].replace(/\\[nrtbf\\()]/g, ' ').trim();
        if (cleaned.length > 1) textBlocks.push(cleaned);
      }
    } catch {
      // Continue to next stream
    }
  }

  if (textBlocks.length > 0) {
    const text = textBlocks.join(' ');
    return {
      text,
      format: 'Adobe PDF Document (.pdf)',
      wordCount: text.split(/\s+/).filter(Boolean).length,
      metadata: { extractedFragments: textBlocks.length },
    };
  }

  // Fallback: extract printable ASCII strings
  return extractAsciiStrings(buffer, 'Adobe PDF (Native / Scanned)');
}

/**
 * Fallback extractor for binary files: extracts runs of printable UTF-8/ASCII characters.
 */
function extractAsciiStrings(buffer: Buffer, formatLabel: string): ExtractedDocument {
  const str = buffer.toString('utf8');
  // Match runs of 4 or more printable characters
  const matches = str.match(/[\x20-\x7E\xA0-\xFF]{4,}/g) || [];
  const text = matches.filter((m) => !/^[0-9a-f]{16,}$/i.test(m)).join(' ');

  return {
    text: text.slice(0, 15000) || `[${formatLabel}: Content is binary or image-based]`,
    format: formatLabel,
    wordCount: text.split(/\s+/).filter(Boolean).length,
  };
}

/**
 * Universal document extraction dispatcher.
 */
export async function extractDocumentContent(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ExtractedDocument> {
  const cleanMime = (mimeType || '').toLowerCase();
  const ext = (fileName.split('.').pop() || '').toLowerCase();

  logger.info('Extracting content from document:', { fileName, mimeType, ext });

  // 1. Word DOCX
  if (
    ext === 'docx' ||
    cleanMime.includes('wordprocessingml') ||
    cleanMime === 'application/msword'
  ) {
    return extractDocxText(buffer);
  }

  // 2. PowerPoint PPTX
  if (
    ext === 'pptx' ||
    cleanMime.includes('presentationml') ||
    cleanMime === 'application/vnd.ms-powerpoint'
  ) {
    return extractPptxText(buffer);
  }

  // 3. Excel XLSX
  if (
    ext === 'xlsx' ||
    cleanMime.includes('spreadsheetml') ||
    cleanMime === 'application/vnd.ms-excel'
  ) {
    return extractXlsxText(buffer);
  }

  // 4. CSV / TSV
  if (ext === 'csv' || ext === 'tsv' || cleanMime.includes('csv')) {
    return extractCsvText(buffer);
  }

  // 5. PDF text extraction
  if (ext === 'pdf' || cleanMime === 'application/pdf') {
    return extractPdfTextStream(buffer);
  }

  // 6. Plain Text / Code / JSON / XML / Markdown
  try {
    const text = buffer.toString('utf8');
    return {
      text,
      format: ext ? `Text Document (.${ext})` : 'Plain Text Document',
      wordCount: text.split(/\s+/).filter(Boolean).length,
    };
  } catch {
    return extractAsciiStrings(buffer, 'Text/Data Document');
  }
}
