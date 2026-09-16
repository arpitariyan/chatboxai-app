import React, { useState } from 'react';
import { StyleSheet, Text, View, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconX,
  IconMicrophone,
  IconMicrophoneOff,
  IconPhoneOff,
} from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius, typography } from '@/theme';

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
  const [isMuted, setIsMuted] = useState(false);
  const [voiceState, setVoiceState] = useState<'listening' | 'thinking' | 'speaking'>('listening');

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <Text style={[styles.brandText, { color: colors.ink }]}>ChatBox Voice</Text>
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
            <IconX size={22} color={colors.ink2} />
          </Pressable>
        </View>

        {/* Center: Waveform & State Indicator */}
        <View style={styles.centerSection}>
          <Text style={[styles.stateLabel, { color: colors.accent }]}>
            {voiceState === 'listening'
              ? 'Listening...'
              : voiceState === 'thinking'
              ? 'Thinking...'
              : 'Speaking...'}
          </Text>

          {/* Clean Non-Glowing Audio Waveform Bars */}
          <View style={styles.waveformContainer}>
            <View style={[styles.waveBar, { backgroundColor: colors.accent, height: 28 }]} />
            <View style={[styles.waveBar, { backgroundColor: colors.accent, height: 48 }]} />
            <View style={[styles.waveBar, { backgroundColor: colors.accent, height: 36 }]} />
            <View style={[styles.waveBar, { backgroundColor: colors.accent, height: 56 }]} />
            <View style={[styles.waveBar, { backgroundColor: colors.accent, height: 24 }]} />
          </View>

          <Text style={[styles.hintText, { color: colors.ink2 }]}>
            {isMuted ? 'Microphone is muted' : 'Tap mic to mute or start talking'}
          </Text>
        </View>

        {/* Bottom Controls */}
        <View style={[styles.bottomControls, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <Pressable
            onPress={() => setIsMuted((prev) => !prev)}
            style={({ pressed }) => [
              styles.controlCircle,
              {
                backgroundColor: isMuted ? colors.destructive : colors.surface,
                borderColor: colors.line,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            {isMuted ? (
              <IconMicrophoneOff size={22} color="#ffffff" />
            ) : (
              <IconMicrophone size={22} color={colors.ink} />
            )}
          </Pressable>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.endCircle,
              {
                backgroundColor: colors.destructive,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <IconPhoneOff size={22} color="#ffffff" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  brandText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  closeText: {
    fontSize: 18,
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateLabel: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: -0.3,
    marginBottom: spacing.xl,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 80,
    marginBottom: spacing.xl,
  },
  waveBar: {
    width: 6,
    borderRadius: 3,
  },
  hintText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    alignItems: 'center',
  },
  controlCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: radius.borderCurve,
  },
  controlIcon: {
    fontSize: 22,
  },
  endCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endIcon: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
