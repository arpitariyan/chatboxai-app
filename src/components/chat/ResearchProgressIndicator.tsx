/**
 * src/components/chat/ResearchProgressIndicator.tsx
 *
 * Dedicated live progress indicator for Deep Research:
 * - 4-stage visual progress pipeline
 * - Elapsed seconds timer
 * - Restrained, premium mobile card
 */

import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated } from 'react-native';
import { IconFlask, IconCircleCheck, IconLoader2 } from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius, typography } from '@/theme';

export interface ResearchProgressIndicatorProps {
  progressMessage?: string;
}

interface StepItem {
  id: number;
  label: string;
  detail: string;
}

const STAGES: StepItem[] = [
  { id: 1, label: 'Formulating angles', detail: 'Decomposing query into 4-6 specialized sub-searches' },
  { id: 2, label: 'Multi-source crawling', detail: 'Executing parallel searches & rotating providers' },
  { id: 3, label: 'Content extraction', detail: 'Scraping page excerpts & cross-referencing claims' },
  { id: 4, label: 'PEARL synthesis', detail: 'Reasoning trace & bracketed citation synthesis' },
];

export const ResearchProgressIndicator: React.FC<ResearchProgressIndicatorProps> = ({
  progressMessage = '',
}) => {
  const colors = useThemeColors();
  const [elapsedSec, setElapsedSec] = useState(0);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Soft spin animation for icon
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    ).start();
  }, [spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Determine current active stage based on elapsed time or progress message
  let activeStageId = 1;
  const msg = progressMessage.toLowerCase();

  if (msg.includes('synthesiz') || msg.includes('reason') || elapsedSec >= 16) {
    activeStageId = 4;
  } else if (msg.includes('extract') || msg.includes('scrap') || elapsedSec >= 10) {
    activeStageId = 3;
  } else if (msg.includes('search') || msg.includes('crawl') || elapsedSec >= 4) {
    activeStageId = 2;
  } else {
    activeStageId = 1;
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.inset,
          borderColor: colors.line,
        },
      ]}
    >
      {/* Header with timer and icon */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBox, { backgroundColor: 'rgba(139, 92, 246, 0.12)' }]}>
            <IconFlask size={18} color="#a78bfa" />
          </View>
          <View>
            <Text style={[styles.title, { color: colors.ink }]}>Deep Research</Text>
            <Text style={[styles.subtitle, { color: colors.ink2 }]}>
              {progressMessage || 'Synthesizing verified web findings...'}
            </Text>
          </View>
        </View>

        <View style={[styles.timerBadge, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <IconLoader2 size={13} color="#a78bfa" />
          </Animated.View>
          <Text style={[styles.timerText, { color: colors.ink2 }]}>{elapsedSec}s</Text>
        </View>
      </View>

      {/* Stage Steps List */}
      <View style={styles.stepsList}>
        {STAGES.map((stage) => {
          const isDone = stage.id < activeStageId;
          const isActive = stage.id === activeStageId;

          return (
            <View key={stage.id} style={styles.stepRow}>
              <View style={styles.stepIndicatorCol}>
                {isDone ? (
                  <IconCircleCheck size={16} color="#3b82f6" />
                ) : isActive ? (
                  <View style={styles.activeDotOutline}>
                    <View style={styles.activeDotCore} />
                  </View>
                ) : (
                  <View style={[styles.pendingDot, { backgroundColor: colors.line }]} />
                )}
                {stage.id < 4 && (
                  <View
                    style={[
                      styles.stepConnector,
                      { backgroundColor: isDone ? 'rgba(59, 130, 246, 0.4)' : colors.line },
                    ]}
                  />
                )}
              </View>

              <View style={styles.stepTextCol}>
                <Text
                  style={[
                    styles.stepLabel,
                    {
                      color: isActive ? colors.ink : isDone ? colors.ink2 : colors.ink3,
                      fontWeight: isActive ? '600' : '500',
                    },
                  ]}
                >
                  {stage.label}
                </Text>
                {isActive && (
                  <Text style={[styles.stepDetail, { color: colors.ink2 }]}>
                    {stage.detail}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    flex: 1,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  subtitle: {
    fontSize: typography.fontSize.xs,
    marginTop: 1,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  timerText: {
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  stepsList: {
    paddingTop: 4,
    gap: 2,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs + 2,
  },
  stepIndicatorCol: {
    width: 18,
    alignItems: 'center',
  },
  stepConnector: {
    width: 1.5,
    height: 16,
    marginVertical: 2,
  },
  activeDotOutline: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#a78bfa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeDotCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8b5cf6',
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  stepTextCol: {
    flex: 1,
    paddingBottom: 6,
  },
  stepLabel: {
    fontSize: typography.fontSize.xs,
    lineHeight: 18,
  },
  stepDetail: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
});
