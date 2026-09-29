/**
 * src/components/chat/ResearchProgressIndicator.tsx
 *
 * Minimal, clean progress indicator for Deep Research:
 * - Follows the exact visual language of ThinkingBlock and fileAnalysisLoader
 * - Single-row minimal pill with 1px hairline border
 * - Pulsing IconFlask in soft violet with smooth opacity loop
 * - Dynamic status message reflecting the real research stage
 * - Subtle elapsed seconds timer (tabular numbers)
 */

import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated } from 'react-native';
import { IconFlask } from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius, typography } from '@/theme';

export interface ResearchProgressIndicatorProps {
  progressMessage?: string;
}

export const ResearchProgressIndicator: React.FC<ResearchProgressIndicatorProps> = ({
  progressMessage = '',
}) => {
  const colors = useThemeColors();
  const [elapsedSec, setElapsedSec] = useState(0);

  // Live elapsed timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Subtle pulsing animation matching ThinkingBlock.tsx (800ms ease cycle)
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.45,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // Clean status label
  const displayMessage = progressMessage?.trim() || 'Synthesizing deep research & citations…';

  return (
    <View style={styles.container}>
      {/* Seamless Inline Row — No box, no borders, matches ThinkingBlock */}
      <Animated.View style={[styles.contentRow, { opacity: pulseAnim }]}>
        <IconFlask size={16} color="#a78bfa" />
        <Text style={[styles.statusText, { color: colors.ink2 }]} numberOfLines={1}>
          {displayMessage}
        </Text>
      </Animated.View>

      {/* Discrete Elapsed Timer */}
      {elapsedSec > 0 && (
        <Text style={[styles.timerText, { color: colors.ink3 }]}>
          {elapsedSec}s
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 3,
  },
  statusText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
  },
  timerText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
});
