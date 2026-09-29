import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Modal,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import {
  IconArrowLeft,
  IconDownload,
  IconX,
  IconRefresh,
  IconPhoto,
  IconCopy,
  IconCheck,
} from '@tabler/icons-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColors, typography, spacing, radius } from '@/theme';
import { imageService, GeneratedImageItem, normalizeImageUrl } from '@/services/imageService';
import { DownloadFeedbackModal, DownloadFeedbackType } from '@/components/image/DownloadFeedbackModal';

interface ImagesScreenProps {
  onBack: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_COUNT = 2;
const GRID_PADDING = spacing.md;
const GRID_GAP = spacing.sm;
const ITEM_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

export const ImagesScreen: React.FC<ImagesScreenProps> = ({ onBack }) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { currentUser } = useAuth();

  const [images, setImages] = useState<GeneratedImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [selectedImage, setSelectedImage] = useState<GeneratedImageItem | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

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

  const loadImages = useCallback(async (isPullRefresh = false) => {
    if (!currentUser?.email) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (isPullRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const fetchedImages = await imageService.fetchAllUserImages(currentUser.email);
      setImages(fetchedImages);
    } catch (err: any) {
      if (__DEV__) {
        console.warn('[ImagesScreen] Failed to load images:', err?.message || err);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser?.email]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const handleDownload = useCallback(async (image: GeneratedImageItem) => {
    const rawUrl = image.displayUrl || image.publicUrl;
    const imageUrl = normalizeImageUrl(rawUrl, image.generatedImagePath);
    if (!imageUrl) return;

    setIsDownloading(true);
    try {
      const fileName = `chatboxai_${image.entryId || image.libId || Date.now()}.png`;
      const res = await imageService.downloadImageToGallery(imageUrl, fileName);

      if (res.success && res.savedToGallery) {
        setFeedbackModal({
          visible: true,
          type: 'success',
          savedToGallery: true,
          title: 'Saved to Gallery',
          message: 'The image has been saved to your device gallery.',
        });
      } else if (res.success && res.uri) {
        // Fallback sharing sheet opened
      } else {
        throw new Error(res.errorMessage || 'Download failed');
      }
    } catch (err: any) {
      setFeedbackModal({
        visible: true,
        type: 'error',
        savedToGallery: false,
        title: 'Download Failed',
        message: err.message || 'There was an error saving your image.',
      });
    } finally {
      setIsDownloading(false);
    }
  }, []);

  const handleCopyPrompt = useCallback(async (promptText: string) => {
    if (!promptText) return;
    await Clipboard.setStringAsync(promptText);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  }, []);

  const renderItem = ({ item }: { item: GeneratedImageItem }) => {
    const rawUrl = item.displayUrl || item.publicUrl;
    const imageUrl = normalizeImageUrl(rawUrl, item.generatedImagePath);
    
    return (
      <Pressable
        style={({ pressed }) => [
          styles.gridItem,
          {
            backgroundColor: colors.surface,
            borderColor: colors.line,
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.985 : 1 }],
          },
        ]}
        onPress={() => setSelectedImage(item)}
      >
        <ExpoImage
          source={{ uri: imageUrl }}
          style={styles.gridImage}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.gridPromptOverlay}>
          <Text style={styles.gridPromptText} numberOfLines={2}>
            {item.prompt}
          </Text>
        </View>
      </Pressable>
    );
  };

  const selectedImageUrl = selectedImage
    ? normalizeImageUrl(selectedImage.displayUrl || selectedImage.publicUrl, selectedImage.generatedImagePath)
    : null;
  const selectedImageAspect = selectedImage
    ? (selectedImage.width && selectedImage.height ? selectedImage.width / selectedImage.height : 1)
    : 1;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header: Exactly matches Home page Header.tsx ── */}
      <View
        style={[
          styles.headerContainer,
          {
            backgroundColor: colors.background,
            paddingTop: Math.max(insets.top, 12),
          },
        ]}
      >
        <View style={styles.headerRow}>
          {/* Left Action: Back button */}
          <Pressable
            onPress={onBack}
            hitSlop={8}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: pressed ? colors.hover : colors.surface,
                borderColor: colors.line,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <IconArrowLeft size={20} color={colors.ink} strokeWidth={2} />
          </Pressable>

          {/* Centered Title */}
          <View style={styles.titleContainer} pointerEvents="none">
            <Text style={[styles.headerTitle, { color: colors.ink }]}>Images</Text>
          </View>

          {/* Right Action: Refresh button */}
          <Pressable
            onPress={() => loadImages(true)}
            hitSlop={8}
            accessibilityLabel="Refresh images"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: pressed ? colors.hover : colors.surface,
                borderColor: colors.line,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <IconRefresh size={18} color={colors.ink} strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      {/* ── Main Content ── */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent || colors.ink} />
          <Text style={[styles.loadingText, { color: colors.ink3 }]}>Loading your images...</Text>
        </View>
      ) : images.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <IconPhoto size={32} color={colors.ink3} strokeWidth={1.8} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.ink }]}>No images generated yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.ink3 }]}>
            Images created with AI will automatically appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={images}
          keyExtractor={(item) => item.entryId || item.libId || item.$id || Math.random().toString()}
          renderItem={renderItem}
          numColumns={COLUMN_COUNT}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadImages(true)}
              tintColor={colors.accent || colors.ink}
            />
          }
        />
      )}

      {/* ── Fullscreen Viewer Modal ── */}
      <Modal
        visible={!!selectedImage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.fullscreenOverlay}>
          {/* Top Navbar */}
          <View style={[styles.fullscreenHeader, { paddingTop: Math.max(insets.top, 12) }]}>
            <Pressable
              onPress={() => setSelectedImage(null)}
              hitSlop={8}
              accessibilityLabel="Close"
              accessibilityRole="button"
              style={[styles.modalIconButton, { backgroundColor: 'rgba(0,0,0,0.6)', borderColor: 'rgba(255,255,255,0.15)' }]}
            >
              <IconX size={20} color="#ffffff" strokeWidth={2} />
            </Pressable>

            {selectedImage && (
              <Pressable
                onPress={() => handleDownload(selectedImage)}
                disabled={isDownloading}
                hitSlop={8}
                accessibilityLabel="Download image"
                accessibilityRole="button"
                style={[styles.modalIconButton, { backgroundColor: 'rgba(0,0,0,0.6)', borderColor: 'rgba(255,255,255,0.15)' }]}
              >
                {isDownloading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <IconDownload size={20} color="#ffffff" strokeWidth={2} />
                )}
              </Pressable>
            )}
          </View>

          {/* Centered Image */}
          {selectedImageUrl && (
            <View style={styles.fullscreenImageContainer}>
              <ExpoImage
                source={{ uri: selectedImageUrl }}
                style={[styles.fullscreenImage, { aspectRatio: selectedImageAspect }]}
                contentFit="contain"
              />
            </View>
          )}

          {/* Bottom Card / Actions */}
          <View style={[styles.fullscreenFooter, { paddingBottom: Math.max(insets.bottom + 8, 20) }]}>
            <View style={styles.fullscreenPromptCard}>
              <View style={styles.promptHeaderRow}>
                <Text style={styles.promptLabel}>Prompt</Text>
                {selectedImage?.prompt ? (
                  <Pressable
                    onPress={() => handleCopyPrompt(selectedImage.prompt)}
                    hitSlop={6}
                    style={styles.copyBtn}
                  >
                    {copiedPrompt ? (
                      <IconCheck size={14} color="#4ade80" strokeWidth={2.2} />
                    ) : (
                      <IconCopy size={14} color="#a1a1aa" strokeWidth={2} />
                    )}
                    <Text style={[styles.copyBtnText, copiedPrompt && { color: '#4ade80' }]}>
                      {copiedPrompt ? 'Copied' : 'Copy'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.fullscreenPromptText} numberOfLines={3}>
                {selectedImage?.prompt || 'AI generated image'}
              </Text>
            </View>

            <Pressable
              onPress={() => selectedImage && handleDownload(selectedImage)}
              disabled={isDownloading}
              style={({ pressed }) => [
                styles.fullscreenDownloadBtn,
                {
                  opacity: isDownloading ? 0.6 : pressed ? 0.85 : 1,
                  backgroundColor: colors.ink,
                },
              ]}
            >
              {isDownloading ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <>
                  <IconDownload size={18} color={colors.background} strokeWidth={2.2} />
                  <Text style={[styles.fullscreenDownloadText, { color: colors.background }]}>
                    Save to Gallery
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Download Feedback Modal */}
      <DownloadFeedbackModal
        visible={feedbackModal.visible}
        type={feedbackModal.type}
        title={feedbackModal.title}
        message={feedbackModal.message}
        onClose={() => setFeedbackModal((p) => ({ ...p, visible: false }))}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    width: '100%',
    borderBottomWidth: 0,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    zIndex: 10,
  },
  headerRow: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderCurve: radius.borderCurve,
  },
  titleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.sm,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
  listContent: {
    padding: GRID_PADDING,
    paddingBottom: 100,
  },
  columnWrapper: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  gridItem: {
    width: ITEM_WIDTH,
    height: ITEM_WIDTH,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    borderCurve: radius.borderCurve,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridPromptOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  gridPromptText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '500',
    lineHeight: 14,
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'space-between',
  },
  fullscreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    zIndex: 10,
    height: 60,
  },
  modalIconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImageContainer: {
    ...StyleSheet.absoluteFill as any,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
    zIndex: 1,
  },
  fullscreenImage: {
    width: '100%',
    maxHeight: '75%',
  },
  fullscreenFooter: {
    paddingHorizontal: spacing.md,
    zIndex: 10,
    gap: spacing.sm,
  },
  fullscreenPromptCard: {
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    borderCurve: radius.borderCurve,
  },
  promptHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  promptLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copyBtnText: {
    fontSize: 11,
    color: '#a1a1aa',
    fontWeight: '500',
  },
  fullscreenPromptText: {
    color: '#ffffff',
    fontSize: typography.fontSize.sm,
    lineHeight: 18,
  },
  fullscreenDownloadBtn: {
    height: 48,
    borderRadius: radius.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderCurve: radius.borderCurve,
  },
  fullscreenDownloadText: {
    fontWeight: '600',
    fontSize: typography.fontSize.base,
  },
});
