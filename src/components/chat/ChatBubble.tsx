import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import {
  IconSparkles,
  IconCopy,
  IconCheck,
  IconThumbUp,
  IconThumbDown,
  IconVolume,
  IconShare,
  IconRefresh,
} from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius, typography } from '@/theme';

export interface MessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  isStreaming?: boolean;
}

interface ChatBubbleProps {
  message: MessageItem;
  onCopy?: (text: string) => void;
  onRegenerate?: (id: string) => void;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  onCopy,
  onRegenerate,
}) => {
  const colors = useThemeColors();
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const handleCopy = () => {
    onCopy?.(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isUser = message.role === 'user';

  // User Message Bubble (Right Aligned matching ChatGPT Image 1)
  if (isUser) {
    return (
      <View style={styles.userWrapper}>
        <View
          style={[
            styles.userCapsule,
            {
              backgroundColor: '#27272a',
            },
          ]}
        >
          <Text style={[styles.userText, { color: '#ffffff' }]}>
            {message.content}
          </Text>
        </View>
      </View>
    );
  }

  // Assistant Response (Full Width Document Layout matching Image 3)
  return (
    <View style={styles.assistantWrapper}>
      {/* Assistant Brand Avatar */}
      <View style={styles.assistantHeaderRow}>
        <View style={[styles.assistantAvatar, { backgroundColor: colors.accent }]}>
          <IconSparkles size={13} color="#ffffff" />
        </View>
        <Text style={[styles.assistantName, { color: colors.ink }]}>
          ChatBox AI
        </Text>
      </View>

      {/* Assistant Document Content */}
      <View style={styles.assistantContent}>
        <Text style={[styles.assistantText, { color: colors.ink }]}>
          {message.content}
        </Text>

        {/* Streaming Indicator */}
        {message.isStreaming && (
          <View style={styles.streamingIndicator}>
            <Text style={[styles.streamingDot, { color: colors.accent }]}>●</Text>
          </View>
        )}
      </View>

      {/* Action Toolbar matching ChatGPT Image 3 */}
      {!message.isStreaming && (
        <View style={styles.actionRow}>
          <Pressable onPress={handleCopy} hitSlop={6} style={styles.actionBtn}>
            {copied ? (
              <IconCheck size={16} color="#4ade80" />
            ) : (
              <IconCopy size={16} color={colors.ink2} />
            )}
          </Pressable>

          <Pressable
            onPress={() => setFeedback((f) => (f === 'up' ? null : 'up'))}
            hitSlop={6}
            style={styles.actionBtn}
          >
            <IconThumbUp
              size={16}
              color={feedback === 'up' ? colors.accent : colors.ink2}
              fill={feedback === 'up' ? colors.accent : 'none'}
            />
          </Pressable>

          <Pressable
            onPress={() => setFeedback((f) => (f === 'down' ? null : 'down'))}
            hitSlop={6}
            style={styles.actionBtn}
          >
            <IconThumbDown
              size={16}
              color={feedback === 'down' ? colors.destructive : colors.ink2}
              fill={feedback === 'down' ? colors.destructive : 'none'}
            />
          </Pressable>

          <Pressable hitSlop={6} style={styles.actionBtn}>
            <IconVolume size={16} color={colors.ink2} />
          </Pressable>

          <Pressable hitSlop={6} style={styles.actionBtn}>
            <IconShare size={16} color={colors.ink2} />
          </Pressable>

          {onRegenerate && (
            <Pressable
              onPress={() => onRegenerate(message.id)}
              hitSlop={6}
              style={styles.actionBtn}
            >
              <IconRefresh size={16} color={colors.ink2} />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  userWrapper: {
    width: '100%',
    alignItems: 'flex-end',
    marginVertical: spacing.sm,
  },
  userCapsule: {
    maxWidth: '85%',
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderCurve: radius.borderCurve,
  },
  userText: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
    fontWeight: typography.fontWeight.normal,
  },
  assistantWrapper: {
    width: '100%',
    marginVertical: spacing.md,
  },
  assistantHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginBottom: spacing.xs,
  },
  assistantAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistantAvatarText: {
    color: '#ffffff',
    fontSize: 12,
  },
  assistantName: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: -0.1,
  },
  assistantContent: {
    paddingLeft: spacing.lg + 2,
  },
  assistantText: {
    fontSize: typography.fontSize.sm,
    lineHeight: 22,
    fontWeight: typography.fontWeight.normal,
  },
  streamingIndicator: {
    marginTop: spacing.xs,
  },
  streamingDot: {
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 2,
    paddingLeft: spacing.lg + 2,
    marginTop: spacing.sm,
  },
  actionBtn: {
    paddingVertical: 2,
  },
  actionIcon: {
    fontSize: 14,
  },
});
