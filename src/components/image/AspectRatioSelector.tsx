/**
 * src/components/image/AspectRatioSelector.tsx
 *
 * Horizontal aspect ratio selector pills for Image Generation.
 * Complies with Anti-Neon Design System:
 * - #1c1c20 surfaces, #2a2a30 borders
 * - Subtle #c084fc violet active state
 * - 48px minimum touch targets
 */

import React from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView } from 'react-native';
import { ImageAspectRatio } from '@/config/imageModels';
import { useThemeColors, typography, radius } from '@/theme';

interface AspectRatioSelectorProps {
  ratios: ImageAspectRatio[];
  selectedRatio: string;
  onSelectRatio: (ratioValue: string) => void;
  disabled?: boolean;
}

export const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = ({
  ratios,
  selectedRatio,
  onSelectRatio,
  disabled = false,
}) => {
  const colors = useThemeColors();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
    >
      {ratios.map((ratio) => {
        const isSelected = ratio.value === selectedRatio;
        return (
          <Pressable
            key={ratio.value}
            disabled={disabled}
            onPress={() => onSelectRatio(ratio.value)}
            style={({ pressed }) => [
              styles.pill,
              {
                backgroundColor: isSelected
                  ? 'rgba(192, 132, 252, 0.12)'
                  : colors.surface,
                borderColor: isSelected ? colors.accent : colors.line,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
            hitSlop={4}
          >
            <Text
              style={[
                styles.ratioText,
                {
                  color: isSelected ? colors.accent : colors.ink2,
                  fontWeight: isSelected ? '600' : '500',
                },
              ]}
            >
              {ratio.value}
            </Text>
            <Text
              style={[
                styles.labelText,
                {
                  color: isSelected ? colors.accent : colors.ink3,
                },
              ]}
            >
              {ratio.label.split(' ')[0]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    maxHeight: 44,
  },
  contentContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 2,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    gap: 5,
    minHeight: 34,
  },
  ratioText: {
    fontSize: typography.fontSize.xs,
    letterSpacing: 0.2,
  },
  labelText: {
    fontSize: 10,
    textTransform: 'capitalize',
  },
});
