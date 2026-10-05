import React, { useState, useMemo, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Pressable, Image } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Image as ExpoImage } from 'expo-image';
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
import { parseAiResponse, stripTrailingSources } from '@/utils/parseAiResponse';
import { useThemeColors, spacing, radius, typography } from '@/theme';
import { ThinkingBlock } from './ThinkingBlock';
import { MarkdownAnswer } from './MarkdownAnswer';
import { TextSelectionSheet } from './TextSelectionSheet';
import { SourceChips } from './SourceChips';
import { ImagePreviewList } from './ImagePreviewList';
import { SourcesBottomSheet } from './SourcesBottomSheet';

export interface MessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  timestamp?: string;
  isStreaming?: boolean;
  searchResult?: any;
  attachments?: any[];
  modelName?: string;
  liked?: boolean | string;
  disliked?: boolean | string;
  versions?: {
    id: string;
    content: string;
    thinking?: string;
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

import { resolveAttachment } from '@/utils/attachments';
import { AttachmentImage } from './AttachmentImage';
import { FileTypeIcon } from './FileTypeIcon';

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
  const [showTextSelection, setShowTextSelection] = useState(false);
  const [showSourcesSheet, setShowSourcesSheet] = useState(false);

  // Extract structured sources list for display and bottom sheet
  const sourcesList = useMemo(() => {
    let list: any[] = [];
    if (message.searchResult) {
      let parsed: any = message.searchResult;
      if (typeof message.searchResult === 'string') {
        try {
          parsed = JSON.parse(message.searchResult);
        } catch {
          parsed = null;
        }
      }
      if (parsed) {
        list = Array.isArray(parsed)
          ? parsed
          : (parsed?.sources || parsed?.web || parsed?.searchResult || parsed?.mixedResults || []);
      }
    }

    // Fallback: If searchResult has no sources, check if message.content has extracted sources
    if (list.length === 0 && message.content && message.role === 'assistant') {
      const { extractedSources } = stripTrailingSources(message.content);
      if (extractedSources.length > 0) {
        list = extractedSources;
      }
    }

    return list.filter((item: any) => {
      const u = item?.url || item?.link;
      return typeof u === 'string' && (u.startsWith('http://') || u.startsWith('https://'));
    });
  }, [message.searchResult, message.content, message.role]);

  // Clean message content: strip thinking tags and any trailing duplicate sources section safely
  const cleanMessageContent = useMemo(() => {
    if (!message.content) return '';
    if (message.role !== 'assistant') return message.content;
    const parsed = parseAiResponse(message.content);
    return parsed.finalAnswer || message.content;
  }, [message.content, message.role]);

  // ── Typewriter animation ─────────────────────────────────────────────────
  // `animating` is true ONLY while the RAF loop is running.
  // It flips to false the moment all characters are painted — regardless of
  // the `message.isStreaming` prop — so the dot/toolbar state is deterministic.
  const [animating, setAnimating] = useState(() => message.isStreaming === true);
  const [displayedContent, setDisplayedContent] = useState(() =>
    message.isStreaming ? '' : cleanMessageContent
  );
  const animRef = useRef({ currentLength: 0, targetText: cleanMessageContent });

  useEffect(() => {
    if (!message.isStreaming) {
      // History reload or non-streaming message — show everything immediately
      setAnimating(false);
      setDisplayedContent(cleanMessageContent);
      return;
    }

    // New streaming message: kick off the animation
    setAnimating(true);
    animRef.current = { currentLength: 0, targetText: cleanMessageContent };

    let rafId: number;
    let lastTime = 0;

    const tick = (timestamp: number) => {
      if (timestamp - lastTime >= 16) {
        const { currentLength, targetText } = animRef.current;
        if (currentLength < targetText.length) {
          const remaining = targetText.length - currentLength;
          const charsToAdd = Math.max(1, Math.floor(remaining / 5));
          const next = Math.min(targetText.length, currentLength + charsToAdd);
          animRef.current.currentLength = next;
          setDisplayedContent(targetText.substring(0, next));
          lastTime = timestamp;
        } else {
          // All chars shown — stop. Never re-queue after this.
          setDisplayedContent(animRef.current.targetText);
          setAnimating(false);
          return;
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [cleanMessageContent, message.isStreaming]);

  const isLiked = message.liked === true || message.liked === 'true';
  const isDisliked = message.disliked === true || message.disliked === 'true';

  // Extract thinking / reasoning block safely using parseAiResponse
  const thinkingContent = useMemo(() => {
    if (message.thinking) return message.thinking.trim();
    if (!message.content || message.role !== 'assistant') return '';
    return parseAiResponse(message.content).thinking;
  }, [message.content, message.role, message.thinking]);

  // Clean the content for copying and text selection
  const fullFinalContent = cleanMessageContent;

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(fullFinalContent);
      setCopied(true);
      onCopy?.(fullFinalContent);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy message:', err);
    }
  };

  const handleTTS = async () => {
    try {
      // Determine which version's content to read
      const rawContentToRead = message.versions && message.currentVersionIndex !== undefined
        ? message.versions[message.currentVersionIndex].content
        : message.content;

      const contentToRead = parseAiResponse(rawContentToRead || '').finalAnswer;

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
        {/* Attachment previews above the text bubble, right-aligned */}
        {message.attachments && message.attachments.length > 0 && (
          <View style={[styles.attachmentsContainer, { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6, marginBottom: 8 }]}>
            {message.attachments.slice(0, 4).map((file, index) => {
              const resolved = resolveAttachment(file);
              const candidates = resolved.candidates;

              if (resolved.isImage && candidates.length > 0) {
                return (
                  <View key={`attach-${index}`} style={[styles.imageAttachmentCard, { marginBottom: 0 }]}>
                    <AttachmentImage
                      candidates={candidates}
                      style={styles.imageAttachmentImage}
                    />
                  </View>
                );
              }

              return (
                <View
                  key={`attach-${index}`}
                  style={[
                    styles.fileAttachmentCard,
                    { backgroundColor: colors.inset, borderColor: colors.line, marginBottom: 0 },
                  ]}
                >
                  <FileTypeIcon
                    fileName={resolved.displayName}
                    mimeType={resolved.mimeType}
                    size={18}
                  />
                  <Text
                    style={[styles.fileAttachmentText, { color: colors.ink }]}
                    numberOfLines={1}
                  >
                    {resolved.displayName}
                  </Text>
                </View>
              );
            })}

            {message.attachments.length > 4 && (
              <View
                style={[
                  styles.imageAttachmentCard,
                  {
                    backgroundColor: colors.inset,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: 0,
                    borderWidth: 1,
                    borderColor: colors.line
                  },
                ]}
              >
                <Text style={{ color: colors.ink, fontWeight: 'bold', fontSize: 16 }}>
                  +{message.attachments.length - 4}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Text bubble — only show if there is actual text */}
        {!!message.content && (
          <Pressable
            onLongPress={() => setShowTextSelection(true)}
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
        )}

        <TextSelectionSheet
          visible={showTextSelection}
          onClose={() => setShowTextSelection(false)}
          content={message.content}
        />
      </View>
    );
  }

  // ── Assistant Response (Full Width Document Layout matching DisplayResult.jsx & DisplaySummery.jsx) ──
  return (
    <>
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
          <MarkdownAnswer
            content={displayedContent}
            onLongPress={() => setShowTextSelection(true)}
          />

          {/* 3. Streaming Pulse Dot — driven by animating state, NOT message.isStreaming */}
          {animating && (
            <View style={styles.streamingIndicator}>
              <Text style={[styles.streamingDot, { color: colors.accent }]}>●</Text>
            </View>
          )}

          {/* 4. Web Sources / Citations (matching sourceList.jsx) */}
          {sourcesList.length > 0 && (
            <SourceChips
              searchResult={message.searchResult || { sources: sourcesList }}
              onOpenSheet={() => setShowSourcesSheet(true)}
            />
          )}

          {/* 5. Images / Media Previews (matching ImageList.jsx) */}
          {message.searchResult && (
            <ImagePreviewList searchResult={message.searchResult} />
          )}
        </View>

        {/* Action Toolbar — visible once animation is fully done */}
        {!animating && (
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
                    { opacity: pressed || (message.currentVersionIndex || 0) === 0 ? 0.4 : 1 },
                  ]}
                >
                  <IconChevronLeft size={16} color={colors.ink3} />
                </Pressable>

                <Text style={{ color: colors.ink3, fontSize: 13 }}>
                  {(message.currentVersionIndex || 0) + 1}/{message.versions.length}
                </Text>

                <Pressable
                  onPress={() => onVersionChange?.(message.id, 'next')}
                  disabled={(message.currentVersionIndex || 0) === message.versions.length - 1}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { opacity: pressed || (message.currentVersionIndex || 0) === (message.versions?.length || 0) - 1 ? 0.4 : 1 },
                  ]}
                >
                  <IconChevronRight size={16} color={colors.ink3} />
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* Sources Full Bottom Sheet */}
        {sourcesList.length > 0 && (
          <SourcesBottomSheet
            visible={showSourcesSheet}
            sources={sourcesList}
            onClose={() => setShowSourcesSheet(false)}
          />
        )}
      </View>

      <TextSelectionSheet
        visible={showTextSelection}
        onClose={() => setShowTextSelection(false)}
        content={fullFinalContent}
      />
    </>
  );
};

const styles = StyleSheet.create({
  userWrapper: {
    width: '100%',
    marginVertical: spacing.sm,
    alignItems: 'flex-end',
  },
  attachmentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xs,
    justifyContent: 'flex-end',
    maxWidth: '85%',
  },
  imageAttachmentCard: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#333',
  },
  imageAttachmentImage: {
    width: 160,
    height: 160,
    borderRadius: 14,
  },
  fileAttachmentCard: {
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: 220,
  },
  fileAttachmentIcon: {
    fontSize: 16,
  },
  fileAttachmentText: {
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  userCapsule: {
    maxWidth: '85%',
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
