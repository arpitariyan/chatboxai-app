/**
 * src/components/voice/VoiceSelectorModal.tsx
 *
 * 5-Voice Assistant Selector Modal for Mobile APK.
 * Clean, premium monochrome (black & white) design.
 * - Left: Selection Option (Radio/Check indicator)
 * - Center: Voice Avatar + Info & Metadata
 * - Right: Play/Stop Sample Preview Button
 * Plays real bundled voice preview MP3s via expo-audio (createAudioPlayer).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconX,
  IconCheck,
  IconVolume,
  IconPlayerPlay,
  IconPlayerStop,
} from '@tabler/icons-react-native';
import {
  createAudioPlayer,
  setAudioModeAsync,
} from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import {
  ASSISTANT_VOICES,
  AssistantVoice,
} from '../../services/voice/voiceRegistry';
import { useVoicePreferenceStore } from '../../stores/useVoicePreferenceStore';
import { spacing, radius, typography, useThemeColors } from '../../theme';
import { useTranslation } from '@/i18n';

interface VoiceSelectorModalProps {
  visible: boolean;
  onClose: () => void;
}

export const VoiceSelectorModal: React.FC<VoiceSelectorModalProps> = ({
  visible,
  onClose,
}) => {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const selectedVoiceId = useVoicePreferenceStore((s) => s.selectedVoiceId);
  const setSelectedVoiceId = useVoicePreferenceStore((s) => s.setSelectedVoiceId);

  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const listenerRef = useRef<{ remove: () => void } | null>(null);

  /** Cleanly stop and release the current preview player */
  const stopAndRelease = useCallback(() => {
    if (listenerRef.current) {
      try { listenerRef.current.remove(); } catch (_) {}
      listenerRef.current = null;
    }
    if (playerRef.current) {
      try {
        playerRef.current.pause();
        playerRef.current.remove();
      } catch (_) {}
      playerRef.current = null;
    }
    setPreviewingId(null);
  }, []);

  // Stop preview when modal hides
  useEffect(() => {
    if (!visible) {
      stopAndRelease();
    }
  }, [visible, stopAndRelease]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (listenerRef.current) {
        try { listenerRef.current.remove(); } catch (_) {}
        listenerRef.current = null;
      }
      if (playerRef.current) {
        try {
          playerRef.current.pause();
          playerRef.current.remove();
        } catch (_) {}
        playerRef.current = null;
      }
    };
  }, []);

  const handleTogglePreview = useCallback(async (voice: AssistantVoice) => {
    // Tapping again stops the currently previewing voice
    if (previewingId === voice.id) {
      stopAndRelease();
      return;
    }

    // Stop whatever was playing before
    stopAndRelease();

    try {
      // Configure audio output to speaker
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
        shouldPlayInBackground: false,
      });

      setPreviewingId(voice.id);

      const player = createAudioPlayer(voice.previewAsset);
      playerRef.current = player;

      // Listen for playback-finished to reset state
      const subscription = player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          stopAndRelease();
        }
      });
      listenerRef.current = subscription;

      player.play();
    } catch (err) {
      console.warn('[VoiceSelectorModal] Preview playback error:', err);
      stopAndRelease();
    }
  }, [previewingId, stopAndRelease]);

  const handleSelect = useCallback((voiceId: string) => {
    stopAndRelease();
    setSelectedVoiceId(voiceId);
    setTimeout(() => {
      onClose();
    }, 150);
  }, [stopAndRelease, setSelectedVoiceId, onClose]);

  const handleCloseModal = useCallback(() => {
    stopAndRelease();
    onClose();
  }, [stopAndRelease, onClose]);

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
          {/* Top Sheet Drag Handle */}
          <View style={[styles.dragHandle, { backgroundColor: colors.line }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIconWrapper, { backgroundColor: colors.surface2, borderColor: colors.line }]}>
                <IconVolume size={18} color={colors.ink} strokeWidth={2} />
              </View>
              <View style={styles.headerTextGroup}>
                <Text style={[styles.title, { color: colors.ink }]}>
                  {t('assistantVoice', 'Assistant Voice')}
                </Text>
                <Text style={[styles.subtitle, { color: colors.ink3 }]}>
                  Choose your preferred voice personality
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleCloseModal}
              hitSlop={10}
              style={({ pressed }) => [
                styles.closeButton,
                { backgroundColor: colors.surface2, borderColor: colors.line, opacity: pressed ? 0.6 : 1 },
              ]}
              accessibilityLabel="Close voice modal"
            >
              <IconX size={18} color={colors.ink} strokeWidth={2} />
            </Pressable>
          </View>

          {/* Subtle Divider */}
          <View style={[styles.divider, { backgroundColor: colors.line }]} />

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
                      backgroundColor: isSelected ? colors.accent + '14' : colors.surface2,
                      borderColor: isSelected ? colors.accent : colors.line,
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  {/* LEFT: Selection Option (Radio / Check) */}
                  <View
                    style={[
                      styles.selectIndicator,
                      {
                        backgroundColor: isSelected ? colors.accent : 'transparent',
                        borderColor: isSelected ? colors.accent : colors.line,
                      },
                    ]}
                  >
                    {isSelected && (
                      <IconCheck size={12} color="#ffffff" strokeWidth={3} />
                    )}
                  </View>

                  {/* CENTER: Avatar + Voice Info */}
                  <View style={styles.cardCenter}>
                    {/* Voice Avatar */}
                    <View
                      style={[
                        styles.avatar,
                        {
                          backgroundColor: isSelected ? colors.accent + '25' : colors.surface,
                          borderColor: isSelected ? colors.accent : colors.line,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.avatarText,
                          {
                            color: isSelected ? colors.accent : colors.ink,
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
                        <View style={[styles.genderBadge, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                          <Text style={[styles.genderBadgeText, { color: colors.ink2 }]}>
                            {voice.gender}
                          </Text>
                        </View>
                        {voice.isDefault && (
                          <View style={[styles.defaultBadge, { backgroundColor: colors.accent }]}>
                            <Text style={[styles.defaultBadgeText, { color: '#ffffff' }]}>
                              Default
                            </Text>
                          </View>
                        )}
                      </View>

                      <Text style={[styles.description, { color: colors.ink2 }]} numberOfLines={1}>
                        {voice.description}
                      </Text>
                      <Text style={[styles.personality, { color: colors.ink3 }]} numberOfLines={1}>
                        {voice.personality}
                      </Text>
                    </View>
                  </View>

                  {/* RIGHT: Play Preview Button */}
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      handleTogglePreview(voice);
                    }}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.previewBtn,
                      {
                        backgroundColor: isPreviewing ? colors.accent : colors.surface,
                        borderColor: isPreviewing ? colors.accent : colors.line,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                    accessibilityLabel={
                      isPreviewing ? 'Stop voice sample' : 'Play voice sample'
                    }
                  >
                    {isPreviewing ? (
                      <IconPlayerStop size={14} color="#ffffff" strokeWidth={2.4} />
                    ) : (
                      <IconPlayerPlay size={14} color={colors.ink} strokeWidth={2} />
                    )}
                  </Pressable>
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
  },
  backdropDismiss: {
    ...StyleSheet.absoluteFill,
  },
  container: {
    backgroundColor: '#12131a',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingTop: 12,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  headerIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextGroup: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: spacing.sm,
    marginHorizontal: 4,
  },
  list: {
    marginTop: 2,
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  voiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  voiceCardSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },
  voiceCardUnselected: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  /* LEFT: Select option radio / check indicator */
  selectIndicator: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  selectIndicatorSelected: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  selectIndicatorUnselected: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  /* CENTER: Avatar & text metadata */
  cardCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  avatarUnselected: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
  },
  infoWrapper: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  voiceName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  genderBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  genderBadgeText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.75)',
    textTransform: 'capitalize',
  },
  defaultBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    backgroundColor: '#ffffff',
  },
  defaultBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#000000',
  },
  description: {
    fontSize: 11.5,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.75)',
  },
  personality: {
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.45)',
    marginTop: 1,
  },
  /* RIGHT: Preview play button */
  previewBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  previewBtnActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  previewBtnIdle: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
});
