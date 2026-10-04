import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Animated, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';

// Resolved video asset from local assets directory (optimized, faststart, audio-free)
const startupVideoSource = require('../../../assets/Final_loading_video.mp4');

interface StartupVideoScreenProps {
  /**
   * Indicates whether the app's underlying initialization (e.g. auth check) is complete.
   */
  isAppReady: boolean;
  /**
   * Callback fired once the startup video has finished and the transition fade-out has completed.
   */
  onTransitionComplete: () => void;
}

/**
 * Fully optimized fullscreen startup & loading screen displaying only Final_loading_video.mp4.
 *
 * Optimizations:
 * - Completely muted: audio track stripped from container, player muted, volume 0, audioMixingMode 'doNotMix'.
 * - Zero audio subsystem overhead: eliminates audio track allocation, mixer latency, and audio focus requests.
 * - Hardware SurfaceView: uses low-power GPU-direct SurfaceView on Android for 60fps rendering without UI thread load.
 * - MOOV Faststart atom: enables instantaneous video decode on the very first byte without seeking.
 * - Minimalist: contains ONLY the video (zero text, buttons, icons, spinners, or loading messages).
 * - Clean lifecycle: pauses and frees decoder resources immediately upon transition.
 */
export const StartupVideoScreen: React.FC<StartupVideoScreenProps> = ({
  isAppReady,
  onTransitionComplete,
}) => {
  const [videoFinished, setVideoFinished] = useState(false);
  const [hasStartedTransition, setHasStartedTransition] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Initialize the video player completely muted with autoplay enabled and looping disabled
  const player = useVideoPlayer(startupVideoSource, (p) => {
    p.loop = false;
    p.muted = true;
    p.volume = 0;
    p.audioMixingMode = 'doNotMix';
    p.play();
  });

  // Listen to video completion event
  useEffect(() => {
    if (!player) return;

    const sub = player.addListener('playToEnd', () => {
      setVideoFinished(true);
    });

    const statusSub = player.addListener('statusChange', (payload) => {
      if (payload.status === 'error') {
        // Fallback gracefully on video decode error
        setVideoFinished(true);
      }
    });

    return () => {
      sub.remove();
      statusSub.remove();
    };
  }, [player]);

  // Safety timer fallback: video is 4.0s long; trigger completion after 4.2s if event didn't fire
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setVideoFinished(true);
    }, 4200);

    return () => clearTimeout(safetyTimer);
  }, []);

  // Ensure player is paused upon transition or unmount to free hardware decoders
  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        // Safe disposal fallback
      }
    };
  }, [player]);

  // When both the video has played and the app is ready, perform a clean 350ms fade transition
  useEffect(() => {
    if (videoFinished && isAppReady && !hasStartedTransition) {
      setHasStartedTransition(true);
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => {
        try {
          player.pause();
        } catch {
          // Safe disposal fallback
        }
        onTransitionComplete();
      });
    }
  }, [videoFinished, isAppReady, hasStartedTransition, fadeAnim, onTransitionComplete, player]);

  return (
    <Animated.View
      style={[
        styles.fullscreenContainer,
        {
          opacity: fadeAnim,
        },
      ]}
      pointerEvents={hasStartedTransition ? 'none' : 'auto'}
    >
      <StatusBar hidden />
      <View style={styles.videoWrapper}>
        <VideoView
          style={StyleSheet.absoluteFill}
          player={player}
          nativeControls={false}
          contentFit="contain"
          surfaceType="surfaceView"
        />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  fullscreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    zIndex: 999999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoWrapper: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
});
export default StartupVideoScreen;
