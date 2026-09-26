/**
 * src/components/image/ImageModelSelectorSheet.tsx
 *
 * Bottom sheet for selecting image generation models.
 * Shows model names, providers (Hugging Face vs Leonardo AI), descriptions,
 * and capability badges (e.g. "Image-to-Image").
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

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Select Image Model">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {uniqueModels.map((model) => {
          const isSelected = model.id === selectedModelId;
          const isLeonardo = model.provider === 'leonardo';

          return (
            <Pressable
              key={model.id}
              onPress={() => {
                onSelectModel(model);
                onClose();
              }}
              style={({ pressed }) => [
                styles.modelCard,
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
                  styles.iconBox,
                  {
                    backgroundColor: isSelected
                      ? 'rgba(192, 132, 252, 0.16)'
                      : colors.inset,
                  },
                ]}
              >
                {isLeonardo ? (
                  <IconSparkles
                    size={20}
                    color={isSelected ? colors.accent : colors.ink}
                  />
                ) : model.supportsImageToImage ? (
                  <IconWand
                    size={20}
                    color={isSelected ? colors.accent : colors.ink}
                  />
                ) : (
                  <IconPhoto
                    size={20}
                    color={isSelected ? colors.accent : colors.ink}
                  />
                )}
              </View>

              <View style={styles.content}>
                <View style={styles.titleRow}>
                  <Text
                    style={[
                      styles.title,
                      { color: isSelected ? colors.accent : colors.ink },
                    ]}
                  >
                    {model.name}
                  </Text>
                  {model.supportsImageToImage && (
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor: 'rgba(59, 130, 246, 0.15)',
                          borderColor: 'rgba(59, 130, 246, 0.3)',
                        },
                      ]}
                    >
                      <Text style={[styles.badgeText, { color: '#60a5fa' }]}>
                        Image-to-Image
                      </Text>
                    </View>
                  )}
                  {isLeonardo && (
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor: 'rgba(234, 179, 8, 0.15)',
                          borderColor: 'rgba(234, 179, 8, 0.3)',
                        },
                      ]}
                    >
                      <Text style={[styles.badgeText, { color: '#facc15' }]}>
                        Leonardo
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[styles.desc, { color: colors.ink3 }]}
                  numberOfLines={2}
                >
                  {model.desc}
                </Text>
              </View>

              {isSelected && (
                <View style={styles.checkWrap}>
                  <IconCheck size={18} color={colors.accent} strokeWidth={2.5} />
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
    maxHeight: 460,
  },
  container: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  modelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.md,
    minHeight: 64,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  desc: {
    fontSize: typography.fontSize.xs,
    lineHeight: 16,
  },
  checkWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
