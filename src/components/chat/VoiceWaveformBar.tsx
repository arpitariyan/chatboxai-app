/**
 * src/components/chat/VoiceWaveformBar.tsx
 *
 * Real-time animated audio waveform bar displayed inside the input container
 * when recording speech for Speech-to-Text.
 *
 * Features:
 * - Left [X] button to cancel/discard recording
 * - Center animated waveform with 24 bars oscillating smoothly with 60fps native transforms
 * - Dynamic height scaling reacting to live audio metering
 * - Right [■] stop button (white rounded square) to end recording and transcribe
 * - Transcribing loading state with activity indicator and status text
 */

import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { IconX } from '@tabler/icons-react-native';

interface VoiceWaveformBarProps {
  isListening: boolean;
  isTranscribing: boolean;
  audioLevel?: number; // 0.0 to 1.0 normalized
  onCancel: () => void;
  onStop: () => void;
}

const BAR_COUNT = 24;

// Base heights in px forming an audio frequency curve (peaks in middle)
const BASE_HEIGHTS = [
  6, 8, 12, 16, 20, 24, 22, 18, 24, 26, 22, 18,
  20, 24, 26, 22, 18, 24, 20, 16, 12, 8, 6, 5,
];

export const VoiceWaveformBar: React.FC<VoiceWaveformBarProps> = ({
  isListening,
  isTranscribing,
  audioLevel = 0.5,
  onCancel,
  onStop,
}) => {
  // Animated values for each bar's scaleY
  const animValues = useRef<Animated.Value[]>(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.4))
  ).current;

  useEffect(() => {
    if (!isListening) return;

    let isMounted = true;

    // Loop smooth random/harmonic oscillations for the waveform bars
    const animateBars = () => {
      if (!isMounted) return;

      const animations = animValues.map((anim, index) => {
        // Vary scale between 0.3 and 1.2, amplified by audioLevel
        const levelBoost = 0.4 + (audioLevel || 0.4) * 0.8;
        const targetScale = Math.max(
          0.25,
          Math.min(1.4, (0.3 + Math.random() * 0.7) * levelBoost)
        );
        const duration = 120 + ((index * 37) % 180);

        return Animated.timing(anim, {
          toValue: targetScale,
          duration,
          useNativeDriver: true,
        });
      });

      Animated.parallel(animations).start(() => {
        if (isMounted && isListening) {
          animateBars();
        }
      });
    };

    animateBars();

    return () => {
      isMounted = false;
      animValues.forEach((anim) => anim.stopAnimation());
    };
  }, [isListening, audioLevel, animValues]);

  if (isTranscribing) {
    return (
      <View style={styles.transcribingContainer}>
        <ActivityIndicator size="small" color="#3b82f6" />
        <Text style={styles.transcribingText}>Transcribing speech...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Left: Cancel recording button */}
      <Pressable
        onPress={onCancel}
        hitSlop={10}
        style={({ pressed }) => [
          styles.cancelBtn,
          { opacity: pressed ? 0.6 : 1 },
        ]}
        accessibilityLabel="Cancel recording"
      >
        <IconX size={18} color="#9ca3af" strokeWidth={2.2} />
      </Pressable>

      {/* Center: Waveform animation */}
      <View style={styles.waveformContainer}>
        {animValues.map((anim, i) => (
          <Animated.View
            key={i}
            style={[
              styles.bar,
              {
                height: BASE_HEIGHTS[i] || 14,
                transform: [{ scaleY: anim }],
              },
            ]}
          />
        ))}
      </View>

      {/* Right: Stop recording & transcribe button (white rounded square) */}
      <Pressable
        onPress={onStop}
        hitSlop={10}
        style={({ pressed }) => [
          styles.stopBtn,
          { opacity: pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] },
        ]}
        accessibilityLabel="Stop recording"
      >
        <View style={styles.stopSquare} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    height: 40,
  },
  cancelBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3.5,
    paddingHorizontal: 8,
    height: 36,
    overflow: 'hidden',
  },
  bar: {
    width: 2.8,
    backgroundColor: '#9ca3af',
    borderRadius: 2,
  },
  stopBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopSquare: {
    width: 14,
    height: 14,
    backgroundColor: '#ffffff',
    borderRadius: 3.5,
  },
  transcribingContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 40,
  },
  transcribingText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '500',
  },
});
