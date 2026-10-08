/**
 * src/components/image/ImageCard.tsx
 *
 * Card component displaying an image generation turn:
 * - User prompt bubble (aligned right)
 * - Generated image / loading placeholder / failure state (aligned left)
 * - Action toolbar: Like, Dislike, Download/Share, Regenerate, Copy Prompt
 * - Fullscreen preview modal on image press
 */

import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import {
  IconDownload,
  IconRefresh,
  IconThumbUp,
  IconThumbDown,
  IconCopy,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconSparkles,
  IconWand,
} from '@tabler/icons-react-native';
import { GeneratedImageItem, imageService, normalizeImageUrl } from '@/services/imageService';
import { useThemeColors, typography, radius, spacing } from '@/theme';
import {
  DownloadFeedbackModal,
  DownloadFeedbackType,
} from './DownloadFeedbackModal';
import { DotMatrixLoader } from './DotMatrixLoader';

interface ImageCardProps {
  generation: GeneratedImageItem;
  onRegenerate: (generation: GeneratedImageItem) => void;
  onUseAsReference?: (imageUrl: string) => void;
  isRegenerating?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const ImageCard: React.FC<ImageCardProps> = ({
  generation,
  onRegenerate,
  onUseAsReference,
  isRegenerating = false,
}) => {
  const colors = useThemeColors();
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [reaction, setReaction] = useState<'liked' | 'disliked' | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState<{
    visible: boolean;
    type: DownloadFeedbackType;
    title?: string;
    message?: string;
    savedToGallery?: boolean;
  }>({
    visible: false,
    type: 'success',
    savedToGallery: true,
  });

  const rawUrl = generation.displayUrl || generation.publicUrl;
  const imageUrl = normalizeImageUrl(rawUrl, generation.generatedImagePath);
  const isCompleted = generation.status === 'completed' && Boolean(imageUrl);
  const isGenerating = generation.status === 'generating' || generation.isLocalPending || isRegenerating;
  const isFailed = generation.status === 'failed';

  const handleCopyPrompt = useCallback(async () => {
    if (!generation.prompt) return;
    await Clipboard.setStringAsync(generation.prompt);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, [generation.prompt]);

  const handleDownload = useCallback(async () => {
    if (!imageUrl) return;
    setIsDownloading(true);
    try {
      const fileName = `chatboxai_${generation.entryId || generation.libId || Date.now()}.png`;
      const res = await imageService.downloadImageToGallery(imageUrl, fileName);

      if (res.success && res.savedToGallery) {
        setFeedbackModal({
          visible: true,
          type: 'success',
          savedToGallery: true,
          title: 'Saved to Gallery',
          message: 'Image successfully downloaded and saved to your device photos in high resolution.',
        });
      } else if (res.permissionDenied) {
        setFeedbackModal({
          visible: true,
          type: 'permission',
          title: 'Permission Required',
          message: 'Photo gallery access is required to save generated images to your device.',
        });
      } else if (res.success) {
        setFeedbackModal({
          visible: true,
          type: 'success',
          savedToGallery: false,
          title: 'Download Ready',
          message: 'Your high-resolution image has been prepared and saved to your device.',
        });
      } else {
        setFeedbackModal({
          visible: true,
          type: 'error',
          title: 'Download Failed',
          message: res.errorMessage || 'Could not save the image. Please try again.',
        });
      }
    } catch (err: any) {
      setFeedbackModal({
        visible: true,
        type: 'error',
        title: 'Download Error',
        message: err?.message || 'An error occurred while saving the image.',
      });
    } finally {
      setIsDownloading(false);
    }
  }, [imageUrl, generation.entryId, generation.libId]);

  const handleReaction = useCallback((type: 'liked' | 'disliked') => {
    setReaction((prev) => (prev === type ? null : type));
  }, []);

  // Compute aspect ratio for image rendering
  const widthRatio = generation.width || 1024;
  const heightRatio = generation.height || 1024;
  const aspectRatio = widthRatio / heightRatio;

  return (
    <View style={styles.cardContainer}>
      {/* ── User Prompt Bubble (Right aligned) ── */}
      <View style={styles.promptRow}>
        <View
          style={[
            styles.promptBubble,
            {
              backgroundColor: colors.isDark ? '#1f1f23' : colors.surface2,
              borderColor: colors.line,
            },
          ]}
        >
          <Text style={[styles.promptText, { color: colors.ink }]}>
            {generation.prompt}
          </Text>
          {generation.hasReferenceImage && (
            <View style={styles.promptMetaRow}>
              <View style={[styles.metaBadge, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <Text style={[styles.metaBadgeText, { color: '#60a5fa' }]}>Edited from image</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* ── Image Output Container (Left aligned) ── */}
      <View style={styles.outputRow}>
        <View
          style={[
            styles.imageWrapper,
            {
              backgroundColor: colors.surface,
              borderColor: colors.line,
            },
          ]}
        >
          {isGenerating ? (
            <View style={[styles.loaderContainer, { aspectRatio, minHeight: undefined, padding: 0 }]}>
              <DotMatrixLoader size={Math.min(SCREEN_WIDTH - 64, (SCREEN_WIDTH - 64) / aspectRatio) * 0.7} />
            </View>
          ) : isCompleted ? (
            <Pressable
              onPress={() => setIsFullscreen(true)}
              style={({ pressed }) => [
                styles.imagePressable,
                { opacity: pressed ? 0.95 : 1 },
              ]}
            >
              <ExpoImage
                source={{ uri: imageUrl }}
                style={[
                  styles.image,
                  {
                    aspectRatio,
                    maxHeight: 460,
                  },
                ]}
                contentFit="contain"
                transition={250}
              />
            </Pressable>
          ) : isFailed ? (
            <View style={[styles.stateContainer, { minHeight: 220 }]}>
              <IconAlertCircle size={36} color="#ef4444" />
              <Text style={[styles.stateTitle, { color: '#ef4444' }]}>
                Generation Failed
              </Text>
              <Text style={[styles.stateSub, { color: colors.ink3 }]}>
                {generation.failMessage || 'The image could not be created. Please try again with different wording.'}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Action Toolbar ── */}
        {!isGenerating && isCompleted && (
          <View style={styles.toolbar}>
            {/* Like */}
            <Pressable
              disabled={!isCompleted}
              onPress={() => handleReaction('liked')}
              hitSlop={6}
              style={({ pressed }) => [
                styles.actionBtn,
                reaction === 'liked' && styles.actionBtnActiveLike,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <IconThumbUp
                size={16}
                color={reaction === 'liked' ? '#10b981' : colors.ink3}
              />
            </Pressable>

            {/* Dislike */}
            <Pressable
              disabled={!isCompleted}
              onPress={() => handleReaction('disliked')}
              hitSlop={6}
              style={({ pressed }) => [
                styles.actionBtn,
                reaction === 'disliked' && styles.actionBtnActiveDislike,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <IconThumbDown
                size={16}
                color={reaction === 'disliked' ? '#ef4444' : colors.ink3}
              />
            </Pressable>

            {/* Copy Prompt */}
            <Pressable
              onPress={handleCopyPrompt}
              hitSlop={6}
              style={({ pressed }) => [
                styles.actionBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              {isCopied ? (
                <IconCheck size={16} color={colors.accent} strokeWidth={2.5} />
              ) : (
                <IconCopy size={16} color={colors.ink3} />
              )}
            </Pressable>

            {/* Download / Share */}
            <Pressable
              disabled={!isCompleted || isDownloading}
              onPress={handleDownload}
              hitSlop={6}
              style={({ pressed }) => [
                styles.actionBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              {isDownloading ? (
                <ActivityIndicator size="small" color={colors.accent} style={{ transform: [{ scale: 0.7 }] }} />
              ) : (
                <IconDownload size={16} color={isCompleted ? colors.ink : colors.ink3} />
              )}
            </Pressable>

            {/* Regenerate */}
            <Pressable
              disabled={isRegenerating || isGenerating}
              onPress={() => onRegenerate(generation)}
              hitSlop={6}
              style={({ pressed }) => [
                styles.actionBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              {isRegenerating ? (
                <ActivityIndicator size="small" color={colors.accent} style={{ transform: [{ scale: 0.7 }] }} />
              ) : (
                <IconRefresh size={16} color={colors.ink} />
              )}
            </Pressable>

            {/* Use as Reference for Image-to-Image editing */}
            {isCompleted && onUseAsReference && (
              <Pressable
                onPress={() => onUseAsReference(imageUrl)}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.actionBtn,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <IconWand size={16} color={colors.accent} strokeWidth={1.8} />
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* ── Fullscreen Zoom/Inspection Modal ── */}
      {isCompleted && (
        <Modal
          visible={isFullscreen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsFullscreen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalHeader}>
              <Pressable
                onPress={handleDownload}
                style={styles.modalHeaderBtn}
                hitSlop={8}
                disabled={isDownloading}
                accessibilityLabel="Download image"
              >
                {isDownloading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <IconDownload size={20} color="#ffffff" />
                )}
              </Pressable>
              <Pressable
                onPress={() => setIsFullscreen(false)}
                style={styles.modalHeaderBtn}
                hitSlop={8}
                accessibilityLabel="Close fullscreen preview"
              >
                <IconX size={22} color="#ffffff" />
              </Pressable>
            </View>

            <ExpoImage
              source={{ uri: imageUrl }}
              style={styles.fullscreenImage}
              contentFit="contain"
            />
          </View>
        </Modal>
      )}

      {/* Custom Download Feedback Modal matching ChatBox AI design */}
      <DownloadFeedbackModal
        visible={feedbackModal.visible}
        onClose={() => setFeedbackModal((prev) => ({ ...prev, visible: false }))}
        type={feedbackModal.type}
        title={feedbackModal.title}
        message={feedbackModal.message}
        imageUrl={imageUrl}
        savedToGallery={feedbackModal.savedToGallery}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: '100%',
    gap: spacing.md,
    marginVertical: spacing.sm,
  },
  promptRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
  },
  promptBubble: {
    maxWidth: '82%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.xl,
    borderBottomRightRadius: radius.sm,
    borderWidth: 1,
    gap: 6,
  },
  promptText: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },
  promptMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  metaBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  outputRow: {
    width: '100%',
    alignItems: 'flex-start',
  },
  imageWrapper: {
    width: '100%',
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  imagePressable: {
    width: '100%',
  },
  image: {
    width: '100%',
    backgroundColor: '#0a0a0c',
  },
  stateContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.xs,
  },
  loaderContainer: {
    width: '100%',
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  pulsingOrb: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  stateTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  stateSub: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    maxWidth: '80%',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
    paddingHorizontal: 2,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnActiveLike: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  actionBtnActiveDislike: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeader: {
    position: 'absolute',
    top: 50,
    right: 20,
    left: 20,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  },
  modalHeaderBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenImage: {
    width: SCREEN_WIDTH,
    height: '85%',
  },
});
