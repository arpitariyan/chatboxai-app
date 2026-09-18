import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { IconBrain, IconChevronDown } from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius } from '@/theme';

interface ThinkingBlockProps {
  content: string;
  isFinished?: boolean;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({
  content,
  isFinished = true,
}) => {
  const colors = useThemeColors();
  const [isOpen, setIsOpen] = useState(!isFinished);

  // Auto-close reasoning trace when answer finishes, matching DisplaySummery.jsx
  useEffect(() => {
    if (isFinished) {
      setIsOpen(false);
    }
  }, [isFinished]);

  if (!content || !content.trim()) return null;

  return (
    <View style={styles.container}>
      {/* Header Toggle Button */}
      <Pressable
        onPress={() => setIsOpen(!isOpen)}
        hitSlop={6}
        style={({ pressed }) => [
          styles.headerButton,
          {
            backgroundColor: pressed ? colors.surface : 'transparent',
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <IconBrain size={16} color={colors.ink3} />
        <Text style={[styles.headerTitle, { color: colors.ink2 }]}>
          {isFinished ? 'Reasoning' : 'Thinking…'}
        </Text>
        <View style={{ transform: [{ rotate: isOpen ? '0deg' : '-90deg' }] }}>
          <IconChevronDown size={15} color={colors.ink3} />
        </View>
      </Pressable>

      {/* Expandable Reasoning Body */}
      {isOpen && (
        <View style={styles.bodyWrapper}>
          <View style={[styles.indicatorRail, { backgroundColor: colors.lineStrong }]} />
          <View style={styles.contentContainer}>
            <Text style={[styles.reasoningText, { color: colors.ink2 }]}>
              {content.trim()}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
    width: '100%',
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 0,
    borderRadius: radius.sm,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  bodyWrapper: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    marginLeft: 0,
    paddingLeft: spacing.sm + 4,
  },
  indicatorRail: {
    position: 'absolute',
    left: 0,
    top: 2,
    bottom: 2,
    width: 2,
    borderRadius: 1,
  },
  contentContainer: {
    flex: 1,
  },
  reasoningText: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'monospace',
  },
});
