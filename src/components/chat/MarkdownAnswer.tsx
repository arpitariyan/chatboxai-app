import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Linking,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { IconCopy, IconCheck, IconExternalLink, IconWorld } from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius } from '@/theme';

interface MarkdownAnswerProps {
  content: string;
}

// Language display map from DisplaySummery.jsx
const LANG_NAMES: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  jsx: 'JSX',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  tsx: 'TSX',
  py: 'Python',
  python: 'Python',
  rb: 'Ruby',
  rs: 'Rust',
  rust: 'Rust',
  go: 'Go',
  golang: 'Go',
  java: 'Java',
  cs: 'C#',
  csharp: 'C#',
  cpp: 'C++',
  c: 'C',
  php: 'PHP',
  swift: 'Swift',
  kt: 'Kotlin',
  scala: 'Scala',
  sh: 'Shell',
  bash: 'Bash',
  zsh: 'Zsh',
  sql: 'SQL',
  graphql: 'GraphQL',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
  xml: 'XML',
  md: 'Markdown',
  dockerfile: 'Dockerfile',
  docker: 'Docker',
  text: 'Plain Text',
  txt: 'Plain Text',
};

const getLangLabel = (lang: string): string =>
  LANG_NAMES[lang?.toLowerCase()] ?? (lang ? lang.toUpperCase() : 'CODE');

// ── Code Block Component with Line Numbers & Copy matching DisplaySummery.jsx ──
const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);
  const langKey = (language || '').toLowerCase().trim();
  const displayLang = getLangLabel(langKey);

  const lines = useMemo(() => code.split('\n'), [code]);

  const handleCopy = async () => {
    if (copied) return;
    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Copy code failed:', err);
    }
  };

  return (
    <View style={styles.codePanel}>
      {/* Code Header Bar */}
      <View style={styles.codeHeader}>
        <Text style={styles.codeLangText}>{displayLang}</Text>
        <Pressable
          onPress={handleCopy}
          hitSlop={8}
          accessibilityLabel={copied ? 'Code copied to clipboard' : 'Copy code'}
          style={({ pressed }) => [
            styles.codeCopyBtn,
            { opacity: pressed ? 0.75 : 1 },
          ]}
        >
          {copied ? (
            <>
              <IconCheck size={13} color="#4ade80" />
              <Text style={[styles.codeCopyText, { color: '#4ade80' }]}>Copied</Text>
            </>
          ) : (
            <>
              <IconCopy size={13} color="rgba(255,255,255,0.45)" />
              <Text style={styles.codeCopyText}>Copy</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Code Body with Line Numbers & Horizontal Scrolling */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={true}
        contentContainerStyle={styles.codeBodyContainer}
      >
        <View style={styles.codeContentRow}>
          {/* Line Numbers Column */}
          <View style={styles.lineNumbersCol} pointerEvents="none">
            {lines.map((_, idx) => (
              <Text key={`line-num-${idx}`} style={styles.lineNumberText}>
                {idx + 1}
              </Text>
            ))}
          </View>

          {/* Code Text Lines */}
          <View style={styles.codeLinesCol}>
            {lines.map((line, idx) => (
              <Text key={`code-line-${idx}`} style={styles.codeLineText} selectable>
                {line.length === 0 ? ' ' : line}
              </Text>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

// ── Markdown Table Component matching the web version ──
const TableBlock: React.FC<{ headers: string[]; rows: string[][] }> = ({ headers, rows }) => {
  const colors = useThemeColors();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={true}
      style={[styles.tableContainer, { borderColor: colors.line }]}
    >
      <View>
        {/* Header Row */}
        {headers.length > 0 && (
          <View style={[styles.tableRow, styles.tableHeaderRow, { backgroundColor: colors.surface, borderBottomColor: colors.line }]}>
            {headers.map((h, i) => (
              <View key={`th-${i}`} style={[styles.tableCell, { borderRightColor: colors.line }]}>
                <Text style={[styles.tableHeaderText, { color: colors.ink3 }]}>{h.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Data Rows */}
        {rows.map((row, rIdx) => (
          <View
            key={`tr-${rIdx}`}
            style={[
              styles.tableRow,
              {
                backgroundColor: rIdx % 2 === 1 ? colors.surface : 'transparent',
                borderBottomColor: colors.line,
              },
            ]}
          >
            {row.map((cell, cIdx) => (
              <View key={`td-${rIdx}-${cIdx}`} style={[styles.tableCell, { borderRightColor: colors.line }]}>
                <Text style={[styles.tableCellText, { color: colors.ink }]}>{cell}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

// ── Inline Text Formatter (Bold, Italic, Code, Link, Smart URL) ──
interface InlineToken {
  type: 'text' | 'bold' | 'italic' | 'code' | 'link' | 'raw_url';
  text: string;
  url?: string;
}

const parseInlineMarkdown = (text: string): InlineToken[] => {
  if (!text) return [];

  const tokens: InlineToken[] = [];
  // Matches: **bold**, *italic*, `code`, [link](url), raw https?:// url
  const regex = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(https?:\/\/[^\s<>()]+)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: 'text',
        text: text.substring(lastIndex, match.index),
      });
    }

    if (match[1]) {
      // **bold**
      tokens.push({ type: 'bold', text: match[2] });
    } else if (match[3]) {
      // *italic*
      tokens.push({ type: 'italic', text: match[4] });
    } else if (match[5]) {
      // `code`
      tokens.push({ type: 'code', text: match[6] });
    } else if (match[7]) {
      // [link](url)
      tokens.push({ type: 'link', text: match[8], url: match[9] });
    } else if (match[10]) {
      // raw url
      tokens.push({ type: 'raw_url', text: match[10], url: match[10] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push({
      type: 'text',
      text: text.substring(lastIndex),
    });
  }

  return tokens;
};

const getCleanDomain = (rawUrl: string): string => {
  try {
    const u = new URL(rawUrl);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return rawUrl;
  }
};

const renderInline = (text: string, colors: any, baseStyle?: any) => {
  const tokens = parseInlineMarkdown(text);

  return tokens.map((token, idx) => {
    switch (token.type) {
      case 'bold':
        return (
          <Text key={`b-${idx}`} style={[baseStyle, { fontWeight: '700', color: colors.ink }]}>
            {token.text}
          </Text>
        );
      case 'italic':
        return (
          <Text key={`i-${idx}`} style={[baseStyle, { fontStyle: 'italic', color: colors.ink2 }]}>
            {token.text}
          </Text>
        );
      case 'code':
        return (
          <Text
            key={`c-${idx}`}
            style={[
              baseStyle,
              styles.inlineCode,
              {
                backgroundColor: colors.surface,
                color: colors.ink,
                borderColor: colors.line,
              },
            ]}
          >
            {` ${token.text} `}
          </Text>
        );
      case 'raw_url': {
        const domain = getCleanDomain(token.url || token.text);
        return (
          <Text
            key={`u-${idx}`}
            onPress={() => token.url && Linking.openURL(token.url)}
            style={[
              baseStyle,
              {
                color: colors.accent,
                textDecorationLine: 'underline',
              },
            ]}
          >
            {domain}
          </Text>
        );
      }
      case 'link':
        return (
          <Text
            key={`l-${idx}`}
            onPress={() => token.url && Linking.openURL(token.url)}
            style={[
              baseStyle,
              {
                color: colors.accent,
                textDecorationLine: 'underline',
              },
            ]}
          >
            {token.text}
          </Text>
        );
      default:
        return (
          <Text key={`t-${idx}`} style={baseStyle}>
            {token.text}
          </Text>
        );
    }
  });
};

export const MarkdownAnswer: React.FC<MarkdownAnswerProps> = ({ content }) => {
  const colors = useThemeColors();

  // 1. Clean content: Strip <think>...</think>, <tool_call>...</tool_call>, and canva design blocks
  const cleanText = useMemo(() => {
    if (!content) return '';
    let text = content;
    // Strip completed think blocks
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
    // Strip open think blocks (in case stream stopped)
    text = text.replace(/<think>[\s\S]*$/gi, '');
    // Strip tool call markers
    text = text.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '');
    // Strip canva design markers
    text = text.replace(/<!--CANVA_DESIGN:[\s\S]*?-->/gi, '');
    return text.trim();
  }, [content]);

  // 2. Parse text into structured blocks with proper paragraph bundling
  const blocks = useMemo(() => {
    if (!cleanText) return [];

    const lines = cleanText.split('\n');
    const result: Array<{
      type: 'heading' | 'code' | 'table' | 'blockquote' | 'bullet' | 'number' | 'hr' | 'paragraph';
      level?: number;
      language?: string;
      code?: string;
      headers?: string[];
      rows?: string[][];
      text?: string;
      prefix?: string;
    }> = [];

    let inCodeBlock = false;
    let codeLanguage = '';
    let codeBuffer: string[] = [];

    let inTable = false;
    let tableHeaders: string[] = [];
    let tableRows: string[][] = [];

    let paragraphBuffer: string[] = [];

    const flushParagraph = () => {
      if (paragraphBuffer.length > 0) {
        result.push({
          type: 'paragraph',
          text: paragraphBuffer.join(' '),
        });
        paragraphBuffer = [];
      }
    };

    const flushTable = () => {
      if (inTable && tableHeaders.length > 0) {
        result.push({
          type: 'table',
          headers: tableHeaders,
          rows: tableRows,
        });
        inTable = false;
        tableHeaders = [];
        tableRows = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Handle Code Block start/end
      if (trimmed.startsWith('```')) {
        flushParagraph();
        flushTable();

        if (inCodeBlock) {
          result.push({
            type: 'code',
            language: codeLanguage,
            code: codeBuffer.join('\n'),
          });
          codeBuffer = [];
          codeLanguage = '';
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
          codeLanguage = trimmed.slice(3).trim();
          codeBuffer = [];
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        continue;
      }

      // Handle Table Row
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        flushParagraph();
        const cells = trimmed
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());

        // Check if this is divider row (|---|---|)
        const isDivider = cells.every((c) => /^:?-+:?$/.test(c));

        if (isDivider) {
          continue; // skip separator row
        }

        if (!inTable) {
          inTable = true;
          tableHeaders = cells;
          tableRows = [];
        } else {
          tableRows.push(cells);
        }
        continue;
      } else if (inTable) {
        flushTable();
      }

      // Blank line: flushes current paragraph
      if (trimmed.length === 0) {
        flushParagraph();
        continue;
      }

      // Horizontal Rule
      if (/^(\*\*\*|---|___)$/.test(trimmed)) {
        flushParagraph();
        result.push({ type: 'hr' });
        continue;
      }

      // Headings
      if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
        flushParagraph();
        result.push({ type: 'heading', level: 1, text: trimmed.slice(2).trim() });
        continue;
      }
      if (trimmed.startsWith('## ') && !trimmed.startsWith('### ')) {
        flushParagraph();
        result.push({ type: 'heading', level: 2, text: trimmed.slice(3).trim() });
        continue;
      }
      if (trimmed.startsWith('### ') && !trimmed.startsWith('#### ')) {
        flushParagraph();
        result.push({ type: 'heading', level: 3, text: trimmed.slice(4).trim() });
        continue;
      }
      if (trimmed.startsWith('#### ')) {
        flushParagraph();
        result.push({ type: 'heading', level: 4, text: trimmed.slice(5).trim() });
        continue;
      }

      // Blockquotes
      if (trimmed.startsWith('> ') || trimmed === '>') {
        flushParagraph();
        result.push({ type: 'blockquote', text: trimmed.replace(/^>\s?/, '') });
        continue;
      }

      // Bullet List (- or *)
      const bulletMatch = line.match(/^(\s*)([-*+])\s+(.+)$/);
      if (bulletMatch) {
        flushParagraph();
        const indent = Math.min(Math.floor(bulletMatch[1].length / 2), 3);
        result.push({
          type: 'bullet',
          level: indent,
          text: bulletMatch[3],
        });
        continue;
      }

      // Numbered List (1. 2.)
      const numMatch = line.match(/^(\s*)(\d+\.)\s+(.+)$/);
      if (numMatch) {
        flushParagraph();
        const indent = Math.min(Math.floor(numMatch[1].length / 2), 3);
        result.push({
          type: 'number',
          level: indent,
          prefix: numMatch[2],
          text: numMatch[3],
        });
        continue;
      }

      // Regular Paragraph line: buffer into current paragraph
      paragraphBuffer.push(trimmed);
    }

    // Flush any unclosed blocks
    flushParagraph();
    flushTable();

    if (inCodeBlock && codeBuffer.length > 0) {
      result.push({
        type: 'code',
        language: codeLanguage,
        code: codeBuffer.join('\n'),
      });
    }

    return result;
  }, [cleanText]);

  if (!cleanText) return null;

  return (
    <View style={styles.container}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading': {
            const hStyle =
              block.level === 1
                ? styles.h1
                : block.level === 2
                ? styles.h2
                : block.level === 3
                ? styles.h3
                : styles.h4;

            return (
              <View
                key={`h-${idx}`}
                style={[
                  styles.headingWrapper,
                  idx === 0 && { marginTop: 0 },
                ]}
              >
                <Text style={[styles.headingBase, hStyle, { color: colors.ink }]}>
                  {renderInline(block.text || '', colors, [styles.headingBase, hStyle])}
                </Text>
              </View>
            );
          }

          case 'code':
            return (
              <CodeBlock
                key={`code-${idx}`}
                language={block.language || ''}
                code={block.code || ''}
              />
            );

          case 'table':
            return (
              <TableBlock
                key={`tbl-${idx}`}
                headers={block.headers || []}
                rows={block.rows || []}
              />
            );

          case 'blockquote':
            return (
              <View
                key={`bq-${idx}`}
                style={[styles.blockquote, { borderLeftColor: colors.lineStrong }]}
              >
                <Text style={[styles.blockquoteText, { color: colors.ink2 }]}>
                  {renderInline(block.text || '', colors, styles.blockquoteText)}
                </Text>
              </View>
            );

          case 'bullet':
            return (
              <View
                key={`li-${idx}`}
                style={[
                  styles.listRow,
                  { marginLeft: (block.level || 0) * 16 },
                ]}
              >
                <Text style={[styles.bulletDot, { color: colors.ink3 }]}>•</Text>
                <Text style={[styles.bodyText, { color: colors.ink, flex: 1, paddingLeft: 6 }]}>
                  {renderInline(block.text || '', colors, styles.bodyText)}
                </Text>
              </View>
            );

          case 'number':
            return (
              <View
                key={`num-${idx}`}
                style={[
                  styles.listRow,
                  { marginLeft: (block.level || 0) * 16 },
                ]}
              >
                <Text style={[styles.numberPrefix, { color: colors.ink3 }]}>
                  {block.prefix}
                </Text>
                <Text style={[styles.bodyText, { color: colors.ink, flex: 1, paddingLeft: 6 }]}>
                  {renderInline(block.text || '', colors, styles.bodyText)}
                </Text>
              </View>
            );

          case 'hr':
            return (
              <View
                key={`hr-${idx}`}
                style={[styles.hr, { backgroundColor: colors.line }]}
              />
            );

          case 'paragraph':
          default:
            return (
              <View key={`p-${idx}`} style={styles.paragraphWrapper}>
                <Text style={[styles.bodyText, { color: colors.ink }]}>
                  {renderInline(block.text || '', colors, styles.bodyText)}
                </Text>
              </View>
            );
        }
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  paragraphWrapper: {
    marginBottom: 12,
  },
  headingWrapper: {
    marginTop: 20,
    marginBottom: 8,
  },
  headingBase: {
    fontWeight: '600',
    lineHeight: 25,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 24, // Matches leading-[1.7] from DisplaySummery.jsx
    letterSpacing: -0.1,
  },
  h1: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  h2: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 23,
    letterSpacing: -0.15,
  },
  h3: {
    fontSize: 15.5,
    fontWeight: '600',
    lineHeight: 21,
    letterSpacing: -0.1,
  },
  h4: {
    fontSize: 14.5,
    fontWeight: '600',
    lineHeight: 20,
  },
  inlineCode: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12.5,
    paddingHorizontal: 4.5,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 0.5,
  },
  codePanel: {
    backgroundColor: '#17171a',
    borderColor: '#2a2a30',
    borderWidth: 1,
    borderRadius: radius.md,
    marginVertical: 12,
    overflow: 'hidden',
  },
  codeHeader: {
    backgroundColor: '#0f0f11',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a30',
  },
  codeLangText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.45)',
    letterSpacing: 0.5,
  },
  codeCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  codeCopyText: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  codeBodyContainer: {
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  codeContentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  lineNumbersCol: {
    minWidth: 26,
    paddingRight: 10,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.07)',
    alignItems: 'flex-end',
  },
  lineNumberText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.22)',
  },
  codeLinesCol: {
    paddingLeft: 10,
  },
  codeLineText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12.5,
    lineHeight: 20,
    color: '#e4e4e7',
  },
  blockquote: {
    borderLeftWidth: 2.5,
    paddingLeft: 12,
    marginVertical: 10,
  },
  blockquoteText: {
    fontSize: 14.5,
    lineHeight: 23,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  bulletDot: {
    fontSize: 14,
    width: 14,
    marginTop: 2,
    textAlign: 'center',
  },
  numberPrefix: {
    fontSize: 13.5,
    fontWeight: '600',
    minWidth: 20,
    marginTop: 2,
  },
  hr: {
    height: 1,
    marginVertical: 20,
    width: '100%',
  },
  tableContainer: {
    borderWidth: 1,
    borderRadius: radius.md,
    marginVertical: 12,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tableHeaderRow: {
    paddingVertical: 2,
  },
  tableCell: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRightWidth: 1,
    minWidth: 100,
  },
  tableHeaderText: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  tableCellText: {
    fontSize: 13.5,
    lineHeight: 19,
  },
});
