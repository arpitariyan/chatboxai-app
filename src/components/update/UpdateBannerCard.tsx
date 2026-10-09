/**
 * src/components/update/UpdateBannerCard.tsx
 *
 * Ultra-Sleek, Compact Home Screen Update Capsule.
 * Designed to match the exact aesthetics, color palette, and border curvature
 * of the ChatBox AI input composer and bottom control pills:
 * - Minimal ~46px height pill container
 * - Matches input background (#1c1c1e) and hairline border (#2c2c2e)
 * - Zero noisy descriptions or bullet points
 * - Clean "Update Available" label with subtle sparkles icon
 * - Compact "Update" / "Install" action with live percentage progress
 */

import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import {
  IconSparkles,
  IconCheck,
  IconX,
  IconRefresh,
} from '@tabler/icons-react-native';
import { useThemeColors, radius } from '@/theme';
import { UpdateCheckResult } from '@/services/update/updateService';
import { UpdateStatus } from '@/hooks/useAppUpdate';

interface UpdateBannerCardProps {
  status: UpdateStatus;
  updateInfo: UpdateCheckResult | null;
  downloadProgress: number;
  writtenBytes: number;
  totalBytes: number;
  isMandatory: boolean;
  errorMessage: string | null;
  onUpdatePress: () => void;
  onDismissPress: () => void;
}

export const UpdateBannerCard: React.FC<UpdateBannerCardProps> = ({
  status,
  updateInfo,
  downloadProgress,
  isMandatory,
  errorMessage,
  onUpdatePress,
  onDismissPress,
}) => {
  const colors = useThemeColors();

  if (!updateInfo || !updateInfo.hasUpdate) {
    return null;
  }

  const isDownloading = status === 'downloading';
  const isReady = status === 'ready';
  const isError = status === 'error';
  const pct = Math.min(100, Math.max(0, Math.round(downloadProgress * 100)));

  return (
    <View
      style={[
        styles.capsuleContainer,
        {
          backgroundColor: colors.isDark ? '#1c1c1e' : colors.surface2,
          borderColor: isError
            ? 'rgba(239, 68, 68, 0.4)'
            : colors.isDark
            ? '#2c2c2e'
            : colors.line,
        },
      ]}
    >
      {/* Left Group: Subtle Sparkle + Clean Label */}
      <View style={styles.leftGroup}>
        <View
          style={[
            styles.iconWrapper,
            {
              backgroundColor: isError
                ? 'rgba(239, 68, 68, 0.15)'
                : 'rgba(124, 58, 237, 0.15)',
            },
          ]}
        >
          <IconSparkles
            size={15}
            color={isError ? '#f87171' : (colors.isDark ? '#a78bfa' : '#7c3aed')}
            strokeWidth={2}
          />
        </View>
        <Text
          style={[
            styles.titleText,
            { color: colors.isDark ? '#f4f4f5' : colors.ink },
          ]}
          numberOfLines={1}
        >
          {isError ? 'Download Failed' : 'Update Available'}
        </Text>
      </View>

      {/* Right Group: Action / Progress / Dismiss */}
      <View style={styles.rightGroup}>
        {isDownloading ? (
          <View style={styles.downloadingRow}>
            <ActivityIndicator
              size="small"
              color={colors.isDark ? '#a78bfa' : '#7c3aed'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.progressText,
                { color: colors.isDark ? '#a1a1aa' : colors.ink2 },
              ]}
            >
              {pct > 0 ? `${pct}%` : 'Starting...'}
            </Text>
          </View>
        ) : isReady ? (
          <Pressable
            style={({ pressed }) => [
              styles.actionPill,
              {
                backgroundColor: '#10b981',
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            onPress={onUpdatePress}
            hitSlop={6}
          >
            <IconCheck size={13} color="#ffffff" strokeWidth={2.4} style={{ marginRight: 4 }} />
            <Text style={styles.actionPillText}>Install</Text>
          </Pressable>
        ) : isError ? (
          <Pressable
            style={({ pressed }) => [
              styles.actionPill,
              {
                backgroundColor: '#dc2626',
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            onPress={onUpdatePress}
            hitSlop={6}
          >
            <IconRefresh size={13} color="#ffffff" strokeWidth={2.4} style={{ marginRight: 4 }} />
            <Text style={styles.actionPillText}>Retry</Text>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.actionPill,
              {
                backgroundColor: isMandatory ? '#dc2626' : (colors.isDark ? '#7c3aed' : '#6d28d9'),
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            onPress={onUpdatePress}
            hitSlop={6}
          >
            <Text style={styles.actionPillText}>Update</Text>
          </Pressable>
        )}

        {/* Dismiss Button (Only if not mandatory and not downloading) */}
        {!isMandatory && !isDownloading && (
          <Pressable
            onPress={onDismissPress}
            hitSlop={10}
            style={styles.dismissButton}
            accessibilityLabel="Dismiss update"
          >
            <IconX
              size={15}
              color={colors.isDark ? '#71717a' : colors.ink3}
              strokeWidth={2}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  capsuleContainer: {
    width: '100%',
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  iconWrapper: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  downloadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  actionPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dismissButton: {
    padding: 4,
    marginLeft: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
