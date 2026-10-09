/**
 * src/components/update/UpdateBannerCard.tsx
 *
 * Premium Home Screen Update Banner Card.
 * Rendered in the designated Home Screen slot (between Suggestion Cards and Bottom Controls)
 * to notify the user whenever an APK update is available, download it with real-time progress,
 * and seamlessly invoke the official Android Package Installer.
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
  IconDownload,
  IconSparkles,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconRefresh,
} from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius, typography } from '@/theme';
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
  writtenBytes,
  totalBytes,
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

  // Format MB display
  const formatMB = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const pct = Math.min(100, Math.round(downloadProgress * 100));

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: colors.isDark ? '#16181d' : '#f4f5f8',
          borderColor: isMandatory
            ? colors.isDark
              ? 'rgba(239, 68, 68, 0.4)'
              : '#fca5a5'
            : colors.isDark
            ? 'rgba(124, 58, 237, 0.35)'
            : '#e9d5ff',
        },
      ]}
    >
      {/* Top Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.badgeGroup}>
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isMandatory
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(124, 58, 237, 0.15)',
              },
            ]}
          >
            {isMandatory ? (
              <IconAlertTriangle
                size={16}
                color={colors.isDark ? '#f87171' : '#dc2626'}
                strokeWidth={2}
              />
            ) : (
              <IconSparkles
                size={16}
                color={colors.isDark ? '#a78bfa' : '#7c3aed'}
                strokeWidth={2}
              />
            )}
          </View>
          <Text
            style={[
              styles.badgeText,
              {
                color: isMandatory
                  ? colors.isDark
                    ? '#f87171'
                    : '#dc2626'
                  : colors.isDark
                  ? '#c4b5fd'
                  : '#7c3aed',
              },
            ]}
          >
            {isMandatory ? 'Security Update Required' : 'Update Available'}
          </Text>
          <View
            style={[
              styles.versionPill,
              {
                backgroundColor: colors.isDark ? '#232730' : '#e5e7eb',
              },
            ]}
          >
            <Text style={[styles.versionPillText, { color: colors.ink }]}>
              v{updateInfo.latestVersion}
            </Text>
          </View>
        </View>

        {!isMandatory && !isDownloading && (
          <Pressable
            onPress={onDismissPress}
            hitSlop={8}
            style={styles.closeButton}
            accessibilityLabel="Dismiss update"
          >
            <IconX size={16} color={colors.ink2} strokeWidth={2} />
          </Pressable>
        )}
      </View>

      {/* Release Notes / Description */}
      <View style={styles.contentSection}>
        {updateInfo.releaseNotes && updateInfo.releaseNotes.length > 0 ? (
          <Text
            style={[styles.noteText, { color: colors.ink2 }]}
            numberOfLines={2}
          >
            • {updateInfo.releaseNotes[0]}
          </Text>
        ) : (
          <Text style={[styles.noteText, { color: colors.ink2 }]}>
            A new production version is available with security & performance improvements.
          </Text>
        )}
      </View>

      {/* Downloading State */}
      {isDownloading && (
        <View style={styles.progressContainer}>
          <View style={styles.progressMetaRow}>
            <Text style={[styles.progressStatusText, { color: colors.ink }]}>
              Downloading APK... {pct}%
            </Text>
            {totalBytes > 0 && (
              <Text style={[styles.progressBytesText, { color: colors.ink2 }]}>
                {formatMB(writtenBytes)} / {formatMB(totalBytes)}
              </Text>
            )}
          </View>
          <View
            style={[
              styles.progressBarTrack,
              { backgroundColor: colors.isDark ? '#232730' : '#e2e8f0' },
            ]}
          >
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${pct}%`,
                  backgroundColor: isMandatory ? '#ef4444' : '#7c3aed',
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* Error state message */}
      {isError && (
        <Text style={[styles.errorText, { color: '#ef4444' }]}>
          {errorMessage || 'Download was interrupted. Please retry.'}
        </Text>
      )}

      {/* Action Buttons Row */}
      {!isDownloading && (
        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: isMandatory ? '#dc2626' : '#7c3aed',
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            onPress={onUpdatePress}
            accessibilityLabel="Install Update"
          >
            {isReady ? (
              <>
                <IconCheck size={16} color="#ffffff" strokeWidth={2.2} />
                <Text style={styles.primaryButtonText}>Install Now</Text>
              </>
            ) : isError ? (
              <>
                <IconRefresh size={16} color="#ffffff" strokeWidth={2.2} />
                <Text style={styles.primaryButtonText}>Retry Download</Text>
              </>
            ) : (
              <>
                <IconDownload size={16} color="#ffffff" strokeWidth={2.2} />
                <Text style={styles.primaryButtonText}>
                  {isMandatory ? 'Update to Continue' : 'Update Now'}
                </Text>
              </>
            )}
          </Pressable>

          {!isMandatory && (
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                {
                  backgroundColor: colors.isDark ? '#22252d' : '#e5e7eb',
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
              onPress={onDismissPress}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.ink }]}>
                Later
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: '100%',
    borderRadius: radius.lg || 16,
    borderWidth: 1,
    padding: spacing.md || 14,
    marginVertical: spacing.sm || 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontWeight: '700',
    fontSize: 13,
  },
  versionPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  versionPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  contentSection: {
    marginTop: 6,
    marginBottom: 10,
  },
  noteText: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  progressContainer: {
    marginVertical: 4,
  },
  progressMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressBytesText: {
    fontSize: 11,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  errorText: {
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: radius.md || 10,
    flex: 1,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  secondaryButton: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: radius.md || 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontWeight: '500',
    fontSize: 13,
  },
});
