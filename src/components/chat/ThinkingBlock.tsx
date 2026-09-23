import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable, Animated } from 'react-native';
import { IconBrain, IconChevronDown } from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius } from '@/theme';

interface ThinkingBlockProps {
  content: string;
  isFinished?: boolean;
  isLoading?: boolean;
  loadingTitle?: string;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({
  content,
  isFinished = true,
  isLoading = false,
  loadingTitle,
}) => {
  const colors = useThemeColors();
  const [isOpen, setIsOpen] = useState(!isFinished);

  // Auto-close reasoning trace when answer finishes, matching DisplaySummery.jsx
  useEffect(() => {
    if (isFinished && !isLoading) {
      setIsOpen(false);
    }
  }, [isFinished, isLoading]);

  // Pulse animation for loading state
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.5,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isLoading, pulseAnim]);

  if (!isLoading && (!content || !content.trim())) return null;

  return (
    <View style={styles.container}>
      {/* Header Toggle Button */}
      <Pressable
        onPress={() => !isLoading && setIsOpen(!isOpen)}
        hitSlop={6}
        style={({ pressed }) => [
          styles.headerButton,
          {
            backgroundColor: pressed && !isLoading ? colors.surface : 'transparent',
            opacity: pressed && !isLoading ? 0.8 : 1,
          },
        ]}
      >
        <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, opacity: pulseAnim }}>
          <IconBrain size={16} color={colors.ink3} />
          <Text style={[styles.headerTitle, { color: colors.ink2 }]}>
            {isLoading 
              ? (loadingTitle || 'Preparing reasoning...') 
              : isFinished ? 'Reasoning' : 'Thinking…'}
          </Text>
          {!isLoading && (
            <View style={{ transform: [{ rotate: isOpen ? '0deg' : '-90deg' }] }}>
              <IconChevronDown size={15} color={colors.ink3} />
            </View>
          )}
        </Animated.View>
      </Pressable>

      {/* Expandable Reasoning Body */}
      {isOpen && !isLoading && (
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
