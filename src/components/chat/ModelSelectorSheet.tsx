import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { IconCircleCheck } from '@tabler/icons-react-native';
import { BottomSheet } from '@/components/common/BottomSheet';
import { useThemeColors, spacing, radius, typography } from '@/theme';

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  badge?: string;
}

interface ModelSelectorSheetProps {
  visible: boolean;
  onClose: () => void;
  selectedModelId: string;
  onSelectModel: (model: ModelOption) => void;
}

export const ModelSelectorSheet: React.FC<ModelSelectorSheetProps> = ({
  visible,
  onClose,
  selectedModelId,
  onSelectModel,
}) => {
  const colors = useThemeColors();

  const models: ModelOption[] = [
    {
      id: 'chatbox-4o',
      name: 'ChatBox AI 4o',
      description: 'Great for everyday conversations, quick questions & code.',
      badge: 'DEFAULT',
    },
    {
      id: 'chatbox-pro',
      name: 'ChatBox Pro (Reasoning)',
      description: 'Advanced reasoning, deep technical analysis & logic.',
      badge: 'PRO',
    },
    {
      id: 'chatbox-vision',
      name: 'ChatBox Vision',
      description: 'Multimodal vision model for image & document inspection.',
      badge: 'VISION',
    },
  ];

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Select AI Model">
      <View style={styles.container}>
        {models.map((m) => {
          const isSelected = m.id === selectedModelId;

          return (
            <Pressable
              key={m.id}
              onPress={() => {
                onSelectModel(m);
                onClose();
              }}
              style={({ pressed }) => [
                styles.modelCard,
                {
                  backgroundColor: isSelected ? colors.inset : colors.surface,
                  borderColor: isSelected ? colors.accent : colors.line,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.nameRow}>
                  <Text style={[styles.modelName, { color: colors.ink }]}>
                    {m.name}
                  </Text>
                  {m.badge ? (
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: isSelected ? colors.accent : colors.line },
                      ]}
                    >
                      <Text style={styles.badgeText}>{m.badge}</Text>
                    </View>
                  ) : null}
                </View>
                {isSelected && (
                  <IconCircleCheck size={18} color={colors.accent} />
                )}
              </View>

              <Text style={[styles.modelDesc, { color: colors.ink2 }]}>
                {m.description}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  modelCard: {
    width: '100%',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.md,
    borderCurve: radius.borderCurve,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  modelName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  checkMark: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modelDesc: {
    fontSize: typography.fontSize.xs,
    lineHeight: 16,
  },
});
