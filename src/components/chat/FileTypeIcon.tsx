/**
 * src/components/chat/FileTypeIcon.tsx
 *
 * Professional, format-specific vector file icons for chat attachments and composer previews.
 * Replaces generic emoji icons (📄) with consistent, high-contrast SVG icons from Tabler.
 */

import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import {
  IconFileTypePdf,
  IconFileTypeDocx,
  IconFileTypePpt,
  IconFileTypeXls,
  IconFileTypeCsv,
  IconFileTypeTxt,
  IconFileTypeZip,
  IconFileCode,
  IconMusic,
  IconVideo,
  IconFile,
} from '@tabler/icons-react-native';

export type FileCategory =
  | 'pdf'
  | 'word'
  | 'powerpoint'
  | 'excel'
  | 'csv'
  | 'text'
  | 'audio'
  | 'video'
  | 'archive'
  | 'code'
  | 'generic';

export interface FileTypeIconProps {
  fileName?: string;
  mimeType?: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Classifies a file by extension and MIME type into a canonical category.
 */
export function getFileCategory(fileName = '', mimeType = ''): { category: FileCategory; defaultColor: string } {
  const cleanName = (fileName || '').toLowerCase();
  const cleanMime = (mimeType || '').toLowerCase();
  const ext = cleanName.includes('.') ? cleanName.split('.').pop() || '' : '';

  // 1. PDF
  if (ext === 'pdf' || cleanMime.includes('pdf')) {
    return { category: 'pdf', defaultColor: '#ef4444' }; // Red
  }

  // 2. Word / Documents
  if (
    ['docx', 'doc', 'odt', 'rtf'].includes(ext) ||
    cleanMime.includes('word') ||
    cleanMime.includes('officedocument.wordprocessingml')
  ) {
    return { category: 'word', defaultColor: '#3b82f6' }; // Blue
  }

  // 3. PowerPoint / Presentations
  if (
    ['pptx', 'ppt', 'odp', 'key'].includes(ext) ||
    cleanMime.includes('presentation') ||
    cleanMime.includes('powerpoint')
  ) {
    return { category: 'powerpoint', defaultColor: '#f97316' }; // Orange
  }

  // 4. Excel / Spreadsheets
  if (
    ['xlsx', 'xls', 'ods'].includes(ext) ||
    cleanMime.includes('spreadsheet') ||
    cleanMime.includes('excel')
  ) {
    return { category: 'excel', defaultColor: '#10b981' }; // Emerald Green
  }

  // 5. CSV / Tabular Data
  if (['csv', 'tsv'].includes(ext) || cleanMime.includes('csv')) {
    return { category: 'csv', defaultColor: '#059669' }; // Teal
  }

  // 6. Audio
  if (
    ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'wma', 'opus'].includes(ext) ||
    cleanMime.startsWith('audio/')
  ) {
    return { category: 'audio', defaultColor: '#a855f7' }; // Purple
  }

  // 7. Video
  if (
    ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', '3gp', 'm4v'].includes(ext) ||
    cleanMime.startsWith('video/')
  ) {
    return { category: 'video', defaultColor: '#f43f5e' }; // Rose
  }

  // 8. Archives / Compressed
  if (
    ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext) ||
    cleanMime.includes('zip') ||
    cleanMime.includes('compressed') ||
    cleanMime.includes('tar')
  ) {
    return { category: 'archive', defaultColor: '#eab308' }; // Amber
  }

  // 9. Code & Data
  if (
    ['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'xml', 'py', 'java', 'c', 'cpp', 'cs', 'php', 'rb', 'go', 'rs', 'sql', 'sh', 'yaml', 'yml'].includes(ext) ||
    cleanMime.includes('json') ||
    cleanMime.includes('javascript') ||
    cleanMime.includes('xml') ||
    cleanMime.includes('html')
  ) {
    return { category: 'code', defaultColor: '#6366f1' }; // Indigo
  }

  // 10. Text / Markdown
  if (
    ['txt', 'md', 'markdown', 'log'].includes(ext) ||
    cleanMime.includes('text/plain') ||
    cleanMime.includes('markdown')
  ) {
    return { category: 'text', defaultColor: '#94a3b8' }; // Slate
  }

  // 11. Generic fallback
  return { category: 'generic', defaultColor: '#71717a' }; // Neutral Gray
}

export const FileTypeIcon: React.FC<FileTypeIconProps> = ({
  fileName = '',
  mimeType = '',
  size = 20,
  color,
  style,
}) => {
  const { category, defaultColor } = getFileCategory(fileName, mimeType);
  const iconColor = color || defaultColor;

  let IconComponent: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;

  switch (category) {
    case 'pdf':
      IconComponent = IconFileTypePdf;
      break;
    case 'word':
      IconComponent = IconFileTypeDocx;
      break;
    case 'powerpoint':
      IconComponent = IconFileTypePpt;
      break;
    case 'excel':
      IconComponent = IconFileTypeXls;
      break;
    case 'csv':
      IconComponent = IconFileTypeCsv;
      break;
    case 'audio':
      IconComponent = IconMusic;
      break;
    case 'video':
      IconComponent = IconVideo;
      break;
    case 'archive':
      IconComponent = IconFileTypeZip;
      break;
    case 'code':
      IconComponent = IconFileCode;
      break;
    case 'text':
      IconComponent = IconFileTypeTxt;
      break;
    case 'generic':
    default:
      IconComponent = IconFile;
      break;
  }

  return (
    <View style={[styles.container, style]}>
      <IconComponent size={size} color={iconColor} strokeWidth={1.8} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
