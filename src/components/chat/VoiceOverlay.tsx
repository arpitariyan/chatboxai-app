/**
 * src/components/chat/VoiceOverlay.tsx
 *
 * Dedicated Full-Screen Voice AI Experience for ChatBox AI APK.
 * Adapts the complete website Voice AI architecture (app/(routes)/voice-ai):
 * - Seamless voice loop: User speaks -> speech recognized -> AI generates answer -> assistant speaks -> session continues
 * - Central 3D Fibonacci Particle Orb reacting to real-time Voice AI states (listening, thinking, speaking, idle, error)
 * - Assistant Voice Selection with approved 5-voice registry (Sarah, Charlie, George, Antoni, Bill)
 * - Microphone recording via Groq Whisper STT and ElevenLabs / native TTS playback
 * - Clean header with ONLY a Close button (no "Chatbox Voice" title text)
 * - Working Mute/Unmute microphone button and red End Call button
 * - Graceful app backgrounding, permission requests, and session cleanup
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  AppState,
  AppStateStatus,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconX,
  IconMicrophone,
  IconMicrophoneOff,
  IconPhoneOff,
  IconVolume,
  IconVolumeOff,
  IconSparkles,
} from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius, typography } from '../../theme';
import { VoiceOrb, VoiceOrbState } from '../voice/VoiceOrb';
import { VoiceSelectorModal } from '../voice/VoiceSelectorModal';
import { useVoicePreferenceStore } from '../../stores/useVoicePreferenceStore';
import { useSpeechToText, STTError } from '../../hooks/useSpeechToText';
import { voiceAiService } from '../../services/voice/voiceAiService';

interface VoiceOverlayProps {
  visible: boolean;
  onClose: () => void;
}

export const VoiceOverlay: React.FC<VoiceOverlayProps> = ({
  visible,
  onClose,
}) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  // Assistant Voice State
  const selectedVoice = useVoicePreferenceStore((s) => s.getSelectedVoice());
  const selectedVoiceId = useVoicePreferenceStore((s) => s.selectedVoiceId);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  // Voice AI Session States
  const [voiceState, setVoiceState] = useState<VoiceOrbState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Tap mic to start talking');
  const [lastTranscript, setLastTranscript] = useState('');
  const [lastAiResponse, setLastAiResponse] = useState('');
  const [liveAudioLevel, setLiveAudioLevel] = useState(0);

  // Multi-turn conversation history for voice context
  const conversationHistoryRef = useRef<Array<{ role: string; content: string }>>([]);
  const isSessionActiveRef = useRef(false);

  // Callback when Groq Whisper returns speech transcript
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

    // Append user turn to conversation history
    conversationHistoryRef.current.push({ role: 'user', content: cleanQuery });

    try {
      // 1. Generate Voice AI response
      const aiResult = await voiceAiService.generateVoiceResponse(
        cleanQuery,
        conversationHistoryRef.current
      );

      const reply = aiResult.response;
      setLastAiResponse(reply);
      conversationHistoryRef.current.push({ role: 'assistant', content: reply });

      if (!isSessionActiveRef.current) return;

      // 2. Synthesize audio with selected ElevenLabs voice (with native fallback)
      setStatusMessage('Speaking...');
      setVoiceState('speaking');

      let audioUri = '';
      try {
        audioUri = await voiceAiService.synthesizeSpeech(reply, selectedVoiceId);
      } catch (ttsErr) {
        console.warn('[VoiceOverlay] ElevenLabs TTS synthesis fallback to device speech:', ttsErr);
      }

      if (!isSessionActiveRef.current) return;

      // 3. Play audio response and react to real-time speech amplitude
      await voiceAiService.playSpeech(audioUri, reply, (level) => {
        setLiveAudioLevel(level);
      });

      // 4. Session continuation: When assistant finishes, ready for next turn
      if (isSessionActiveRef.current) {
        setLiveAudioLevel(0);
        setVoiceState('idle');
        setStatusMessage('Tap mic or start talking');
      }
    } catch (err: any) {
      console.error('[VoiceOverlay] Pipeline error:', err);
      setVoiceState('error');
      setStatusMessage('Sorry, something went wrong. Tap mic to retry.');
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

  // Hook for microphone capture and speech transcription
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

  // Keep orb audio level in sync with mic recording or audio playback
  useEffect(() => {
    if (voiceState === 'listening') {
      setLiveAudioLevel(micAudioLevel);
    }
  }, [voiceState, micAudioLevel]);

  // Sync isTranscribing with thinking state
  useEffect(() => {
    if (isTranscribing && voiceState !== 'thinking') {
      setVoiceState('thinking');
      setStatusMessage('Processing speech...');
    }
  }, [isTranscribing, voiceState]);

  // Clean end-of-call handler
  const handleEndCall = useCallback(() => {
    isSessionActiveRef.current = false;
    cancelListening();
    voiceAiService.stopPlayback();
    setVoiceState('idle');
    setLiveAudioLevel(0);
    conversationHistoryRef.current = [];
    onClose();
  }, [cancelListening, onClose]);

  // Tap on the central Orb: toggle listening or interrupt speaking
  const handleOrbPress = useCallback(async () => {
    if (voiceState === 'speaking') {
      // User interrupted the assistant! Stop speech immediately and switch to listening
      voiceAiService.stopPlayback();
      setVoiceState('listening');
      setStatusMessage('Listening...');
      setIsMuted(false);
      await startListening();
      return;
    }

    if (voiceState === 'listening') {
      // Tap to stop listening and begin transcribing
      await stopListening();
      return;
    }

    if (voiceState === 'idle' || voiceState === 'error') {
      setIsMuted(false);
      setVoiceState('listening');
      setStatusMessage('Listening...');
      await startListening();
    }
  }, [voiceState, startListening, stopListening]);

  // Microphone toggle button
  const handleToggleMic = useCallback(async () => {
    if (voiceState === 'speaking') {
      voiceAiService.stopPlayback();
    }

    if (isListening) {
      setIsMuted(true);
      await stopListening();
      setVoiceState('idle');
      setStatusMessage('Microphone muted');
    } else {
      setIsMuted(false);
      setVoiceState('listening');
      setStatusMessage('Listening...');
      await startListening();
    }
  }, [voiceState, isListening, startListening, stopListening]);

  // Handle session start and cleanup on mount/unmount
  useEffect(() => {
    if (visible) {
      isSessionActiveRef.current = true;
      setVoiceState('listening');
      setStatusMessage('Listening...');
      setIsMuted(false);
      setLastTranscript('');
      setLastAiResponse('');

      // Auto-start listening on session open
      const startTimer = setTimeout(() => {
        if (isSessionActiveRef.current) {
          startListening();
        }
      }, 350);

      return () => {
        clearTimeout(startTimer);
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
  }, [visible, startListening, cancelListening]);

  // AppState backgrounding safety listener: pause/stop when app is backgrounded
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

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleEndCall}
    >
      <View style={[styles.container, { backgroundColor: '#090a0f' }]}>
        {/* Top Header - ONLY a Close button, NO "Chatbox Voice" title */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 18) }]}>
          {/* Top Area: Assistant Voice Selector Pill Button */}
          <Pressable
            onPress={() => setIsVoiceModalOpen(true)}
            style={({ pressed }) => [
              styles.voicePill,
              {
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderColor: 'rgba(255, 255, 255, 0.14)',
                opacity: pressed ? 0.75 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Active Voice: ${selectedVoice.name}. Tap to change voice.`}
          >
            <View style={styles.voiceIndicatorDot} />
            <Text style={styles.voicePillLabel}>Voice: </Text>
            <Text style={styles.voicePillName}>{selectedVoice.name}</Text>
          </Pressable>

          {/* Close button on right */}
          <Pressable
            onPress={handleEndCall}
            hitSlop={12}
            style={({ pressed }) => [
              styles.closeBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Close voice call"
          >
            <IconX size={24} color="#ffffff" strokeWidth={2.2} />
          </Pressable>
        </View>

        {/* Center: Voice State, The 3D Orb, Subtitle feedback */}
        <View style={styles.centerSection}>
          {/* Status Label */}
          <Text
            style={[
              styles.stateLabel,
              {
                color:
                  voiceState === 'error'
                    ? '#fb7185'
                    : voiceState === 'speaking'
                    ? '#66FFE5'
                    : voiceState === 'listening'
                    ? '#00E6C3'
                    : '#e5e7eb',
              },
            ]}
          >
            {voiceState === 'listening'
              ? 'Listening...'
              : voiceState === 'thinking'
              ? 'Thinking...'
              : voiceState === 'speaking'
              ? 'Speaking...'
              : voiceState === 'error'
              ? 'Voice Issue'
              : 'Idle'}
          </Text>

          {/* The Central 3D Particle Orb */}
          <View style={styles.orbWrapper}>
            <VoiceOrb
              state={voiceState}
              size={250}
              audioLevel={liveAudioLevel}
              onPress={handleOrbPress}
            />
          </View>

          {/* User Transcript or Subtitle Response */}
          <View style={styles.subtitleContainer}>
            {lastTranscript ? (
              <Text style={styles.transcriptText} numberOfLines={2}>
                "{lastTranscript}"
              </Text>
            ) : null}

            <Text style={styles.hintText}>{statusMessage}</Text>
          </View>
        </View>

        {/* Bottom Controls: Microphone Toggle + End Call */}
        <View
          style={[
            styles.bottomControls,
            { paddingBottom: Math.max(insets.bottom, 28) },
          ]}
        >
          {/* Mic Button */}
          <Pressable
            onPress={handleToggleMic}
            style={({ pressed }) => [
              styles.controlCircle,
              {
                backgroundColor: isMuted
                  ? '#dc2626'
                  : voiceState === 'listening'
                  ? 'rgba(0, 230, 195, 0.2)'
                  : 'rgba(255, 255, 255, 0.12)',
                borderColor:
                  voiceState === 'listening'
                    ? '#00E6C3'
                    : 'rgba(255, 255, 255, 0.15)',
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
                color={voiceState === 'listening' ? '#00E6C3' : '#ffffff'}
                strokeWidth={2}
              />
            )}
          </Pressable>

          {/* Red End Call Button */}
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

        {/* Assistant Voice Selector Sheet */}
        <VoiceSelectorModal
          visible={isVoiceModalOpen}
          onClose={() => setIsVoiceModalOpen(false)}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
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
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#00E6C3',
    marginRight: 6,
  },
  voicePillLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  voicePillName: {
    fontSize: 12,
    color: '#00E6C3',
    fontWeight: '700',
  },
  closeBtn: {
    padding: spacing.xs,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  stateLabel: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  orbWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xl,
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
