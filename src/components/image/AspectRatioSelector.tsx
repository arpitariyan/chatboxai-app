/**
 * src/components/image/AspectRatioSelector.tsx
 *
 * Professional, minimal aspect ratio selector for Image Generation.
 * Displays proportional frame icons alongside standard ratio notation (1:1, 16:9, etc.)
 * Strictly follows the Anti-Neon design system.
 */

import React from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView } from 'react-native';
import { ImageAspectRatio } from '@/config/imageModels';
import { useThemeColors, radius } from '@/theme';

interface AspectRatioSelectorProps {
  ratios: ImageAspectRatio[];
  selectedRatio: string;
  onSelectRatio: (ratioValue: string) => void;
  disabled?: boolean;
}

const AspectRatioFrame: React.FC<{ ratio: string; isSelected: boolean }> = ({
  ratio,
  isSelected,
}) => {
  const colors = useThemeColors();
  const strokeColor = isSelected ? colors.ink : colors.ink3;

  let width = 12;
  let height = 12;

  if (ratio === '16:9') {
    width = 16;
    height = 9;
  } else if (ratio === '9:16') {
    width = 9;
    height = 16;
  } else if (ratio === '4:3') {
    width = 14;
    height = 10.5;
  } else if (ratio === '3:4') {
    width = 10.5;
    height = 14;
  } else if (ratio === '2:3') {
    width = 10;
    height = 15;
  } else if (ratio === '3:2') {
    width = 15;
    height = 10;
  }

  return (
    <View style={styles.frameContainer}>
      <View
        style={[
          styles.frameBox,
          {
            width,
            height,
            borderColor: strokeColor,
          },
        ]}
      />
    </View>
  );
};

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
                  ? (colors.isDark ? '#27272a' : colors.surface2)
                  : (colors.isDark ? '#1c1c1e' : colors.surface),
                borderColor: isSelected ? (colors.accent || colors.ink) : colors.line,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
            hitSlop={4}
          >
            <AspectRatioFrame ratio={ratio.value} isSelected={isSelected} />
            <Text
              style={[
                styles.ratioText,
                {
                  color: isSelected ? colors.ink : colors.ink2,
                  fontWeight: isSelected ? '600' : '500',
                },
              ]}
            >
              {ratio.value}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    maxHeight: 34,
  },
  contentContainer: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 2,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    gap: 5,
    minHeight: 28,
  },
  frameContainer: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameBox: {
    borderRadius: 2,
    borderWidth: 1.2,
  },
  ratioText: {
    fontSize: 11,
    letterSpacing: 0.1,
  },
});
