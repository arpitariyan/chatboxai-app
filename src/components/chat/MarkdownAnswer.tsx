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
import { IconCopy, IconCheck, IconTable, IconArrowsLeftRight } from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius } from '@/theme';
import { getChatFontFamily } from '@/theme/typography';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { SvglIcon, getDomainFromUrl } from './SvglIcon';

interface MarkdownAnswerProps {
  content: string;
  onLongPress?: () => void;
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
const CodeBlock: React.FC<{ language: string; code: string }> = React.memo(({ language, code }) => {
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
});

// ── Markdown Table Component — smooth horizontal scrolling, responsive sizing & copy ──
interface TableBlockProps {
  headers: string[];
  rows: string[][];
  alignments?: ('left' | 'center' | 'right')[];
}

const TableBlock: React.FC<TableBlockProps> = React.memo(({ headers, rows, alignments = [] }) => {
  const colors = useThemeColors();
  const chatFont = usePreferencesStore((s) => s.chatFont);
  const chatFontFamily = getChatFontFamily(chatFont);
  const [copied, setCopied] = useState(false);

  // Determine column count (use headers if present, else max row width)
  const colCount = Math.max(
    headers.length,
    ...rows.map((r) => r.length)
  );

  if (colCount === 0) return null;

  // Pad rows that are shorter than colCount
  const paddedRows = useMemo(() => {
    return rows.map((row) => {
      if (row.length >= colCount) return row;
      return [...row, ...Array(colCount - row.length).fill('')];
    });
  }, [rows, colCount]);

  // Calculate dynamic column widths based on cell content length
  const colWidths = useMemo(() => {
    return Array.from({ length: colCount }).map((_, cIdx) => {
      let maxLen = headers[cIdx] ? headers[cIdx].length : 0;
      paddedRows.forEach((row) => {
        const cell = row[cIdx] || '';
        if (cell.length > maxLen) maxLen = cell.length;
      });

      // Very short content (e.g. #, ID, Yes/No, etc.)
      if (maxLen <= 4) {
        return Math.max(80, maxLen * 10 + 36);
      }
      // Medium content (e.g. names, categories, numbers)
      if (maxLen <= 15) {
        return Math.max(110, maxLen * 9 + 36);
      }
      // Longer content (e.g. descriptions, sentences)
      // Clamped between 140px and 320px so reading is pleasant without excessive wrapping
      const estimatedWidth = maxLen * 8 + 36;
      return Math.max(140, Math.min(320, estimatedWidth));
    });
  }, [colCount, headers, paddedRows]);

  const totalTableWidth = useMemo(() => {
    return colWidths.reduce((acc, w) => acc + w, 0);
  }, [colWidths]);

  // If table is wide (> 310px or > 2 columns), indicate horizontal scroll
  const isWideTable = totalTableWidth > 310 || colCount > 2;

  const isLastCol = (i: number) => i === colCount - 1;
  const isLastRow = (i: number) => i === paddedRows.length - 1;

  const getColAlign = (cIdx: number): 'left' | 'center' | 'right' => {
    return alignments[cIdx] || 'left';
  };

  const getTextAlignStyle = (align: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center':
        return { textAlign: 'center' as const };
      case 'right':
        return { textAlign: 'right' as const };
      default:
        return { textAlign: 'left' as const };
    }
  };

  const handleCopyTable = async () => {
    if (copied) return;
    try {
      const headerLine = `| ${headers.map((h) => h || ' ').join(' | ')} |`;
      const dividerLine = `| ${colWidths.map((_, i) => {
        const align = getColAlign(i);
        if (align === 'center') return ':---:';
        if (align === 'right') return '---:';
        return '---';
      }).join(' | ')} |`;
      const rowLines = paddedRows.map((r) => `| ${r.map((c) => c || ' ').join(' | ')} |`);
      const tableMarkdown = [headerLine, dividerLine, ...rowLines].join('\n');

      await Clipboard.setStringAsync(tableMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Copy table failed:', err);
    }
  };

  return (
    <View style={[styles.tableOuterWrapper, { borderColor: colors.line, backgroundColor: colors.surface }]}>
      {/* Top action / info bar */}
      <View style={[styles.tableTopBar, { backgroundColor: colors.inset, borderBottomColor: colors.line }]}>
        <View style={styles.tableTopLeft}>
          <IconTable size={14} color={colors.ink2} />
          <Text style={[styles.tableTopTitle, { color: colors.ink2 }]}>
            Table {colCount > 0 ? `(${colCount} cols)` : ''}
          </Text>
          {isWideTable && (
            <View style={[styles.swipeHintBadge, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <IconArrowsLeftRight size={11} color={colors.accent || '#818cf8'} />
              <Text style={[styles.swipeHintText, { color: colors.accent || '#818cf8' }]}>
                Scroll ↔
              </Text>
            </View>
          )}
        </View>

        <Pressable
          onPress={handleCopyTable}
          hitSlop={8}
          accessibilityLabel={copied ? 'Table copied' : 'Copy table'}
          style={({ pressed }) => [
            styles.tableCopyBtn,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          {copied ? (
            <>
              <IconCheck size={12} color="#4ade80" />
              <Text style={[styles.tableCopyBtnText, { color: '#4ade80' }]}>Copied</Text>
            </>
          ) : (
            <>
              <IconCopy size={12} color={colors.ink3} />
              <Text style={[styles.tableCopyBtnText, { color: colors.ink3 }]}>Copy</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Horizontal Scrollable Table Body */}
      <ScrollView
        horizontal
        nestedScrollEnabled={true}
        directionalLockEnabled={true}
        showsHorizontalScrollIndicator={true}
        persistentScrollbar={Platform.OS === 'android'}
        overScrollMode="never"
        bounces={false}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.tableScrollContent}
        style={styles.tableScrollView}
      >
        <View style={[styles.tableInner, { minWidth: totalTableWidth }]}>
          {/* Header Row */}
          {headers.length > 0 && (
            <View
              style={[
                styles.tableRow,
                styles.tableHeaderRow,
                {
                  backgroundColor: colors.inset,
                  borderBottomColor: colors.lineStrong || colors.line,
                },
              ]}
            >
              {headers.map((h, i) => {
                const align = getColAlign(i);
                return (
                  <View
                    key={`th-${i}`}
                    style={[
                      styles.tableCell,
                      styles.tableHeaderCell,
                      { width: colWidths[i] },
                      !isLastCol(i) && { borderRightWidth: 1, borderRightColor: colors.line },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tableHeaderText,
                        { color: colors.ink, fontFamily: chatFontFamily },
                        getTextAlignStyle(align),
                      ]}
                    >
                      {renderInline(h, colors, { fontFamily: chatFontFamily })}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Data Rows */}
          {paddedRows.map((row, rIdx) => (
            <View
              key={`tr-${rIdx}`}
              style={[
                styles.tableRow,
                {
                  backgroundColor: rIdx % 2 === 1 ? colors.inset : colors.surface,
                },
                !isLastRow(rIdx) && {
                  borderBottomWidth: 1,
                  borderBottomColor: colors.line,
                },
              ]}
            >
              {row.map((cell, cIdx) => {
                const align = getColAlign(cIdx);
                return (
                  <View
                    key={`td-${rIdx}-${cIdx}`}
                    style={[
                      styles.tableCell,
                      { width: colWidths[cIdx] },
                      !isLastCol(cIdx) && { borderRightWidth: 1, borderRightColor: colors.line },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tableCellText,
                        { color: colors.ink, fontFamily: chatFontFamily },
                        getTextAlignStyle(align),
                      ]}
                    >
                      {renderInline(cell, colors, { fontFamily: chatFontFamily })}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
});

// ── Inline Text Formatter (Bold, Italic, Code, Link, Smart URL) ──
interface InlineToken {
  type: 'text' | 'bold' | 'italic' | 'code' | 'link' | 'raw_url' | 'citation';
  text: string;
  url?: string;
}

function parseInlineMarkdown(text: string): InlineToken[] {
  if (!text) return [];

  const tokens: InlineToken[] = [];
  // Matches: **bold**, *italic*, `code`, [link](url), raw https?:// url, [citation] (e.g. [1], [2, 3])
  const regex = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(https?:\/\/[^\s<>()]+)|(\[([0-9]+(?:\s*,\s*[0-9]+)*)\])(?!\()/g;

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
    } else if (match[11]) {
      // [citation]
      tokens.push({ type: 'citation', text: match[12] });
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
}

const getCleanDomain = (rawUrl: string): string => {
  try {
    const u = new URL(rawUrl);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return rawUrl;
  }
};

function renderInline(text: string, colors: any, baseStyle?: any) {
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
        const domain = getDomainFromUrl(token.url || token.text);
        return (
          <Text
            key={`u-${idx}`}
            onPress={() => token.url && Linking.openURL(token.url)}
            style={[
              baseStyle,
              {
                color: colors.accent,
                textDecorationLine: 'none',
              },
            ]}
          >
            {'↗ '}{domain}
          </Text>
        );
      }
      case 'link': {
        const linkDomain = getDomainFromUrl(token.url || '');
        const linkLabel = token.text && token.text !== token.url ? token.text : linkDomain;
        return (
          <Text
            key={`l-${idx}`}
            onPress={() => token.url && Linking.openURL(token.url)}
            style={[
              baseStyle,
              {
                color: colors.accent,
                textDecorationLine: 'none',
              },
            ]}
          >
            {'↗ '}{linkLabel}
          </Text>
        );
      }
      case 'citation': {
        return (
          <Text
            key={`cit-${idx}`}
            style={[
              baseStyle,
              styles.inlineCitation,
            ]}
          >
            {`[${token.text}]`}
          </Text>
        );
      }
      default:
        return (
          <Text key={`t-${idx}`} style={baseStyle}>
            {token.text}
          </Text>
        );
    }
  });
};

export const MarkdownAnswer: React.FC<MarkdownAnswerProps> = React.memo(({ content, onLongPress }) => {
  const colors = useThemeColors();
  const chatFont = usePreferencesStore((s) => s.chatFont);
  const chatFontFamily = getChatFontFamily(chatFont);
  const resolvedBodyTextStyle = useMemo(() => [styles.bodyText, { fontFamily: chatFontFamily }], [chatFontFamily]);

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
      alignments?: ('left' | 'center' | 'right')[];
      text?: string;
      prefix?: string;
    }> = [];

    let inCodeBlock = false;
    let codeLanguage = '';
    let codeBuffer: string[] = [];

    let inTable = false;
    let tableHeaders: string[] = [];
    let tableRows: string[][] = [];
    let tableAlignments: ('left' | 'center' | 'right')[] = [];

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
          alignments: tableAlignments,
        });
        inTable = false;
        tableHeaders = [];
        tableRows = [];
        tableAlignments = [];
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

      // Handle Table Row (starts with | or has | with multiple columns)
      const isTablePipeLine =
        trimmed.startsWith('|') ||
        (trimmed.includes('|') &&
          !trimmed.startsWith('```') &&
          !trimmed.startsWith('#') &&
          !trimmed.startsWith('>') &&
          !trimmed.startsWith('- ') &&
          !trimmed.startsWith('* '));

      if (isTablePipeLine) {
        flushParagraph();
        let s = trimmed;
        if (s.startsWith('|')) s = s.slice(1);
        if (s.endsWith('|')) s = s.slice(0, -1);
        const cells = s.split('|').map((c) => c.trim());

        // Check if this is divider row (|---|---| or |:---|:---:|---:|)
        const isDivider = cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));

        if (isDivider) {
          if (inTable) {
            tableAlignments = cells.map((cell) => {
              const starts = cell.startsWith(':');
              const ends = cell.endsWith(':');
              if (starts && ends) return 'center';
              if (ends) return 'right';
              return 'left';
            });
          }
          continue; // skip separator row
        }

        if (!inTable) {
          inTable = true;
          tableHeaders = cells;
          tableRows = [];
          tableAlignments = [];
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
                <Text style={[styles.headingBase, hStyle, { color: colors.ink, fontFamily: chatFontFamily }]}>
                  {renderInline(block.text || '', colors, [styles.headingBase, hStyle, { fontFamily: chatFontFamily }])}
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
                alignments={block.alignments || []}
              />
            );

          case 'blockquote':
            return (
              <View
                key={`bq-${idx}`}
                style={[styles.blockquote, { borderLeftColor: colors.lineStrong }]}
              >
                <Text style={[styles.blockquoteText, { color: colors.ink2, fontFamily: chatFontFamily }]}>
                  {renderInline(block.text || '', colors, [styles.blockquoteText, { fontFamily: chatFontFamily }])}
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
                <Text style={[resolvedBodyTextStyle, { color: colors.ink, flex: 1, paddingLeft: 6 }]}>
                  {renderInline(block.text || '', colors, resolvedBodyTextStyle)}
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
                <Text style={[resolvedBodyTextStyle, { color: colors.ink, flex: 1, paddingLeft: 6 }]}>
                  {renderInline(block.text || '', colors, resolvedBodyTextStyle)}
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
                {onLongPress ? (
                  <Pressable onLongPress={onLongPress} delayLongPress={500}>
                    <Text style={[resolvedBodyTextStyle, { color: colors.ink }]}>
                      {renderInline(block.text || '', colors, resolvedBodyTextStyle)}
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={[resolvedBodyTextStyle, { color: colors.ink }]}>
                    {renderInline(block.text || '', colors, resolvedBodyTextStyle)}
                  </Text>
                )}
              </View>
            );
        }
      })}
    </View>
  );
});

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
  inlineCitation: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: '#a78bfa',
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
  tableOuterWrapper: {
    borderWidth: 1,
    borderRadius: radius.md,
    marginVertical: 14,
    overflow: 'hidden',
  },
  tableTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  tableTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tableTopTitle: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  swipeHintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    marginLeft: 4,
  },
  swipeHintText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  tableCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  tableCopyBtnText: {
    fontSize: 11,
    fontWeight: '500',
  },
  tableScrollView: {
    width: '100%',
  },
  tableScrollContent: {
    flexGrow: 1,
  },
  tableInner: {
    flexDirection: 'column',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  tableHeaderRow: {
    borderBottomWidth: 1.5,
  },
  tableCell: {
    paddingHorizontal: 13,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  tableHeaderCell: {
    paddingVertical: 10,
    paddingHorizontal: 13,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    lineHeight: 18,
  },
  tableCellText: {
    fontSize: 13,
    lineHeight: 19,
  },
});
