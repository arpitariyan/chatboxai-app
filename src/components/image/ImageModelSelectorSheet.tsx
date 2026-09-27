/**
 * src/components/image/ImageModelSelectorSheet.tsx
 *
 * Refined, minimal bottom sheet for selecting image generation models.
 * Complies with specification:
 * - Shows only the model name and appropriate icon
 * - No provider names
 * - No model descriptions
 * - Minimal, clean layout consistent with the rest of the APK
 */

import React from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView } from 'react-native';
import {
  IconCheck,
  IconPhoto,
  IconSparkles,
  IconWand,
} from '@tabler/icons-react-native';
import { BottomSheet } from '@/components/common/BottomSheet';
import {
  IMAGE_MODELS,
  ImageModelConfig,
} from '@/config/imageModels';
import { useThemeColors, typography, radius, spacing } from '@/theme';

interface ImageModelSelectorSheetProps {
  visible: boolean;
  onClose: () => void;
  selectedModelId: string;
  onSelectModel: (model: ImageModelConfig) => void;
}

export const ImageModelSelectorSheet: React.FC<ImageModelSelectorSheetProps> = ({
  visible,
  onClose,
  selectedModelId,
  onSelectModel,
}) => {
  const colors = useThemeColors();

  // Deduplicate by model id
  const uniqueModels: ImageModelConfig[] = [];
  const seen = new Set<string>();
  for (const model of IMAGE_MODELS) {
    if (!seen.has(model.id)) {
      seen.add(model.id);
      uniqueModels.push(model);
    }
  }

  const getModelIcon = (model: ImageModelConfig, isSelected: boolean) => {
    const iconColor = isSelected ? colors.ink : colors.ink2;
    if (model.provider === 'leonardo') {
      return <IconSparkles size={18} color={iconColor} strokeWidth={1.8} />;
    }
    if (model.supportsImageToImage) {
      return <IconWand size={18} color={iconColor} strokeWidth={1.8} />;
    }
    return <IconPhoto size={18} color={iconColor} strokeWidth={1.8} />;
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Select Model">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {uniqueModels.map((model) => {
          const isSelected = model.id === selectedModelId;

          return (
            <Pressable
              key={model.id}
              onPress={() => {
                onSelectModel(model);
                onClose();
              }}
              style={({ pressed }) => [
                styles.modelRow,
                {
                  backgroundColor: isSelected
                    ? 'rgba(192, 132, 252, 0.08)'
                    : colors.surface,
                  borderColor: isSelected ? colors.accent : colors.line,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor: isSelected
                      ? 'rgba(192, 132, 252, 0.16)'
                      : colors.inset,
                  },
                ]}
              >
                {getModelIcon(model, isSelected)}
              </View>

              <Text
                style={[
                  styles.modelName,
                  {
                    color: isSelected ? colors.ink : colors.ink,
                    fontWeight: isSelected ? '600' : '400',
                  },
                ]}
              >
                {model.name}
              </Text>

              {model.supportsImageToImage && (
                <View
                  style={[
                    styles.tagBadge,
                    {
                      backgroundColor: isSelected
                        ? 'rgba(192, 132, 252, 0.18)'
                        : 'rgba(255, 255, 255, 0.06)',
                      borderColor: isSelected
                        ? 'rgba(192, 132, 252, 0.35)'
                        : 'rgba(255, 255, 255, 0.1)',
                    },
                  ]}
                >
                  <Text style={[styles.tagBadgeText, { color: colors.accent }]}>
                    {model.maxReferenceImages && model.maxReferenceImages > 1
                      ? `Img2Img (${model.maxReferenceImages} refs)`
                      : 'Img2Img'}
                  </Text>
                </View>
              )}

              {isSelected && (
                <View style={styles.checkWrap}>
                  <IconCheck size={18} color={colors.accent} strokeWidth={2.2} />
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 380,
  },
  container: {
    paddingVertical: spacing.sm,
    gap: spacing.xs + 2,
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 48,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm + 2,
  },
  modelName: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    letterSpacing: -0.1,
  },
  tagBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
    marginRight: 6,
  },
  tagBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  checkWrap: {
    marginLeft: spacing.xs,
  },
});
