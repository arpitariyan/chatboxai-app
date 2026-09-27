/**
 * src/components/image/DownloadFeedbackModal.tsx
 *
 * Premium, design-system aligned dialog popup for image download feedback:
 * - Image thumbnail preview with glowing checkmark badge
 * - Native dark surface with subtle border and continuous corner curves
 * - Formatted title, resolution/type tag, and description
 * - "Done" / "Open Settings" action buttons matching ChatBox AI theme
 */

import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Pressable,
  TouchableWithoutFeedback,
  Dimensions,
  Linking,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import {
  IconCheck,
  IconAlertCircle,
  IconX,
  IconPhoto,
  IconSettings,
} from '@tabler/icons-react-native';
import { useThemeColors, radius, spacing } from '@/theme';

export type DownloadFeedbackType = 'success' | 'permission' | 'error';

interface DownloadFeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  type: DownloadFeedbackType;
  title?: string;
  message?: string;
  imageUrl?: string;
  savedToGallery?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const DownloadFeedbackModal: React.FC<DownloadFeedbackModalProps> = ({
  visible,
  onClose,
  type,
  title,
  message,
  imageUrl,
  savedToGallery = true,
}) => {
  const colors = useThemeColors();

  if (!visible) return null;

  const defaultTitle =
    type === 'success'
      ? savedToGallery
        ? 'Saved to Gallery'
        : 'Download Complete'
      : type === 'permission'
      ? 'Permission Required'
      : 'Download Failed';

  const defaultMessage =
    type === 'success'
      ? savedToGallery
        ? 'Your AI image has been saved to your device photos in high resolution.'
        : 'Your high-resolution image has been prepared and saved to your device.'
      : type === 'permission'
      ? 'Photo gallery access is required to save generated images directly to your device.'
      : 'Could not complete the image download. Please check your connection and try again.';

  const displayTitle = title || defaultTitle;
  const displayMessage = message || defaultMessage;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: colors.surface || '#1c1c20',
                  borderColor: colors.line || '#2a2a30',
                },
              ]}
            >
              {/* Close Button in corner */}
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.closeButton,
                  {
                    backgroundColor: colors.inset || '#202024',
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                hitSlop={8}
                accessibilityLabel="Close dialog"
              >
                <IconX size={16} color={colors.ink2 || '#a4a6ad'} />
              </Pressable>

              {/* Visual Icon / Thumbnail Area */}
              {type === 'success' ? (
                <View style={styles.previewContainer}>
                  {imageUrl ? (
                    <View
                      style={[
                        styles.imagePreviewWrap,
                        { borderColor: colors.line || '#2a2a30' },
                      ]}
                    >
                      <ExpoImage
                        source={{ uri: imageUrl }}
                        style={styles.imagePreview}
                        contentFit="cover"
                        transition={200}
                      />
                      {/* Floating glowing success badge */}
                      <View style={styles.successBadgeCorner}>
                        <IconCheck size={14} color="#ffffff" strokeWidth={3} />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.successCircle}>
                      <IconCheck size={28} color="#22c55e" strokeWidth={2.8} />
                    </View>
                  )}
                </View>
              ) : type === 'permission' ? (
                <View style={styles.warningCircle}>
                  <IconAlertCircle size={32} color="#f59e0b" strokeWidth={2.2} />
                </View>
              ) : (
                <View style={styles.errorCircle}>
                  <IconAlertCircle size={32} color="#ef4444" strokeWidth={2.2} />
                </View>
              )}

              {/* Title & Description */}
              <Text style={[styles.titleText, { color: colors.ink || '#f2f2f4' }]}>
                {displayTitle}
              </Text>

              <Text style={[styles.messageText, { color: colors.ink2 || '#a4a6ad' }]}>
                {displayMessage}
              </Text>

              {/* Quality & Format Tag (Success only) */}
              {type === 'success' && (
                <View
                  style={[
                    styles.tagBadge,
                    {
                      backgroundColor: colors.inset || '#202024',
                      borderColor: colors.line || '#2a2a30',
                    },
                  ]}
                >
                  <IconPhoto size={12} color={colors.ink3 || '#71737a'} />
                  <Text style={[styles.tagText, { color: colors.ink2 || '#a4a6ad' }]}>
                    PNG • High Quality {savedToGallery ? '• Photos' : ''}
                  </Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                {type === 'permission' ? (
                  <>
                    <Pressable
                      onPress={onClose}
                      style={({ pressed }) => [
                        styles.secondaryBtn,
                        {
                          backgroundColor: colors.inset || '#202024',
                          borderColor: colors.line || '#2a2a30',
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.secondaryBtnText, { color: colors.ink || '#f2f2f4' }]}>
                        Cancel
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        onClose();
                        Linking.openSettings().catch(() => {});
                      }}
                      style={({ pressed }) => [
                        styles.primaryBtn,
                        {
                          backgroundColor: colors.primary || '#fbfbfb',
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <IconSettings
                        size={16}
                        color={colors.primaryForeground || '#18181b'}
                        strokeWidth={2}
                      />
                      <Text
                        style={[
                          styles.primaryBtnText,
                          { color: colors.primaryForeground || '#18181b' },
                        ]}
                      >
                        Settings
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    onPress={onClose}
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      {
                        backgroundColor: colors.primary || '#fbfbfb',
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.primaryBtnText,
                        { color: colors.primaryForeground || '#18181b' },
                      ]}
                    >
                      Done
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    width: Math.min(SCREEN_WIDTH - 48, 330),
    borderRadius: 24,
    borderWidth: 1,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 22,
    alignItems: 'center',
    borderCurve: radius.borderCurve,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  previewContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  imagePreviewWrap: {
    width: 92,
    height: 92,
    borderRadius: 18,
    borderWidth: 1.5,
    position: 'relative',
    overflow: 'visible',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  successBadgeCorner: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#1c1c20',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
  successCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(34, 197, 94, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  errorCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  titleText: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
  },
  tagText: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    marginTop: 18,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 14,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
