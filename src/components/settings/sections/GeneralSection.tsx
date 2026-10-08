/**
 * src/components/settings/sections/GeneralSection.tsx
 *
 * General Settings Section for ChatBox AI Mobile APK.
 * Features:
 * - Theme: Defaults to 'system' (auto-switches on device theme change) + Dark / Light overrides
 * - Accent Color: Full propagation across APK, Violet selected by default
 * - Language: ISO-style selection format with 12 world languages (EN, HI, ES, FR, DE, JA, etc.)
 * - Chat Font: Reactive font selection across conversation & AI responses
 * - Assistant Voice: 5-voice registry with sample audio preview & Voice AI integration
 * - Voice Orb Gradient: 3D celestial particle palette switcher (Cyan, Purple, Blue, Rose, Amber)
 * - Experience toggles: Compact layout, Reduced motion, Sound effects
 * - Full i18n & reactive translation support
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Switch,
  Alert,
} from 'react-native';
import {
  IconSun,
  IconMoon,
  IconDeviceDesktop,
  IconPalette,
  IconLanguage,
  IconTypography,
  IconMicrophone,
  IconVolume,
  IconPlayerPlay,
  IconPlayerStop,
  IconRotate,
  IconLayout,
  IconBolt,
  IconBell,
  IconCheck,
  IconChevronRight,
} from '@tabler/icons-react-native';
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColors, spacing, radius, typography } from '@/theme';
import {
  usePreferencesStore,
  ThemeMode,
  OrbColorId,
  ACCENT_COLOR_OPTIONS,
  CHAT_FONT_OPTIONS,
  ORB_COLOR_PRESETS,
} from '@/stores/usePreferencesStore';
import { useVoicePreferenceStore } from '@/stores/useVoicePreferenceStore';
import { AssistantVoice } from '@/services/voice/voiceRegistry';
import { VoiceSelectorModal } from '@/components/voice/VoiceSelectorModal';
import { LanguageSelectorModal } from '../LanguageSelectorModal';
import { AccentColor, ChatFont } from '@/theme/types';
import { getChatFontFamily } from '@/theme/typography';
import { useTranslation, AppLanguage } from '@/i18n';

export const GeneralSection: React.FC = () => {
  const colors = useThemeColors();
  const { userProfile } = useAuth();
  const userDocId = userProfile?.$id;
  const { t, activeLanguageInfo } = useTranslation();

  // Preferences from store
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const setThemeMode = usePreferencesStore((s) => s.setThemeMode);
  const accentColor = usePreferencesStore((s) => s.accentColor);
  const setAccentColor = usePreferencesStore((s) => s.setAccentColor);
  const language = usePreferencesStore((s) => s.language);
  const setLanguage = usePreferencesStore((s) => s.setLanguage);
  const chatFont = usePreferencesStore((s) => s.chatFont);
  const setChatFont = usePreferencesStore((s) => s.setChatFont);
  const orbColor = usePreferencesStore((s) => s.orbColor);
  const setOrbColor = usePreferencesStore((s) => s.setOrbColor);
  const compactMode = usePreferencesStore((s) => s.compactMode);
  const setCompactMode = usePreferencesStore((s) => s.setCompactMode);
  const reducedMotion = usePreferencesStore((s) => s.reducedMotion);
  const setReducedMotion = usePreferencesStore((s) => s.setReducedMotion);
  const soundEffects = usePreferencesStore((s) => s.soundEffects);
  const setSoundEffects = usePreferencesStore((s) => s.setSoundEffects);
  const resetDefaults = usePreferencesStore((s) => s.resetDefaults);

  // Modals state
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isFontExpanded, setIsFontExpanded] = useState(false);

  // Assistant Voice
  const selectedVoice = useVoicePreferenceStore((s) => s.getSelectedVoice());

  // Voice Sample Preview Audio
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const listenerRef = useRef<{ remove: () => void } | null>(null);

  const stopPreview = useCallback(() => {
    if (listenerRef.current) {
      try { listenerRef.current.remove(); } catch {}
      listenerRef.current = null;
    }
    if (playerRef.current) {
      try {
        playerRef.current.pause();
        playerRef.current.remove();
      } catch {}
      playerRef.current = null;
    }
    setPreviewingVoiceId(null);
  }, []);

  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, [stopPreview]);

  const handleToggleSamplePreview = useCallback(async (voice: AssistantVoice) => {
    if (previewingVoiceId === voice.id) {
      stopPreview();
      return;
    }

    stopPreview();

    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      });

      const player = createAudioPlayer(voice.previewAsset);
      playerRef.current = player;
      setPreviewingVoiceId(voice.id);

      const sub = player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          stopPreview();
        }
      });
      listenerRef.current = sub;

      player.play();
    } catch (err) {
      console.warn('[GeneralSection] Audio preview error:', err);
      stopPreview();
    }
  }, [previewingVoiceId, stopPreview]);

  const handleReset = () => {
    Alert.alert(
      t('restoreDefaults', 'Restore Defaults'),
      t('restoreDefaultSettings', 'Reset all appearance, voice, and experience preferences to default values?'),
      [
        { text: t('cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('restoreDefaults', 'Restore'),
          style: 'destructive',
          onPress: () => {
            resetDefaults(userDocId);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* ─── GROUP 1: APPEARANCE & THEME ───────────────────────────────────── */}
      <Text style={[styles.sectionHeading, { color: colors.ink3 }]}>
        {t('appearanceTheme', 'Appearance & Theme')}
      </Text>

      <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        {/* Row 1: Theme Mode */}
        <View style={styles.settingBlock}>
          <View style={styles.rowHeader}>
            <View style={[styles.iconBox, { backgroundColor: colors.surface2 }]}>
              {themeMode === 'system' ? (
                <IconDeviceDesktop size={18} color={colors.ink} strokeWidth={1.8} />
              ) : themeMode === 'dark' ? (
                <IconMoon size={18} color={colors.ink} strokeWidth={1.8} />
              ) : (
                <IconSun size={18} color={colors.ink} strokeWidth={1.8} />
              )}
            </View>
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>
                {t('theme', 'Theme')}
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.ink3 }]}>
                {themeMode === 'system'
                  ? `${t('system', 'System')} (Auto-matches device)`
                  : themeMode === 'dark'
                    ? t('dark', 'Dark')
                    : t('light', 'Light')}
              </Text>
            </View>
          </View>

          {/* Segmented Theme Picker (System first by default) */}
          <View style={[styles.segmentedBar, { backgroundColor: colors.surface2, borderColor: colors.line }]}>
            {(['system', 'dark', 'light'] as ThemeMode[]).map((mode) => {
              const isSelected = themeMode === mode;
              const ModeIcon = mode === 'system' ? IconDeviceDesktop : mode === 'dark' ? IconMoon : IconSun;
              const label = mode === 'system' ? t('system', 'System') : mode === 'dark' ? t('dark', 'Dark') : t('light', 'Light');

              return (
                <Pressable
                  key={mode}
                  onPress={() => setThemeMode(mode)}
                  style={({ pressed }) => [
                    styles.segmentBtn,
                    isSelected && [
                      styles.segmentBtnActive,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.line,
                      },
                    ],
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <ModeIcon
                    size={15}
                    color={isSelected ? colors.ink : colors.ink3}
                    strokeWidth={isSelected ? 2 : 1.8}
                  />
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        color: isSelected ? colors.ink : colors.ink3,
                        fontWeight: isSelected ? '600' : '500',
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.line }]} />

        {/* Row 2: Accent Color Palette */}
        <View style={styles.settingBlock}>
          <View style={styles.rowHeader}>
            <View style={[styles.iconBox, { backgroundColor: colors.surface2 }]}>
              <IconPalette size={18} color={colors.ink} strokeWidth={1.8} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>
                {t('accentColor', 'Accent Color')}
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.ink3 }]}>
                {t('accentColorDesc', 'Primary action, ring, and selection highlights')}
              </Text>
            </View>
          </View>

          {/* Color Swatches */}
          <View style={styles.swatchRow}>
            {ACCENT_COLOR_OPTIONS.map((opt) => {
              const isSelected = accentColor === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setAccentColor(opt.value, userDocId)}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.colorCircle,
                    { backgroundColor: opt.hex },
                    isSelected && [
                      styles.colorCircleSelected,
                      { borderColor: colors.ink },
                    ],
                    pressed && { opacity: 0.8 },
                  ]}
                  accessibilityLabel={`Select ${opt.name} accent`}
                >
                  {isSelected && (
                    <IconCheck size={16} color="#ffffff" strokeWidth={2.5} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* ─── GROUP 2: LANGUAGE & TYPOGRAPHY ─────────────────────────────────── */}
      <Text style={[styles.sectionHeading, { color: colors.ink3 }]}>
        {t('language', 'Language')} & {t('chatFont', 'Typography')}
      </Text>

      <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        {/* ISO-Style Language Selection Card Row */}
        <Pressable
          onPress={() => setIsLanguageModalOpen(true)}
          style={({ pressed }) => [
            styles.settingBlockInteractive,
            pressed && { opacity: 0.8 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Open language selection"
        >
          <View style={styles.rowHeader}>
            <View style={[styles.iconBox, { backgroundColor: colors.surface2 }]}>
              <IconLanguage size={18} color={colors.ink} strokeWidth={1.8} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>
                {t('language', 'Language')}
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.ink3 }]}>
                {activeLanguageInfo.nativeName} • {activeLanguageInfo.name}
              </Text>
            </View>

            {/* ISO Pill Badge */}
            <View
              style={[
                styles.isoPill,
                {
                  backgroundColor: colors.surface2,
                  borderColor: colors.line,
                },
              ]}
            >
              <Text style={[styles.isoPillText, { color: colors.accent }]}>
                {activeLanguageInfo.iso}
              </Text>
            </View>

            <IconChevronRight size={18} color={colors.ink3} strokeWidth={1.8} />
          </View>
        </Pressable>

        <View style={[styles.divider, { backgroundColor: colors.line }]} />

        {/* Chat Font Row */}
        <View style={styles.settingBlock}>
          <Pressable
            onPress={() => setIsFontExpanded((prev) => !prev)}
            style={({ pressed }) => [
              styles.rowHeader,
              pressed && { opacity: 0.8 },
            ]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.surface2 }]}>
              <IconTypography size={18} color={colors.ink} strokeWidth={1.8} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>
                {t('chatFont', 'Chat Font')}
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.ink3 }]}>
                {CHAT_FONT_OPTIONS.find((f) => f.value === chatFont)?.label || 'Default'}
              </Text>
            </View>
            <IconChevronRight
              size={18}
              color={colors.ink3}
              strokeWidth={1.8}
              style={{ transform: [{ rotate: isFontExpanded ? '90deg' : '0deg' }] }}
            />
          </Pressable>

          {/* Expanded Font Selector */}
          {isFontExpanded && (
            <View style={styles.fontListGrid}>
              {CHAT_FONT_OPTIONS.map((f) => {
                const isSelected = chatFont === f.value;
                const resolvedFont = getChatFontFamily(f.value as ChatFont);
                return (
                  <Pressable
                    key={f.value}
                    onPress={() => setChatFont(f.value as ChatFont, userDocId)}
                    style={({ pressed }) => [
                      styles.fontPill,
                      {
                        backgroundColor: isSelected ? colors.surface2 : 'transparent',
                        borderColor: isSelected ? colors.accent : colors.line,
                      },
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.fontPillText,
                        {
                          fontFamily: resolvedFont,
                          color: isSelected ? colors.ink : colors.ink3,
                          fontWeight: isSelected ? '600' : '400',
                        },
                      ]}
                    >
                      {f.label}
                    </Text>
                    {isSelected && (
                      <IconCheck size={14} color={colors.accent} strokeWidth={2.5} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </View>

      {/* ─── GROUP 3: VOICE AI & CELESTIAL ORB ───────────────────────────────── */}
      <Text style={[styles.sectionHeading, { color: colors.ink3 }]}>
        {t('assistantVoice', 'Assistant Voice')} & {t('voiceOrbGradient', 'Voice Orb')}
      </Text>

      <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        {/* Assistant Voice Row */}
        <View style={styles.settingBlock}>
          <View style={styles.rowHeader}>
            <View style={[styles.iconBox, { backgroundColor: colors.surface2 }]}>
              <IconMicrophone size={18} color={colors.ink} strokeWidth={1.8} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>
                {t('assistantVoice', 'Assistant Voice')}
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.ink3 }]}>
                {selectedVoice.name} • {selectedVoice.description}
              </Text>
            </View>

            {/* Audio Preview Button */}
            <Pressable
              onPress={() => handleToggleSamplePreview(selectedVoice)}
              hitSlop={8}
              style={({ pressed }) => [
                styles.previewAudioBtn,
                {
                  backgroundColor: previewingVoiceId === selectedVoice.id ? colors.accent : colors.surface2,
                  borderColor: colors.line,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
              accessibilityLabel="Listen to voice sample"
            >
              {previewingVoiceId === selectedVoice.id ? (
                <IconPlayerStop size={14} color="#ffffff" strokeWidth={2.4} />
              ) : (
                <IconPlayerPlay size={14} color={colors.ink} strokeWidth={2} />
              )}
            </Pressable>

            {/* Change Voice Button */}
            <Pressable
              onPress={() => setIsVoiceModalOpen(true)}
              style={({ pressed }) => [
                styles.changeBtn,
                {
                  backgroundColor: colors.surface2,
                  borderColor: colors.line,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text style={[styles.changeBtnText, { color: colors.ink }]}>
                {t('change', 'Change')}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.line }]} />

        {/* Voice Orb Color Swatches */}
        <View style={styles.settingBlock}>
          <View style={styles.rowHeader}>
            <View style={[styles.iconBox, { backgroundColor: colors.surface2 }]}>
              <IconVolume size={18} color={colors.ink} strokeWidth={1.8} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>
                {t('voiceOrbGradient', 'Voice Orb Gradient')}
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.ink3 }]}>
                {t('voiceOrbDesc', '3D Fibonacci celestial particle palette')}
              </Text>
            </View>
          </View>

          {/* Orb Presets */}
          <View style={styles.orbPresetRow}>
            {Object.values(ORB_COLOR_PRESETS).map((preset) => {
              const isSelected = orbColor === preset.id;
              return (
                <Pressable
                  key={preset.id}
                  onPress={() => setOrbColor(preset.id as OrbColorId)}
                  style={({ pressed }) => [
                    styles.orbPresetItem,
                    {
                      backgroundColor: isSelected ? colors.surface2 : 'transparent',
                      borderColor: isSelected ? preset.hex : colors.line,
                    },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <View style={[styles.orbDot, { backgroundColor: preset.hex }]} />
                  <Text
                    style={[
                      styles.orbPresetText,
                      {
                        color: isSelected ? colors.ink : colors.ink3,
                        fontWeight: isSelected ? '600' : '500',
                      },
                    ]}
                  >
                    {preset.name}
                  </Text>
                  {isSelected && (
                    <IconCheck size={13} color={preset.hex} strokeWidth={2.5} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* ─── GROUP 4: EXPERIENCE & PERFORMANCE ──────────────────────────────── */}
      <Text style={[styles.sectionHeading, { color: colors.ink3 }]}>
        {t('experiencePerf', 'Experience & Performance')}
      </Text>

      <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        {/* Compact Mode Switch */}
        <View style={styles.switchRow}>
          <View style={[styles.iconBox, { backgroundColor: colors.surface2 }]}>
            <IconLayout size={18} color={colors.ink} strokeWidth={1.8} />
          </View>
          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.ink }]}>
              {t('compactLayout', 'Compact Layout')}
            </Text>
            <Text style={[styles.rowSubtitle, { color: colors.ink3 }]}>
              {t('compactLayoutDesc', 'Denser spacing to show more messages on screen')}
            </Text>
          </View>
          <Switch
            value={compactMode}
            onValueChange={(val) => setCompactMode(val)}
            trackColor={{ false: colors.line2, true: colors.accent }}
            thumbColor="#ffffff"
          />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.line }]} />

        {/* Reduced Motion Switch */}
        <View style={styles.switchRow}>
          <View style={[styles.iconBox, { backgroundColor: colors.surface2 }]}>
            <IconBolt size={18} color={colors.ink} strokeWidth={1.8} />
          </View>
          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.ink }]}>
              {t('reducedMotion', 'Reduced Motion')}
            </Text>
            <Text style={[styles.rowSubtitle, { color: colors.ink3 }]}>
              {t('reducedMotionDesc', 'Minimizes particle and transition animations')}
            </Text>
          </View>
          <Switch
            value={reducedMotion}
            onValueChange={(val) => setReducedMotion(val)}
            trackColor={{ false: colors.line2, true: colors.accent }}
            thumbColor="#ffffff"
          />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.line }]} />

        {/* Sound Effects Switch */}
        <View style={styles.switchRow}>
          <View style={[styles.iconBox, { backgroundColor: colors.surface2 }]}>
            <IconBell size={18} color={colors.ink} strokeWidth={1.8} />
          </View>
          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.ink }]}>
              {t('soundEffects', 'Sound Effects')}
            </Text>
            <Text style={[styles.rowSubtitle, { color: colors.ink3 }]}>
              {t('soundEffectsDesc', 'Audio cues upon speech synthesis and AI actions')}
            </Text>
          </View>
          <Switch
            value={soundEffects}
            onValueChange={(val) => setSoundEffects(val)}
            trackColor={{ false: colors.line2, true: colors.accent }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      {/* ─── RESET ACTION ──────────────────────────────────────────────────── */}
      <View style={styles.restoreWrap}>
        <Pressable
          onPress={handleReset}
          style={({ pressed }) => [
            styles.restoreBtn,
            {
              backgroundColor: colors.surface,
              borderColor: colors.line,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <IconRotate size={16} color={colors.ink3} strokeWidth={1.8} />
          <Text style={[styles.restoreBtnText, { color: colors.ink2 }]}>
            {t('restoreDefaultSettings', 'Restore Default Settings')}
          </Text>
        </Pressable>
      </View>

      {/* ISO Language Selector Modal */}
      <LanguageSelectorModal
        visible={isLanguageModalOpen}
        selectedLanguage={language as AppLanguage}
        onSelectLanguage={(code) => setLanguage(code, userDocId)}
        onClose={() => setIsLanguageModalOpen(false)}
      />

      {/* Voice Selector Modal Sheet */}
      <VoiceSelectorModal
        visible={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingBottom: spacing.lg,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  groupCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingBlock: {
    padding: spacing.md,
  },
  settingBlockInteractive: {
    padding: spacing.md,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextCol: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  rowSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  isoPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  isoPillText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  segmentedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    marginTop: spacing.sm + 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8,
    gap: 6,
  },
  segmentBtnActive: {
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: {
    fontSize: 12.5,
  },
  swatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: spacing.sm + 4,
  },
  colorCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCircleSelected: {
    borderWidth: 2,
  },
  fontListGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.sm + 4,
    paddingTop: 4,
  },
  fontPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  fontPillText: {
    fontSize: 13,
  },
  previewAudioBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  changeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  changeBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  orbPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.sm + 4,
  },
  orbPresetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  orbDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  orbPresetText: {
    fontSize: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: 12,
  },
  restoreWrap: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 8,
  },
  restoreBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
