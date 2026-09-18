import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, View, Pressable, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  IconCopy,
  IconCheck,
  IconThumbUp,
  IconThumbDown,
  IconVolume,
  IconRefresh,
  IconChevronLeft,
  IconChevronRight,
} from '@tabler/icons-react-native';
import * as Speech from 'expo-speech';
import { preprocessTextForTTS } from '@/utils/preprocessTTS';
import { useThemeColors, spacing, radius, typography } from '@/theme';
import { ThinkingBlock } from './ThinkingBlock';
import { MarkdownAnswer } from './MarkdownAnswer';
import { SourceChips } from './SourceChips';
import { ImagePreviewList } from './ImagePreviewList';

export interface MessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  isStreaming?: boolean;
  searchResult?: any;
  modelName?: string;
  liked?: boolean | string;
  disliked?: boolean | string;
  versions?: {
    id: string;
    content: string;
    searchResult?: any;
    modelName?: string;
    liked?: boolean | string;
    disliked?: boolean | string;
  }[];
  currentVersionIndex?: number;
}

interface ChatBubbleProps {
  message: MessageItem;
  onCopy?: (text: string) => void;
  onRegenerate?: (id: string) => void;
  onFeedback?: (id: string, field: 'liked' | 'disliked', value: boolean) => void;
  onVersionChange?: (id: string, direction: 'prev' | 'next') => void;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  onCopy,
  onRegenerate,
  onFeedback,
  onVersionChange,
}) => {
  const colors = useThemeColors();
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const isLiked = message.liked === true || message.liked === 'true';
  const isDisliked = message.disliked === true || message.disliked === 'true';

  // Extract thinking / reasoning block from <think>...</think>
  const thinkingContent = useMemo(() => {
    if (!message.content || message.role !== 'assistant') return '';
    const match = message.content.match(/<think>([\s\S]*?)<\/think>/i);
    if (match) return match[1].trim();
    // In case thinking tag wasn't closed yet
    const openMatch = message.content.match(/<think>([\s\S]*)$/i);
    if (openMatch) return openMatch[1].trim();
    return '';
  }, [message.content, message.role]);

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(message.content);
      setCopied(true);
      onCopy?.(message.content);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy message:', err);
    }
  };

  const handleTTS = async () => {
    try {
      // Determine which version's content to read
      const contentToRead = message.versions && message.currentVersionIndex !== undefined
        ? message.versions[message.currentVersionIndex].content
        : message.content;
        
      if (isSpeaking) {
        await Speech.stop();
        setIsSpeaking(false);
        return;
      }
      
      setIsSpeaking(true);
      const cleanText = preprocessTextForTTS(contentToRead);
      if (!cleanText) {
        setIsSpeaking(false);
        return;
      }
      
      Speech.speak(cleanText, {
        language: 'en-US',
        pitch: 1.0,
        rate: 1.0,
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    } catch (err) {
      console.warn('TTS error:', err);
      setIsSpeaking(false);
    }
  };

  // The stable root ID is used for React keys, but the activeId should be used for DB actions (like/dislike/regenerate)
  // because each version represents a distinct DB record.
  const activeId = message.versions && message.currentVersionIndex !== undefined
    ? message.versions[message.currentVersionIndex].id
    : message.id;

  const isUser = message.role === 'user';

  // ── User Message Capsule (Right Aligned matching ChatGPT & Web App) ──
  if (isUser) {
    return (
      <View style={styles.userWrapper}>
        <Pressable
          onLongPress={handleCopy}
          style={({ pressed }) => [
            styles.userCapsule,
            {
              backgroundColor: '#27272a',
              borderColor: colors.line,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Text style={[styles.userText, { color: '#ffffff' }]}>
            {message.content}
          </Text>
        </Pressable>
      </View>
    );
  }

  // ── Assistant Response (Full Width Document Layout matching DisplayResult.jsx & DisplaySummery.jsx) ──
  return (
    <View style={styles.assistantWrapper}>
      {/* Assistant Document Content */}
      <View style={styles.assistantContent}>
        {/* 1. Collapsible Thinking / Reasoning Block (matching ThinkingBlock in DisplaySummery.jsx) */}
        {thinkingContent.length > 0 && (
          <ThinkingBlock
            content={thinkingContent}
            isFinished={!message.isStreaming}
          />
        )}

        {/* 2. Rich Markdown Formatted Answer */}
        <MarkdownAnswer content={message.content} />

        {/* 3. Streaming Pulse Dot */}
        {message.isStreaming && (
          <View style={styles.streamingIndicator}>
            <Text style={[styles.streamingDot, { color: colors.accent }]}>●</Text>
          </View>
        )}

        {/* 4. Web Sources / Citations (matching sourceList.jsx) */}
        {message.searchResult && (
          <SourceChips searchResult={message.searchResult} />
        )}

        {/* 5. Images / Media Previews (matching ImageList.jsx) */}
        {message.searchResult && (
          <ImagePreviewList searchResult={message.searchResult} />
        )}
      </View>

      {/* Action Toolbar matching DisplayResult.jsx bottom bar */}
      {!message.isStreaming && (
        <View style={styles.actionRow}>
          {/* Copy Button */}
          <Pressable
            onPress={handleCopy}
            hitSlop={8}
            accessibilityLabel="Copy answer"
            style={({ pressed }) => [
              styles.actionBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            {copied ? (
              <IconCheck size={16} color="#4ade80" />
            ) : (
              <IconCopy size={16} color={colors.ink3} />
            )}
          </Pressable>

          {/* Thumbs Up */}
          <Pressable
            onPress={() => onFeedback?.(activeId, 'liked', !isLiked)}
            hitSlop={8}
            accessibilityLabel="Helpful"
            style={({ pressed }) => [
              styles.actionBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <IconThumbUp
              size={16}
              color={isLiked ? colors.accent : colors.ink3}
              fill={isLiked ? colors.accent : 'none'}
            />
          </Pressable>

          {/* Thumbs Down */}
          <Pressable
            onPress={() => onFeedback?.(activeId, 'disliked', !isDisliked)}
            hitSlop={8}
            accessibilityLabel="Not helpful"
            style={({ pressed }) => [
              styles.actionBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <IconThumbDown
              size={16}
              color={isDisliked ? colors.destructive : colors.ink3}
              fill={isDisliked ? colors.destructive : 'none'}
            />
          </Pressable>

          {/* TTS Speaker */}
          <Pressable
            onPress={handleTTS}
            hitSlop={8}
            accessibilityLabel="Read aloud"
            style={({ pressed }) => [
              styles.actionBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <IconVolume 
              size={16} 
              color={isSpeaking ? colors.accent : colors.ink3} 
              fill={isSpeaking ? colors.accent : 'none'}
            />
          </Pressable>

          {/* Regenerate */}
          {onRegenerate && (
            <Pressable
              onPress={() => onRegenerate(activeId)}
              hitSlop={8}
              accessibilityLabel="Regenerate response"
              style={({ pressed }) => [
                styles.actionBtn,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <IconRefresh size={16} color={colors.ink3} />
            </Pressable>
          )}

          {/* Version Navigation */}
          {message.versions && message.versions.length > 1 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto', paddingRight: 4 }}>
              <Pressable
                onPress={() => onVersionChange?.(message.id, 'prev')}
                disabled={(message.currentVersionIndex || 0) === 0}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.actionBtn,
                  { opacity: pressed || (message.currentVersionIndex || 0) === 0 ? 0.4 : 1 }
                ]}
              >
                <IconChevronLeft size={16} color={colors.ink3} />
              </Pressable>
              
              <Text style={{ color: colors.ink3, fontSize: 13 }}>
                {(message.currentVersionIndex || 0) + 1}/{message.versions?.length}
              </Text>
              
              <Pressable
                onPress={() => onVersionChange?.(message.id, 'next')}
                disabled={(message.currentVersionIndex || 0) === (message.versions?.length || 0) - 1}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.actionBtn,
                  { opacity: pressed || (message.currentVersionIndex || 0) === (message.versions?.length || 0) - 1 ? 0.4 : 1 }
                ]}
              >
                <IconChevronRight size={16} color={colors.ink3} />
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  userWrapper: {
    width: '100%',
    marginVertical: spacing.sm,
  },
  userCapsule: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderCurve: radius.borderCurve,
  },
  userText: {
    fontSize: typography.fontSize.sm + 0.5,
    lineHeight: 22,
    fontWeight: typography.fontWeight.normal,
  },
  assistantWrapper: {
    width: '100%',
    marginVertical: spacing.md,
  },
  assistantContent: {
    width: '100%',
    paddingHorizontal: 0,
  },
  streamingIndicator: {
    marginTop: spacing.xs,
  },
  streamingDot: {
    fontSize: 14,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 2,
    paddingHorizontal: 0,
    marginTop: spacing.sm + 2,
  },
  actionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
});
