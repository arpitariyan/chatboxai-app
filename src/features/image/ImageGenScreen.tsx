/**
 * src/features/image/ImageGenScreen.tsx
 *
 * Dedicated screen for multi-turn Image Generation and Image-to-Image editing.
 * Features:
 * - Real-time generation thread persistence with libId
 * - Follow-up generations within the same conversation
 * - Image model selector sheet
 * - Aspect ratio selector pills
 * - Single reference image picker for Image-to-Image mode
 * - Action toolbar (Download, Regenerate, Thumbs, Copy Prompt)
 * - Safe-area aware floating bottom composer
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  IconArrowUp,
  IconPhoto,
  IconPlus,
  IconX,
  IconWand,
  IconChevronDown,
  IconSparkles,
} from '@tabler/icons-react-native';
import {
  imageService,
  GeneratedImageItem,
} from '@/services/imageService';
import { generateUUID } from '@/services/chatService';
import {
  DEFAULT_IMAGE_MODEL_ID,
  getModelById,
  ImageModelConfig,
  getProviderIdByModelId,
} from '@/config/imageModels';
import { ImageCard } from '@/components/image/ImageCard';
import { AspectRatioSelector } from '@/components/image/AspectRatioSelector';
import { ImageModelSelectorSheet } from '@/components/image/ImageModelSelectorSheet';
import { useThemeColors, typography, radius, spacing } from '@/theme';
import { useAuth } from '@/contexts/AuthContext';

interface ImageGenScreenProps {
  initialLibId?: string | null;
  initialPrompt?: string;
  initialReferenceImageUri?: string | null;
  onConversationCreated?: (libId: string, title?: string) => void;
  onConversationActiveChange?: (isActive: boolean) => void;
  onConversationTitleChange?: (title: string) => void;
}

export const ImageGenScreen: React.FC<ImageGenScreenProps> = ({
  initialLibId,
  initialPrompt,
  initialReferenceImageUri,
  onConversationCreated,
  onConversationActiveChange,
  onConversationTitleChange,
}) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { currentUser } = useAuth();

  const [libId, setLibId] = useState<string>(() => initialLibId || generateUUID());
  const [generations, setGenerations] = useState<GeneratedImageItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(Boolean(initialLibId));
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  // Model & Ratio state
  const [selectedModel, setSelectedModel] = useState<ImageModelConfig>(() =>
    getModelById(DEFAULT_IMAGE_MODEL_ID)
  );
  const [selectedRatio, setSelectedRatio] = useState<string>('1:1');
  const [isModelSheetOpen, setIsModelSheetOpen] = useState<boolean>(false);

  // Reference image for Image-to-Image
  const [referenceImageUri, setReferenceImageUri] = useState<string | null>(
    initialReferenceImageUri || null
  );

  // Text composer state
  const [promptText, setPromptText] = useState<string>('');
  const flatListRef = useRef<FlatList>(null);
  const isInitialGeneratedRef = useRef(false);

  // Synchronize active conversation state with AppShell
  useEffect(() => {
    const hasItems = Boolean(initialLibId) || generations.length > 0;
    onConversationActiveChange?.(hasItems);
    return () => {
      onConversationActiveChange?.(false);
    };
  }, [generations.length, initialLibId, onConversationActiveChange]);

  // Load previous generations if opening existing libId
  useEffect(() => {
    if (!initialLibId) {
      setIsLoadingHistory(false);
      return;
    }

    let isMounted = true;
    imageService
      .fetchGenerations(initialLibId)
      .then((items) => {
        if (!isMounted) return;
        setGenerations(items);
        if (items.length > 0 && items[0].prompt) {
          onConversationTitleChange?.(items[0].prompt);
        }
      })
      .catch((err) => {
        console.error('[ImageGenScreen] Failed to load history:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingHistory(false);
      });

    return () => {
      isMounted = false;
    };
  }, [initialLibId, onConversationTitleChange]);

  // Handle auto-generation if initialPrompt was provided
  useEffect(() => {
    if (initialPrompt && !isInitialGeneratedRef.current && generations.length === 0) {
      isInitialGeneratedRef.current = true;
      handleGenerate(initialPrompt, referenceImageUri);
    }
  }, [initialPrompt]);

  // ── Reference image picker ────────────────────────────────────────────────
  const handlePickReferenceImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library permission is needed to choose a reference image.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 0.85,
        base64: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        setReferenceImageUri(asset.uri);
      }
    } catch {
      Alert.alert('Error', 'Failed to pick reference image.');
    }
  }, []);

  // ── Generation submission ─────────────────────────────────────────────────
  const handleGenerate = useCallback(
    async (textToGenerate: string, refUri?: string | null) => {
      const cleanPrompt = textToGenerate.trim();
      if (!cleanPrompt || isGenerating) return;

      if (!currentUser?.email) {
        Alert.alert('Sign In Required', 'Please sign in to generate images.');
        return;
      }

      const activeRatio = selectedModel.ratios.find((r) => r.value === selectedRatio) || selectedModel.ratios[0];
      const currentLibId = libId;
      const tempEntryId = `temp_${Date.now()}`;

      // Optimistic item
      const optimisticItem: GeneratedImageItem = {
        entryId: tempEntryId,
        libId: currentLibId,
        userEmail: currentUser.email,
        prompt: cleanPrompt,
        model: selectedModel.id,
        modelName: selectedModel.name,
        width: activeRatio.width,
        height: activeRatio.height,
        status: 'generating',
        created_at: new Date().toISOString(),
        publicUrl: '',
        generationType: refUri ? 'image-to-image' : 'text-to-image',
        hasReferenceImage: Boolean(refUri),
        isLocalPending: true,
      };

      setGenerations((prev) => [...prev, optimisticItem]);
      setPromptText('');
      setIsGenerating(true);

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      try {
        // Encode reference image to base64 if available
        let base64Data: string | null = null;
        if (refUri) {
          try {
            const response = await fetch(refUri);
            const blob = await response.blob();
            base64Data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } catch (e) {
            console.warn('[ImageGenScreen] Error converting image to base64:', e);
          }
        }

        const result = await imageService.generateImage({
          prompt: cleanPrompt,
          model: selectedModel.id,
          provider: selectedModel.provider,
          width: activeRatio.width,
          height: activeRatio.height,
          referenceImageBase64: base64Data,
          libId: currentLibId,
        });

        if (result.success) {
          const completedItem: GeneratedImageItem = {
            $id: result.docId,
            entryId: result.docId,
            libId: result.libId,
            userEmail: currentUser.email,
            prompt: result.prompt,
            model: result.model,
            modelName: result.modelName,
            width: result.width,
            height: result.height,
            status: 'completed',
            created_at: result.createdAt,
            publicUrl: result.publicUrl,
            displayUrl: result.imageUrl,
            generationType: result.generationType,
            hasReferenceImage: result.hasReferenceImage,
          };

          setGenerations((prev) =>
            prev.map((item) => (item.entryId === tempEntryId ? completedItem : item))
          );

          // Clear reference image after generation
          setReferenceImageUri(null);

          // Notify parent on first generation of the thread
          onConversationCreated?.(currentLibId, cleanPrompt);
          onConversationTitleChange?.(cleanPrompt);
        } else {
          throw new Error('Image generation failed.');
        }
      } catch (err: any) {
        console.error('[ImageGenScreen] Generation error:', err);
        setGenerations((prev) =>
          prev.map((item) =>
            item.entryId === tempEntryId
              ? {
                  ...item,
                  status: 'failed',
                  failMessage: err?.response?.data?.error || err.message || 'Generation failed',
                }
              : item
          )
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [
      currentUser?.email,
      isGenerating,
      libId,
      onConversationCreated,
      onConversationTitleChange,
      selectedModel,
      selectedRatio,
    ]
  );

  // ── Regeneration handler ──
  const handleRegenerate = useCallback(
    async (item: GeneratedImageItem) => {
      setRegeneratingId(item.entryId || item.libId);
      try {
        await handleGenerate(item.prompt, item.hasReferenceImage ? referenceImageUri : null);
      } finally {
        setRegeneratingId(null);
      }
    },
    [handleGenerate, referenceImageUri]
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* ── Generations Gallery List ── */}
      {isLoadingHistory ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.ink3 }]}>
            Loading images...
          </Text>
        </View>
      ) : generations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconBox, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <IconSparkles size={32} color={colors.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.ink }]}>
            Create Amazing Images
          </Text>
          <Text style={[styles.emptySub, { color: colors.ink3 }]}>
            Describe what you want to see, or attach an image to modify it with AI.
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={generations}
          keyExtractor={(item, index) => item.entryId || item.$id || String(index)}
          renderItem={({ item }) => (
            <ImageCard
              generation={item}
              onRegenerate={handleRegenerate}
              isRegenerating={regeneratingId === (item.entryId || item.libId)}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 140 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Persistent Floating Image Composer ── */}
      <View
        style={[
          styles.composerContainer,
          {
            backgroundColor: colors.background,
            borderColor: colors.line,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        {/* Top Controls: Model Selector Pill + Aspect Ratios */}
        <View style={styles.composerHeader}>
          <Pressable
            onPress={() => setIsModelSheetOpen(true)}
            style={({ pressed }) => [
              styles.modelPill,
              {
                backgroundColor: colors.surface,
                borderColor: colors.line,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <IconPhoto size={15} color={colors.accent} />
            <Text style={[styles.modelPillText, { color: colors.ink }]}>
              {selectedModel.name}
            </Text>
            <IconChevronDown size={14} color={colors.ink3} />
          </Pressable>

          <View style={styles.ratioWrapper}>
            <AspectRatioSelector
              ratios={selectedModel.ratios}
              selectedRatio={selectedRatio}
              onSelectRatio={setSelectedRatio}
              disabled={isGenerating}
            />
          </View>
        </View>

        {/* Reference Image Thumbnail Preview (if attached) */}
        {referenceImageUri && (
          <View style={styles.referencePreviewRow}>
            <View style={[styles.refThumbWrap, { borderColor: colors.line }]}>
              <ExpoImage
                source={{ uri: referenceImageUri }}
                style={styles.refThumb}
                contentFit="cover"
              />
              <Pressable
                onPress={() => setReferenceImageUri(null)}
                style={styles.removeRefBtn}
                hitSlop={6}
              >
                <IconX size={12} color="#ffffff" />
              </Pressable>
            </View>
            <View style={styles.refInfo}>
              <Text style={[styles.refTitle, { color: colors.ink }]}>Reference Image</Text>
              <Text style={[styles.refSub, { color: colors.ink3 }]}>Image-to-Image editing active</Text>
            </View>
          </View>
        )}

        {/* Input Bar */}
        <View style={[styles.inputBar, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          {/* Pick Reference Image (+) */}
          <Pressable
            onPress={handlePickReferenceImage}
            disabled={isGenerating}
            hitSlop={6}
            style={({ pressed }) => [
              styles.attachBtn,
              referenceImageUri && styles.attachBtnActive,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            {referenceImageUri ? (
              <IconWand size={19} color={colors.accent} />
            ) : (
              <IconPlus size={20} color={colors.ink3} />
            )}
          </Pressable>

          {/* Prompt TextInput */}
          <TextInput
            style={[styles.input, { color: colors.ink }]}
            placeholder={
              referenceImageUri
                ? 'Describe the changes or edits you want...'
                : 'Describe the image you want to generate...'
            }
            placeholderTextColor={colors.ink3}
            value={promptText}
            onChangeText={setPromptText}
            multiline
            maxLength={1000}
            editable={!isGenerating}
          />

          {/* Submit Button */}
          <Pressable
            disabled={!promptText.trim() || isGenerating}
            onPress={() => handleGenerate(promptText, referenceImageUri)}
            hitSlop={6}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: promptText.trim() ? colors.accent : colors.inset,
                opacity: pressed ? 0.8 : promptText.trim() ? 1 : 0.5,
              },
            ]}
          >
            {isGenerating ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <IconArrowUp size={18} color="#ffffff" strokeWidth={2.5} />
            )}
          </Pressable>
        </View>
      </View>

      {/* ── Image Model Selector Bottom Sheet ── */}
      <ImageModelSelectorSheet
        visible={isModelSheetOpen}
        onClose={() => setIsModelSheetOpen(false)}
        selectedModelId={selectedModel.id}
        onSelectModel={(model) => {
          setSelectedModel(model);
          // Adjust aspect ratio if current is not supported
          if (!model.ratios.some((r) => r.value === selectedRatio)) {
            setSelectedRatio(model.ratios[0]?.value || '1:1');
          }
        }}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: typography.fontSize.sm,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySub: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  composerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.xs + 2,
  },
  composerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  modelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    gap: 6,
    maxWidth: 160,
  },
  modelPillText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  ratioWrapper: {
    flex: 1,
    alignItems: 'flex-end',
  },
  referencePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  refThumbWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  refThumb: {
    width: '100%',
    height: '100%',
  },
  removeRefBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refInfo: {
    gap: 2,
  },
  refTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  refSub: {
    fontSize: 11,
  },
  inputBar: {
    minHeight: 52,
    maxHeight: 120,
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs + 4,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  attachBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachBtnActive: {
    backgroundColor: 'rgba(192, 132, 252, 0.15)',
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
    maxHeight: 100,
    paddingVertical: 4,
    paddingHorizontal: spacing.xs,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
