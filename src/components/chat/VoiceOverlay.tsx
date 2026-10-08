/**
 * src/components/chat/VoiceOverlay.tsx
 *
 * Dedicated Full-Screen Voice AI Experience for ChatBox AI APK.
 * Features a premium shared-element transition:
 *   - Orb spawns at the call button's screen coordinates
 *   - Animates (scale + translate) to the center of the screen
 *   - Background and UI fade in behind the travelling orb
 *
 * Voice AI Pipeline:
 *   - User speaks → Groq Whisper STT → AI generates → ElevenLabs / native TTS
 *   - Central 3D Fibonacci Particle Orb reacting to real-time Voice AI states
 *   - 5-voice registry (Sarah, Charlie, George, Antoni, Bill)
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  AppState,
  AppStateStatus,
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconX,
  IconMicrophone,
  IconMicrophoneOff,
  IconPhoneOff,
} from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius, typography } from '../../theme';
import { useTranslation } from '@/i18n';
import { VoiceOrb, VoiceOrbState } from '../voice/VoiceOrb';
import { VoiceSelectorModal } from '../voice/VoiceSelectorModal';
import { usePreferencesStore, ORB_COLOR_PRESETS } from '../../stores/usePreferencesStore';
import { useVoicePreferenceStore } from '../../stores/useVoicePreferenceStore';
import { useSpeechToText, STTError } from '../../hooks/useSpeechToText';
import { voiceAiService } from '../../services/voice/voiceAiService';
import type { VoiceButtonOrigin } from './Composer';
import { generateCurvedTrajectory } from './voiceTransitionCurve';

const hexToRgba = (hex: string, alpha: number): string => {
  const clean = (hex || '#00E6C3').replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// ──────────────────────────────────────────────────────────────────────────────
// Transition timing constants
// ──────────────────────────────────────────────────────────────────────────────
const ANIM_DURATION_TOTAL = 950; // ms — total curved trajectory transition

interface VoiceOverlayProps {
  visible: boolean;
  onClose: () => void;
  /** If provided, the orb will animate along a curved path from this position on open */
  buttonOrigin?: VoiceButtonOrigin | null;
}

export const VoiceOverlay: React.FC<VoiceOverlayProps> = ({
  visible,
  onClose,
  buttonOrigin,
}) => {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const isDark = colors.isDark;
  const insets = useSafeAreaInsets();
  const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

  // ── Assistant Voice & Orb Color State ─────────────────────────────────────
  const selectedVoice = useVoicePreferenceStore((s) => s.getSelectedVoice());
  const selectedVoiceId = useVoicePreferenceStore((s) => s.selectedVoiceId);
  const orbColor = usePreferencesStore((s) => s.orbColor);
  const orbPreset = ORB_COLOR_PRESETS[orbColor] || ORB_COLOR_PRESETS.cyan;
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  // ── Voice AI Session States ────────────────────────────────────────────────
  const [voiceState, setVoiceState] = useState<VoiceOrbState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [statusMessage, setStatusMessage] = useState(t('tapMicToStart', 'Tap mic to start talking'));
  const [lastTranscript, setLastTranscript] = useState('');
  const [lastAiResponse, setLastAiResponse] = useState('');
  const [liveAudioLevel, setLiveAudioLevel] = useState(0);

  // ── Transition Animation State ─────────────────────────────────────────────
  const [uiReady, setUiReady] = useState(false);
  // Single master progress value driving all synchronized interpolations
  const animProgress = useRef(new Animated.Value(0)).current;

  // ── Multi-turn conversation history ───────────────────────────────────────
  const conversationHistoryRef = useRef<Array<{ role: string; content: string }>>([]);
  const isSessionActiveRef = useRef(false);

  // ──────────────────────────────────────────────────────────────────────────
  // Curved trajectory calculation (Catmull-Rom spline with arc-length lookup)
  // ──────────────────────────────────────────────────────────────────────────
  const curveTable = useMemo(() => {
    if (!buttonOrigin) return null;
    const destX = SCREEN_W / 2;
    const destY = SCREEN_H / 2;
    return generateCurvedTrajectory({
      buttonX: buttonOrigin.x,
      buttonY: buttonOrigin.y,
      destX,
      destY,
      screenWidth: SCREEN_W,
      screenHeight: SCREEN_H,
    });
  }, [buttonOrigin, SCREEN_W, SCREEN_H]);

  // Background fade: home screen remains visible underneath at t=0, darkens smoothly
  const bgOpacity = useMemo(() => {
    return animProgress.interpolate({
      inputRange: [0, 0.42],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });
  }, [animProgress]);

  // Orb scale: tiny at button (matching button size) -> expands along curve -> settles at 1.0
  const orbScale = useMemo(() => {
    if (!buttonOrigin) {
      return animProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0.85, 1.0],
      });
    }
    return animProgress.interpolate({
      inputRange: [0, 0.12, 0.45, 0.82, 1.0],
      outputRange: [0.08, 0.22, 0.64, 0.94, 1.0],
      extrapolate: 'clamp',
    });
  }, [animProgress, buttonOrigin]);

  // Orb position: follows the curved trajectory table (or stays at center if no button origin)
  const orbTranslateX = useMemo(() => {
    if (!curveTable) {
      return animProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 0] });
    }
    return animProgress.interpolate({
      inputRange: curveTable.inputRange,
      outputRange: curveTable.outputRangeX,
    });
  }, [animProgress, curveTable]);

  const orbTranslateY = useMemo(() => {
    if (!curveTable) {
      return animProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 0] });
    }
    return animProgress.interpolate({
      inputRange: curveTable.inputRange,
      outputRange: curveTable.outputRangeY,
    });
  }, [animProgress, curveTable]);

  // Luminous energy aura: glows softly during movement, gently dissolves as orb settles
  const haloOpacity = useMemo(() => {
    if (!buttonOrigin) {
      return animProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 0] });
    }
    return animProgress.interpolate({
      inputRange: [0, 0.15, 0.55, 0.82, 1.0],
      outputRange: [0, 0.70, 0.85, 0.35, 0],
      extrapolate: 'clamp',
    });
  }, [animProgress, buttonOrigin]);

  const haloScale = useMemo(() => {
    return animProgress.interpolate({
      inputRange: [0, 0.2, 0.6, 1.0],
      outputRange: [0.35, 0.85, 1.18, 1.0],
      extrapolate: 'clamp',
    });
  }, [animProgress]);

  // Subtle curved motion trail particles following the orb
  const trailsInterpolations = useMemo(() => {
    if (!curveTable) return [];
    return curveTable.trails.map((tr) => ({
      translateX: animProgress.interpolate({
        inputRange: curveTable.inputRange,
        outputRange: tr.outputRangeX,
      }),
      translateY: animProgress.interpolate({
        inputRange: curveTable.inputRange,
        outputRange: tr.outputRangeY,
      }),
      opacity: animProgress.interpolate({
        inputRange: curveTable.inputRange,
        outputRange: tr.outputRangeOpacity,
      }),
      scale: animProgress.interpolate({
        inputRange: curveTable.inputRange,
        outputRange: tr.outputRangeScale,
      }),
    }));
  }, [animProgress, curveTable]);

  // UI opacity: reveals smoothly as the orb reaches the central region
  const uiOpacity = useMemo(() => {
    return animProgress.interpolate({
      inputRange: [0, 0.62, 1.0],
      outputRange: [0, 0, 1],
      extrapolate: 'clamp',
    });
  }, [animProgress]);

  // ──────────────────────────────────────────────────────────────────────────
  // Entry animation trigger
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) {
      animProgress.setValue(0);
      setUiReady(false);
      return;
    }

    animProgress.setValue(0);
    setUiReady(false);

    Animated.timing(animProgress, {
      toValue: 1,
      duration: ANIM_DURATION_TOTAL,
      easing: Easing.bezier(0.22, 1, 0.36, 1), // fluid natural momentum with gentle settle
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setUiReady(true);
      }
    });
  }, [visible, animProgress]);

  // ──────────────────────────────────────────────────────────────────────────
  // Voice pipeline callbacks
  // ──────────────────────────────────────────────────────────────────────────
  const handleTranscript = useCallback(async (transcriptText: string) => {
    if (!transcriptText || !transcriptText.trim()) {
      setVoiceState('idle');
      setStatusMessage('Kuch suna nahi. Tap mic to try again.');
      return;
    }

    const cleanQuery = transcriptText.trim();
    setLastTranscript(cleanQuery);
    setVoiceState('thinking');
    setStatusMessage('Thinking...');

    conversationHistoryRef.current.push({ role: 'user', content: cleanQuery });

    try {
      const historyForApi = conversationHistoryRef.current.slice(-10);
      const { response: aiText } = await voiceAiService.generateVoiceResponse(
        cleanQuery,
        historyForApi,
      );

      if (!isSessionActiveRef.current) return;

      conversationHistoryRef.current.push({ role: 'assistant', content: aiText });
      setLastAiResponse(aiText);
      setVoiceState('speaking');
      setStatusMessage('Speaking...');

      try {
        const audioUri = await voiceAiService.synthesizeSpeech(aiText, selectedVoiceId);
        if (!isSessionActiveRef.current) return;

        await voiceAiService.playSpeech(audioUri, aiText, (level) => {
          setLiveAudioLevel(level);
        });
      } catch (ttsErr) {
        console.warn('[VoiceOverlay] TTS failed, falling back to native speech:', ttsErr);
        // playSpeech handles its own native TTS fallback internally
      }

      if (!isSessionActiveRef.current) return;

      setVoiceState('idle');
      setLiveAudioLevel(0);
      setStatusMessage('Tap mic to start talking');
    } catch (err) {
      console.error('[VoiceOverlay] Pipeline error:', err);
      if (isSessionActiveRef.current) {
        setVoiceState('error');
        setStatusMessage('Something went wrong. Try again.');
      }
    }
  }, [selectedVoiceId]);

  const handleSTTError = useCallback((error: STTError, message: string) => {
    console.warn('[VoiceOverlay] STT error:', error, message);
    if (error === 'PERMISSION_DENIED') {
      setStatusMessage('Microphone permission required.');
    } else if (error === 'NO_SPEECH') {
      setStatusMessage('Kuch suna nahi. Tap mic to talk.');
    } else {
      setStatusMessage(message || 'Voice input error.');
    }
    setVoiceState('idle');
    setLiveAudioLevel(0);
  }, []);

  // ── Microphone hook ────────────────────────────────────────────────────────
  const {
    isListening,
    isTranscribing,
    audioLevel: micAudioLevel,
    startListening,
    stopListening,
    cancelListening,
  } = useSpeechToText({
    onTranscript: handleTranscript,
    onError: handleSTTError,
  });

  // Throttled audio level sync (30 Hz)
  const lastLevelUpdateRef = useRef(0);
  useEffect(() => {
    if (voiceState === 'listening') {
      const now = Date.now();
      if (now - lastLevelUpdateRef.current > 33) {
        lastLevelUpdateRef.current = now;
        setLiveAudioLevel(micAudioLevel);
      }
    }
  }, [voiceState, micAudioLevel]);

  // Sync isTranscribing → thinking state
  useEffect(() => {
    if (isTranscribing && voiceState !== 'thinking') {
      setVoiceState('thinking');
      setStatusMessage('Processing speech...');
    }
  }, [isTranscribing, voiceState]);

  // ── Toggle mute ────────────────────────────────────────────────────────────
  const handleToggleMic = useCallback(async () => {
    if (!isMuted) {
      setIsMuted(true);
      if (isListening) stopListening();
    } else {
      setIsMuted(false);
    }
  }, [isMuted, isListening, stopListening]);

  // ── End call ──────────────────────────────────────────────────────────────
  const handleEndCall = useCallback(() => {
    isSessionActiveRef.current = false;
    cancelListening();
    voiceAiService.stopPlayback();
    setVoiceState('idle');
    setLiveAudioLevel(0);
    conversationHistoryRef.current = [];
    onClose();
  }, [cancelListening, onClose]);

  // ── Orb press: toggle listen / interrupt speaking ─────────────────────────
  const handleOrbPress = useCallback(async () => {
    if (voiceState === 'speaking') {
      voiceAiService.stopPlayback();
      setVoiceState('listening');
      setStatusMessage('Listening...');
      if (!isMuted) await startListening();
      return;
    }
    if (voiceState === 'listening') {
      stopListening();
      return;
    }
    if (voiceState === 'idle' || voiceState === 'error') {
      if (isMuted) {
        setStatusMessage('Mic is muted. Unmute first.');
        return;
      }
      setVoiceState('listening');
      setStatusMessage('Listening...');
      await startListening();
    }
  }, [voiceState, isMuted, startListening, stopListening]);

  // ── Session lifecycle ──────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      isSessionActiveRef.current = true;
      return () => {
        isSessionActiveRef.current = false;
        cancelListening();
        voiceAiService.stopPlayback();
      };
    } else {
      isSessionActiveRef.current = false;
      cancelListening();
      voiceAiService.stopPlayback();
      setVoiceState('idle');
    }
  }, [visible, cancelListening]);

  // App backgrounding safety
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState.match(/inactive|background/)) {
        if (isSessionActiveRef.current) {
          cancelListening();
          voiceAiService.stopPlayback();
          setVoiceState('idle');
          setStatusMessage('Session paused in background');
        }
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [cancelListening]);

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────
  if (!visible) return null;

  // The orb sits absolutely at the center of the screen (transform offsets
  // handle the "start at button" position via translateX/Y)
  const ORB_SIZE = 250;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleEndCall}
    >
      {/* ── Layer 0: Animated dark/light background ── */}
      <Animated.View
        style={[styles.absoluteFill, { backgroundColor: isDark ? '#090a0f' : '#f8fafc', opacity: bgOpacity }]}
        pointerEvents="none"
      />

      {/* ── Layer 0.5: Subtle curved motion trail particles ── */}
      <View style={styles.absoluteCenter} pointerEvents="none">
        {trailsInterpolations.map((tr, idx) => (
          <Animated.View
            key={`trail-${idx}`}
            style={[
              styles.trailParticle,
              {
                backgroundColor: hexToRgba(orbPreset.from, 0.28),
                shadowColor: orbPreset.to,
                transform: [
                  { translateX: tr.translateX },
                  { translateY: tr.translateY },
                  { scale: tr.scale },
                ],
                opacity: tr.opacity,
              },
            ]}
          >
            <View style={styles.trailCore} />
          </Animated.View>
        ))}
      </View>

      {/* ── Layer 1: Animated orb (follows curved trajectory → center) ── */}
      <Animated.View
        style={[
          styles.orbLayer,
          {
            transform: [
              { translateX: orbTranslateX },
              { translateY: orbTranslateY },
              { scale: orbScale },
            ],
          },
        ]}
        pointerEvents="box-none"
      >
        {/* Luminous energy halo during movement */}
        <Animated.View
          style={[
            styles.orbHalo,
            {
              backgroundColor: hexToRgba(orbPreset.from, isDark ? 0.14 : 0.08),
              shadowColor: orbPreset.from,
              opacity: haloOpacity,
              transform: [{ scale: haloScale }],
            },
          ]}
          pointerEvents="none"
        />

        <VoiceOrb
          state={voiceState}
          size={ORB_SIZE}
          audioLevel={liveAudioLevel}
          colorFrom={orbPreset.from}
          colorTo={orbPreset.to}
          onPress={uiReady ? handleOrbPress : undefined}
        />
      </Animated.View>

      {/* ── Layer 2: Animated UI (header + status text + controls) ── */}
      <Animated.View
        style={[styles.absoluteFill, { opacity: uiOpacity }]}
        pointerEvents={uiReady ? 'box-none' : 'none'}
      >
        {/* Top Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 18) }]}>
          {/* Voice selector pill */}
          <Pressable
            onPress={() => setIsVoiceModalOpen(true)}
            style={({ pressed }) => [
              styles.voicePill,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.surface2,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : colors.line,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Active Voice: ${selectedVoice.name}. Tap to change voice.`}
          >
            <View style={[styles.voiceIndicatorDot, { backgroundColor: orbPreset.from }]} />
            <Text style={[styles.voicePillLabel, { color: colors.ink3 }]}>Voice: </Text>
            <Text style={[styles.voicePillName, { color: colors.ink }]}>{selectedVoice.name}</Text>
          </Pressable>

          {/* Close button */}
          <Pressable
            onPress={handleEndCall}
            hitSlop={12}
            style={({ pressed }) => [
              styles.closeBtn,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.surface2,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : colors.line,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Close voice call"
          >
            <IconX size={24} color={colors.ink} strokeWidth={2.2} />
          </Pressable>
        </View>

        {/* Center: status text above orb placeholder, subtitle below */}
        <View style={styles.centerSection} pointerEvents="none">
          {/* Status Label */}
          <Text
            style={[
              styles.stateLabel,
              { color: voiceState === 'error' ? '#fb7185' : colors.ink },
            ]}
          >
            {voiceState === 'listening'
              ? t('listening', 'Listening...')
              : voiceState === 'thinking'
              ? t('thinking', 'Thinking...')
              : voiceState === 'speaking'
              ? 'Speaking...'
              : voiceState === 'error'
              ? 'Voice Issue'
              : 'Idle'}
          </Text>

          {/* Spacer where the orb lives (actual orb is in its own layer above) */}
          <View style={{ height: ORB_SIZE + 2 * (spacing as any).xl }} />

          {/* Transcript + hint */}
          <View style={styles.subtitleContainer}>
            {lastTranscript ? (
              <Text style={[styles.transcriptText, { color: colors.ink2 }]} numberOfLines={2}>
                "{lastTranscript}"
              </Text>
            ) : null}
            <Text style={[styles.hintText, { color: colors.ink3 }]}>{statusMessage}</Text>
          </View>
        </View>

        {/* Bottom Controls: Mic + End Call */}
        <View
          style={[
            styles.bottomControls,
            { paddingBottom: Math.max(insets.bottom, 28) },
          ]}
        >
          <Pressable
            onPress={handleToggleMic}
            style={({ pressed }) => [
              styles.controlCircle,
              {
                backgroundColor: isMuted
                  ? '#dc2626'
                  : voiceState === 'listening'
                  ? orbPreset.from
                  : isDark
                  ? 'rgba(255, 255, 255, 0.12)'
                  : colors.surface2,
                borderColor:
                  voiceState === 'listening'
                    ? orbPreset.from
                    : colors.line,
                transform: [{ scale: pressed ? 0.94 : 1 }],
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? (
              <IconMicrophoneOff size={24} color="#ffffff" strokeWidth={2} />
            ) : (
              <IconMicrophone
                size={24}
                color={isMuted || voiceState === 'listening' ? '#ffffff' : colors.ink}
                strokeWidth={2}
              />
            )}
          </Pressable>

          <Pressable
            onPress={handleEndCall}
            style={({ pressed }) => [
              styles.endCircle,
              {
                backgroundColor: '#ef4444',
                transform: [{ scale: pressed ? 0.94 : 1 }],
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="End voice call"
          >
            <IconPhoneOff size={24} color="#ffffff" strokeWidth={2.2} />
          </Pressable>
        </View>
      </Animated.View>

      {/* ── Voice Selector Sheet (rendered last so it sits on top) ── */}
      <VoiceSelectorModal
        visible={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  absoluteFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // Orb layer: sits at the vertical center of the screen
  // and uses transforms to start at the button position
  orbLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  absoluteCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbHalo: {
    position: 'absolute',
    width: 250 * 0.95,
    height: 250 * 0.95,
    borderRadius: (250 * 0.95) / 2,
    backgroundColor: 'rgba(0, 230, 195, 0.14)',
    shadowColor: '#00E6C3',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 6,
  },
  trailParticle: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 230, 195, 0.28)',
    shadowColor: '#66FFE5',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 4,
  },
  trailCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
    opacity: 0.9,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    zIndex: 10,
  },
  voicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  voiceIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
    marginRight: 6,
  },
  voicePillLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },
  voicePillName: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '700',
  },
  closeBtn: {
    padding: spacing.xs,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  stateLabel: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 0,
  },
  subtitleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    minHeight: 52,
  },
  transcriptText: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 6,
  },
  hintText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 36,
    paddingHorizontal: spacing.xl,
  },
  controlCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  endCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
});
