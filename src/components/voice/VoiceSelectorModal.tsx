/**
 * src/components/voice/VoiceSelectorModal.tsx
 *
 * 5-Voice Assistant Selector Modal for Mobile APK.
 * Adapts website components/voice/VoiceSelectorModal.jsx.
 * Allows user to choose between the 5 approved assistant voice identities,
 * test sample previews, and persists their preference.
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconX,
  IconCheck,
  IconVolume,
  IconPlayerPlay,
  IconPlayerStop,
} from '@tabler/icons-react-native';
import * as Speech from 'expo-speech';
import {
  ASSISTANT_VOICES,
  AssistantVoice,
  PREVIEW_SAMPLE_TEXT,
} from '../../services/voice/voiceRegistry';
import { useVoicePreferenceStore } from '../../stores/useVoicePreferenceStore';
import { useThemeColors, spacing, radius, typography } from '../../theme';

interface VoiceSelectorModalProps {
  visible: boolean;
  onClose: () => void;
}

export const VoiceSelectorModal: React.FC<VoiceSelectorModalProps> = ({
  visible,
  onClose,
}) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const selectedVoiceId = useVoicePreferenceStore((s) => s.selectedVoiceId);
  const setSelectedVoiceId = useVoicePreferenceStore((s) => s.setSelectedVoiceId);

  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const handleStopPreview = () => {
    try {
      Speech.stop();
    } catch (_) {}
    setPreviewingId(null);
  };

  const handleTogglePreview = (voice: AssistantVoice) => {
    if (previewingId === voice.id) {
      handleStopPreview();
      return;
    }

    handleStopPreview();
    setPreviewingId(voice.id);

    try {
      Speech.speak(PREVIEW_SAMPLE_TEXT, {
        pitch: voice.gender === 'female' ? 1.1 : 0.95,
        rate: 1.0,
        onDone: () => setPreviewingId(null),
        onStopped: () => setPreviewingId(null),
        onError: () => setPreviewingId(null),
      });
    } catch (e) {
      setPreviewingId(null);
    }
  };

  const handleSelect = (voiceId: string) => {
    handleStopPreview();
    setSelectedVoiceId(voiceId);
    onClose();
  };

  const handleCloseModal = () => {
    handleStopPreview();
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCloseModal}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropDismiss} onPress={handleCloseModal} />

        <View
          style={[
            styles.container,
            {
              backgroundColor: colors.surface,
              borderColor: colors.line,
              marginBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIconWrapper, { backgroundColor: 'rgba(0, 230, 195, 0.15)' }]}>
                <IconVolume size={18} color={colors.accent} />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.ink }]}>Assistant Voice</Text>
                <Text style={[styles.subtitle, { color: colors.ink3 }]}>
                  Choose your preferred voice personality
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleCloseModal}
              hitSlop={8}
              style={({ pressed }) => [
                styles.closeButton,
                { opacity: pressed ? 0.6 : 1 },
              ]}
              accessibilityLabel="Close voice modal"
            >
              <IconX size={20} color={colors.ink2} />
            </Pressable>
          </View>

          {/* Voice Cards */}
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {ASSISTANT_VOICES.map((voice) => {
              const isSelected = selectedVoiceId === voice.id;
              const isPreviewing = previewingId === voice.id;

              return (
                <Pressable
                  key={voice.id}
                  onPress={() => handleSelect(voice.id)}
                  style={({ pressed }) => [
                    styles.voiceCard,
                    {
                      backgroundColor: isSelected
                        ? 'rgba(0, 230, 195, 0.12)'
                        : colors.hover || 'rgba(255, 255, 255, 0.05)',
                      borderColor: isSelected ? colors.accent : colors.line,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View style={styles.cardMain}>
                    {/* Voice Avatar */}
                    <View
                      style={[
                        styles.avatar,
                        {
                          backgroundColor: isSelected
                            ? colors.accent
                            : colors.line,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.avatarText,
                          {
                            color: isSelected ? '#ffffff' : colors.ink2,
                          },
                        ]}
                      >
                        {voice.name.charAt(0)}
                      </Text>
                    </View>

                    {/* Voice Info */}
                    <View style={styles.infoWrapper}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.voiceName, { color: colors.ink }]}>
                          {voice.name}
                        </Text>
                        <View style={[styles.badge, { backgroundColor: colors.line }]}>
                          <Text style={[styles.badgeText, { color: colors.ink2 }]}>
                            {voice.gender}
                          </Text>
                        </View>
                        {voice.isDefault && (
                          <View
                            style={[
                              styles.badge,
                              { backgroundColor: 'rgba(0, 230, 195, 0.15)' },
                            ]}
                          >
                            <Text style={[styles.badgeText, { color: colors.accent }]}>
                              Default
                            </Text>
                          </View>
                        )}
                      </View>

                      <Text style={[styles.description, { color: colors.ink2 }]}>
                        {voice.description}
                      </Text>
                      <Text style={[styles.personality, { color: colors.ink3 }]}>
                        {voice.personality}
                      </Text>
                    </View>
                  </View>

                  {/* Actions: Preview Audio + Checkmark */}
                  <View style={styles.cardActions}>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        handleTogglePreview(voice);
                      }}
                      hitSlop={8}
                      style={({ pressed }) => [
                        styles.previewBtn,
                        {
                          backgroundColor: isPreviewing ? colors.accent : colors.line,
                          opacity: pressed ? 0.75 : 1,
                        },
                      ]}
                      accessibilityLabel={
                        isPreviewing ? 'Stop voice sample' : 'Play voice sample'
                      }
                    >
                      {isPreviewing ? (
                        <IconPlayerStop size={14} color="#ffffff" />
                      ) : (
                        <IconPlayerPlay size={14} color={colors.ink} />
                      )}
                    </Pressable>

                    {isSelected && (
                      <View style={styles.checkWrapper}>
                        <IconCheck size={18} color={colors.accent} strokeWidth={2.6} />
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
  },
  backdropDismiss: {
    ...StyleSheet.absoluteFill,
  },
  container: {
    borderRadius: 24,
    borderWidth: 1,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  subtitle: {
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  closeButton: {
    padding: spacing.xs,
  },
  list: {
    marginTop: spacing.xs,
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  voiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
    paddingRight: spacing.sm,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  infoWrapper: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  voiceName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: typography.fontWeight.medium,
    textTransform: 'capitalize',
  },
  description: {
    fontSize: 11,
    fontWeight: typography.fontWeight.medium,
  },
  personality: {
    fontSize: 10,
    marginTop: 1,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  previewBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkWrapper: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
