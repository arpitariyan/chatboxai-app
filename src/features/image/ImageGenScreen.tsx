/**
 * src/features/image/ImageGenScreen.tsx
 *
 * Dedicated screen for multi-turn Image Generation and Image-to-Image editing.
 * Uses the exact same KeyboardWrapper architecture as ChatScreen for correct
 * keyboard handling on both iOS and Android.
 * Features:
 * - Real-time generation thread persistence with libId
 * - Follow-up generations within the same conversation
 * - Design-system-aligned image model selector and aspect ratio chips
 * - Single reference image picker for Image-to-Image mode
 * - Action toolbar (Download, Regenerate, Thumbs, Copy Prompt)
 * - Top/bottom cinematic fade gradients matching ChatScreen
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Platform,
  ActivityIndicator,
  Alert,
  Keyboard,
  Animated,
  LayoutChangeEvent,
  Image as RNImage,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {
  IconArrowUp,
  IconPhoto,
  IconPlus,
  IconX,
  IconWand,
  IconChevronDown,
  IconMicrophone,
} from '@tabler/icons-react-native';
import {
  imageService,
  GeneratedImageItem,
} from '@/services/imageService';
import { generateUUID } from '@/services/chatService';
import {
  DEFAULT_IMAGE_MODEL_ID,
  DEFAULT_TEXT_TO_IMAGE_MODEL_ID,
  DEFAULT_IMAGE_TO_IMAGE_MODEL_ID,
  DEFAULT_CLOUDFLARE_MODEL_ID,
  getModelById,
  getMaxReferenceImagesForModel,
  ImageModelConfig,
} from '@/config/imageModels';
import { ImageCard } from '@/components/image/ImageCard';
import { AspectRatioSelector } from '@/components/image/AspectRatioSelector';
import { ImageModelSelectorSheet, getImageModelLogo } from '@/components/image/ImageModelSelectorSheet';
import { ImageSourceSheet } from '@/components/image/ImageSourceSheet';
import { SuggestionCards } from '@/components/chat/SuggestionCards';
import { VoiceOverlay } from '@/components/chat/VoiceOverlay';
import { VoiceWaveformBar } from '@/components/chat/VoiceWaveformBar';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { useThemeColors, typography, radius, spacing } from '@/theme';
import { useAuth } from '@/contexts/AuthContext';
import { getFadeGradientConfig } from '@/utils/gradientFade';
import { checkDailyImageQuota, ImageQuotaResult } from '@/services/creditEngine';
import { UpgradePlanModal } from '@/components/common/UpgradePlanModal';
import { normalizePlan } from '@/config/subscriptionPlans';

const darkLogo = require('../../../assets/images/logo.png');
const lightLogo = require('../../../assets/images/Chatboxai_logo_main.png');

// ─────────────────────────────────────────────────────────────────────────────
// KeyboardWrapper — exact mirror of ChatScreen's approach.
// Placed at module level so the animated component type is created exactly once.
// ─────────────────────────────────────────────────────────────────────────────
const AnimatedView = Animated.createAnimatedComponent(View);

const KeyboardWrapper: React.FC<{
  children: React.ReactNode;
  backgroundColor: string;
}> = ({ children, backgroundColor }) => {
  const androidKeyboardOffset = useRef(new Animated.Value(0)).current;
  const initialLayoutHeight = useRef<number>(0);
  const currentLayoutHeight = useRef<number>(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      const kh = e?.endCoordinates?.height || 0;
      const heightDiff =
        initialLayoutHeight.current - currentLayoutHeight.current;

      if (heightDiff >= kh * 0.7) {
        // OS resized the window itself — keep 0 immediately without JS layout thrashing
        androidKeyboardOffset.setValue(0);
      } else {
        // Manual offset required, snappy 90ms duration
        Animated.timing(androidKeyboardOffset, {
          toValue: kh,
          duration: 90,
          useNativeDriver: false,
        }).start();
      }
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      androidKeyboardOffset.setValue(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [androidKeyboardOffset]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (initialLayoutHeight.current === 0 || h > initialLayoutHeight.current) {
      initialLayoutHeight.current = h;
    }
    currentLayoutHeight.current = h;
  }, []);

  return (
    <AnimatedView
      style={[
        { flex: 1, backgroundColor },
        Platform.OS === 'android' && {
          paddingBottom: androidKeyboardOffset,
        },
      ]}
      onLayout={Platform.OS === 'android' ? handleLayout : undefined}
    >
      {children}
    </AnimatedView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export interface ReferenceImageItem {
  id: string;
  uri: string;
  name?: string;
}

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
  const logoImg = colors.isDark ? darkLogo : lightLogo;
  const insets = useSafeAreaInsets();
  const { currentUser, userProfile } = useAuth();
  const inputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // libId is stable for the lifetime of this screen instance
  const [libId] = useState<string>(() => initialLibId || generateUUID());
  const [generations, setGenerations] = useState<GeneratedImageItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(
    Boolean(initialLibId)
  );
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  // Model & Ratio - default to Leonardo Flux Schnell Pro for text-only, Cloudflare Klein 4B if starting with a reference image
  const [selectedModel, setSelectedModel] = useState<ImageModelConfig>(() => {
    if (initialReferenceImageUri) {
      return getModelById(DEFAULT_IMAGE_TO_IMAGE_MODEL_ID);
    }
    return getModelById(DEFAULT_TEXT_TO_IMAGE_MODEL_ID);
  });
  const [selectedRatio, setSelectedRatio] = useState<string>('1:1');
  const [isModelSheetOpen, setIsModelSheetOpen] = useState<boolean>(false);
  const [isSourceSheetOpen, setIsSourceSheetOpen] = useState<boolean>(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState<boolean>(false);
  const activeLogoInfo = useMemo(() => getImageModelLogo(selectedModel), [selectedModel]);

  // ── Plan & Daily Image Quota ──────────────────────────────────────────────
  const userPlan = normalizePlan(userProfile?.plan);
  const [quotaInfo, setQuotaInfo] = useState<ImageQuotaResult | null>(null);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState<boolean>(false);

  const loadQuota = useCallback(async () => {
    try {
      const q = await checkDailyImageQuota(userProfile);
      setQuotaInfo(q);
    } catch {
      // non-fatal
    }
  }, [userProfile]);

  useEffect(() => {
    loadQuota();
  }, [loadQuota]);

  // ── Speech-to-Text hook ───────────────────────────────────────────────────
  const {
    isListening,
    isTranscribing,
    audioLevel,
    startListening,
    stopListening,
    cancelListening,
  } = useSpeechToText({
    onTranscript: (newText) => {
      setPromptText((prev) => {
        const trimmedPrev = prev.trim();
        if (!trimmedPrev) return newText;
        return `${trimmedPrev} ${newText}`;
      });
    },
    onError: (err, msg) => {
      if (err !== 'NO_SPEECH') {
        Alert.alert('Speech to Text', msg);
      }
    },
  });

  const handleMicPress = useCallback(() => {
    Keyboard.dismiss();
    startListening();
  }, [startListening]);

  // Reference images (multi-reference support up to model limit)
  const [referenceImages, setReferenceImages] = useState<ReferenceImageItem[]>(() => {
    if (initialReferenceImageUri) {
      return [{ id: `ref_init_${Date.now()}`, uri: initialReferenceImageUri }];
    }
    return [];
  });

  const maxRefImages = useMemo(
    () => getMaxReferenceImagesForModel(selectedModel.id),
    [selectedModel.id]
  );

  // Automatically switch to Cloudflare FLUX.2 Klein 4B for Image-to-Image editing
  const switchToImg2ImgModel = useCallback(() => {
    const cfModel = getModelById(DEFAULT_IMAGE_TO_IMAGE_MODEL_ID);
    setSelectedModel(cfModel);
    if (!cfModel.ratios.some((r) => r.value === selectedRatio)) {
      setSelectedRatio('1:1');
    }
  }, [selectedRatio]);

  // Automatically switch to Leonardo Flux Schnell Pro for Text-to-Image generation
  const switchToTextToImageModel = useCallback(() => {
    const textModel = getModelById(DEFAULT_TEXT_TO_IMAGE_MODEL_ID);
    setSelectedModel(textModel);
    if (!textModel.ratios.some((r) => r.value === selectedRatio)) {
      setSelectedRatio('1:1');
    }
  }, [selectedRatio]);

  // Composer text
  const [promptText, setPromptText] = useState<string>('');
  const flatListRef = useRef<FlatList>(null);
  const isInitialGeneratedRef = useRef(false);

  // Stable gradient configs
  const topFadeConfig = useMemo(
    () => getFadeGradientConfig(colors.background, 'toTransparent'),
    [colors.background]
  );
  const bottomFadeConfig = useMemo(
    () => getFadeGradientConfig(colors.background, 'fromTransparent'),
    [colors.background]
  );

  // Active conversation guard for AppShell header
  useEffect(() => {
    const hasItems = Boolean(initialLibId) || generations.length > 0;
    onConversationActiveChange?.(hasItems);
    return () => {
      onConversationActiveChange?.(false);
    };
  }, [generations.length, initialLibId, onConversationActiveChange]);

  // Load history for existing libId
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
        // Ensure both URL fields are populated consistently
        const normalized = items.map((item) => ({
          ...item,
          publicUrl: item.publicUrl || item.displayUrl || '',
          displayUrl: item.displayUrl || item.publicUrl || '',
        }));
        setGenerations(normalized);
        if (normalized.length > 0 && normalized[0].prompt) {
          onConversationTitleChange?.(normalized[0].prompt);
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

  // Auto-generate on first mount if initialPrompt provided
  useEffect(() => {
    if (
      initialPrompt &&
      !isInitialGeneratedRef.current &&
      generations.length === 0
    ) {
      isInitialGeneratedRef.current = true;
      handleGenerate(initialPrompt, referenceImages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  // ── Reference image picker (Camera or Photos) ─────────────────────────────
  const handlePickFromSource = useCallback(
    async (source: 'camera' | 'library') => {
      const cfModel = getModelById(DEFAULT_IMAGE_TO_IMAGE_MODEL_ID);
      const targetMax = cfModel.maxReferenceImages || 4;
      const remainingSlots = Math.max(0, targetMax - referenceImages.length);

      if (remainingSlots <= 0) {
        Alert.alert(
          'Limit Reached',
          `Maximum of ${targetMax} reference images reached. Please remove an image before adding another.`
        );
        return;
      }


      try {
        if (source === 'camera') {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert(
              'Permission Required',
              'Camera permission is needed to take a photo for image editing.'
            );
            return;
          }

          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: 'images',
            // Requesting quality 0.85 causes expo-image-picker to transcode
            // any HEIC/HEIF camera output to JPEG before returning the URI.
            quality: 0.85,
            base64: false,
            exif: false,
          });

          if (!result.canceled && result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            const newItem: ReferenceImageItem = {
              id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              uri: asset.uri,
              name: asset.fileName || 'camera_photo.jpg',
            };

            setReferenceImages((prev) => [...prev, newItem]);
            // Automatically switch to Cloudflare FLUX.2 Klein 4B for Image-to-Image editing
            switchToImg2ImgModel();
          }
        } else {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert(
              'Permission Required',
              'Photo library permission is needed to select reference images.'
            );
            return;
          }

          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsMultipleSelection: remainingSlots > 1,
            selectionLimit: remainingSlots,
            // Setting quality forces a JPEG transcode of HEIC/HEIF images
            // on Android/iOS before the URI is returned.
            quality: 0.85,
            base64: false,
            exif: false,
          });

          if (!result.canceled && result.assets && result.assets.length > 0) {
            const picked: ReferenceImageItem[] = result.assets.slice(0, remainingSlots).map((asset, idx) => ({
              id: `ref_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
              uri: asset.uri,
              name: asset.fileName || `photo_${idx}.jpg`,
            }));

            setReferenceImages((prev) => [...prev, ...picked]);
            // Automatically switch to Cloudflare FLUX.2 Klein 4B for Image-to-Image editing
            switchToImg2ImgModel();
          }
        }
      } catch (err) {
        console.error('[ImageGenScreen] Failed to pick image:', err);
        Alert.alert('Error', 'Failed to pick image. Please try again.');
      }
    },
    [referenceImages.length, switchToImg2ImgModel]
  );

  const handleChooseImageSource = useCallback(() => {
    const cfModel = getModelById(DEFAULT_IMAGE_TO_IMAGE_MODEL_ID);
    const maxRefs = cfModel.maxReferenceImages || 4;
    if (referenceImages.length >= maxRefs) {
      Alert.alert(
        'Limit Reached',
        `Maximum of ${maxRefs} reference images reached.`
      );
      return;
    }

    setIsSourceSheetOpen(true);
  }, [referenceImages.length]);

  const handleRemoveReferenceImage = useCallback(
    (id: string) => {
      setReferenceImages((prev) => {
        const next = prev.filter((item) => item.id !== id);
        if (next.length === 0) {
          // If the reference image is removed before sending, switch back to default Flux Schnell Pro
          switchToTextToImageModel();
        }
        return next;
      });
    },
    [switchToTextToImageModel]
  );

  const handleClearAllReferenceImages = useCallback(() => {
    setReferenceImages([]);
    // Switch back to default text-to-image model (Flux Schnell Pro)
    switchToTextToImageModel();
  }, [switchToTextToImageModel]);

  const handleUseAsReference = useCallback(
    (imageUrl: string) => {
      const cfModel = getModelById(DEFAULT_IMAGE_TO_IMAGE_MODEL_ID);
      const targetMax = cfModel.maxReferenceImages || 4;
      // Automatically switch to Cloudflare FLUX.2 Klein 4B for Image-to-Image editing
      switchToImg2ImgModel();

      setReferenceImages((prev) => {
        if (prev.length >= targetMax) {
          return [
            ...prev.slice(0, targetMax - 1),
            { id: `ref_use_${Date.now()}`, uri: imageUrl },
          ];
        }
        return [...prev, { id: `ref_use_${Date.now()}`, uri: imageUrl }];
      });

      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    },
    [switchToImg2ImgModel]
  );

  // ── Generation ────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(
    async (textToGenerate: string, overrideRefImages?: ReferenceImageItem[]) => {
      const cleanPrompt = textToGenerate.trim();
      if (!cleanPrompt || isGenerating) return;

      if (!currentUser?.email) {
        Alert.alert('Sign In Required', 'Please sign in to generate images.');
        return;
      }

      // Check daily image quota (10/day for Free plan, unlimited for Pro/Max)
      const currentQuota = await checkDailyImageQuota(userProfile);
      setQuotaInfo(currentQuota);
      if (!currentQuota.canGenerate) {
        setUpgradeModalVisible(true);
        return;
      }

      const refsToUse = overrideRefImages !== undefined ? overrideRefImages : referenceImages;
      const isImg2Img = refsToUse.length > 0;

      // Model resolution:
      // - Reference image attached -> automatically route through Cloudflare FLUX.2 Klein 4B
      // - Text prompt only -> keep Leonardo Flux Schnell Pro (or user's selected text model)
      const activeModel = isImg2Img
        ? getModelById(DEFAULT_IMAGE_TO_IMAGE_MODEL_ID)
        : (selectedModel.supportsImageToImage ? getModelById(DEFAULT_TEXT_TO_IMAGE_MODEL_ID) : selectedModel);

      // Keep UI state synchronized
      if (selectedModel.id !== activeModel.id) {
        setSelectedModel(activeModel);
      }

      const activeRatio =
        activeModel.ratios.find((r) => r.value === selectedRatio) ||
        activeModel.ratios[0];
      const currentLibId = libId;
      const tempEntryId = `temp_${Date.now()}`;

      const optimisticItem: GeneratedImageItem = {
        entryId: tempEntryId,
        libId: currentLibId,
        userEmail: currentUser.email,
        prompt: cleanPrompt,
        model: activeModel.id,
        modelName: activeModel.name,
        width: activeRatio.width,
        height: activeRatio.height,
        status: 'generating',
        created_at: new Date().toISOString(),
        publicUrl: '',
        generationType: isImg2Img ? 'image-to-image' : 'text-to-image',
        hasReferenceImage: isImg2Img,
        referenceImageCount: refsToUse.length,
        isLocalPending: true,
      };

      setGenerations((prev) => [...prev, optimisticItem]);
      setPromptText('');
      setIsGenerating(true);
      Keyboard.dismiss();

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      try {
        const base64List: string[] = [];
        if (isImg2Img) {
          for (const ref of refsToUse) {
            try {
              if (ref.uri.startsWith('data:image/')) {
                // Already a valid data URI — use as-is
                base64List.push(ref.uri);
              } else if (ref.uri.startsWith('http://') || ref.uri.startsWith('https://')) {
                // Remote URL — pass raw URL to the server so it can fetch on
                // its own without going through the slow RN blob bridge
                base64List.push(ref.uri);
              } else {
                // Local file URI (file:// or content://) ─ read directly with
                // FileSystem to avoid React Native's Blob bridge overhead
                const b64 = await FileSystem.readAsStringAsync(ref.uri, {
                  encoding: FileSystem.EncodingType.Base64,
                });
                if (b64) {
                  // Wrap in a data URI with a safe JPEG content-type;
                  // the server strips the prefix before passing to sharp.
                  base64List.push(`data:image/jpeg;base64,${b64}`);
                }
              }
            } catch (e) {
              console.warn('[ImageGenScreen] ref-image base64 conversion failed:', ref.uri, e);
            }
          }
        }

        const result = await imageService.generateImage({
          prompt: cleanPrompt,
          model: activeModel.id,
          provider: activeModel.provider,
          width: activeRatio.width,
          height: activeRatio.height,
          referenceImageBase64: base64List[0] || null,
          referenceImages: base64List.length > 0 ? base64List : undefined,
          libId: currentLibId,
        });

        if (result.success) {
          const finalUrl = result.imageUrl || result.publicUrl;
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
            publicUrl: finalUrl,
            displayUrl: finalUrl,
            generationType: result.generationType,
            hasReferenceImage: result.hasReferenceImage,
            referenceImageCount: result.referenceImageCount || base64List.length,
          };

          setGenerations((prev) =>
            prev.map((item) =>
              item.entryId === tempEntryId ? completedItem : item
            )
          );

          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 200);

          setReferenceImages([]);
          // Switch back to default text-to-image model (Flux Schnell Pro) for subsequent text prompt
          switchToTextToImageModel();
          onConversationCreated?.(currentLibId, cleanPrompt);
          onConversationTitleChange?.(cleanPrompt);
          // Refresh daily quota
          checkDailyImageQuota(userProfile).then(setQuotaInfo).catch(() => {});
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
                failMessage:
                  err?.response?.data?.error ||
                  err.message ||
                  'Generation failed',
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
      referenceImages,
      selectedModel,
      selectedRatio,
      switchToTextToImageModel,
    ]
  );

  const handleRegenerate = useCallback(
    async (item: GeneratedImageItem) => {
      setRegeneratingId(item.entryId || item.libId);
      try {
        await handleGenerate(
          item.prompt,
          item.hasReferenceImage && referenceImages.length > 0 ? referenceImages : []
        );
      } finally {
        setRegeneratingId(null);
      }
    },
    [handleGenerate, referenceImages]
  );

  const composerBottomPadding = Math.max(insets.bottom, 16);

  return (
    <KeyboardWrapper backgroundColor={colors.background}>
      {/* ── Gallery + fade edges ── */}
      <View style={styles.scrollWrapper}>
        {isLoadingHistory ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.ink3 }]}>
              Loading images...
            </Text>
          </View>
        ) : generations.length === 0 ? (
          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: 72 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            <Pressable style={styles.newChatGreeting} onPress={Keyboard.dismiss}>
              <RNImage source={logoImg} style={styles.brandLogo} resizeMode="contain" />
              <Text style={[styles.greetingTitle, { color: colors.ink }]}>
                Hello, {currentUser?.displayName || userProfile?.name || 'there'}!
              </Text>
              <Text style={[styles.greetingSubtitle, { color: colors.ink2 }]}>
                What can I help you build or explore today?
              </Text>
              <View style={{ width: '100%', marginTop: spacing.md }}>
                <SuggestionCards
                  onSelectSuggestion={(prompt) => {
                    setPromptText(prompt);
                    inputRef.current?.focus();
                  }}
                />
              </View>
            </Pressable>
          </ScrollView>
        ) : (
          <FlatList
            ref={flatListRef}
            data={generations}
            keyExtractor={(item, index) =>
              item.entryId || item.$id || String(index)
            }
            renderItem={({ item }) => (
              <ImageCard
                generation={item}
                onRegenerate={handleRegenerate}
                onUseAsReference={handleUseAsReference}
                isRegenerating={
                  regeneratingId === (item.entryId || item.libId)
                }
              />
            )}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: composerBottomPadding + 160 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          />
        )}

        {/* Cinematic top fade */}
        <LinearGradient
          colors={topFadeConfig.colors}
          locations={topFadeConfig.locations}
          style={styles.topFade}
          pointerEvents="none"
        />

        {/* Cinematic bottom fade */}
        <LinearGradient
          colors={bottomFadeConfig.colors}
          locations={bottomFadeConfig.locations}
          style={styles.bottomFade}
          pointerEvents="none"
        />
      </View>

      {/* ── Composer ── */}
      <View
        style={[
          styles.composerContainer,
          {
            backgroundColor: colors.background,
            paddingBottom: composerBottomPadding,
          },
        ]}
      >
        {/* Model pill + aspect ratio row */}
        <View style={styles.composerTopRow}>
          <Pressable
            onPress={() => setIsModelSheetOpen(true)}
            style={({ pressed }) => [
              styles.modelPill,
              {
                backgroundColor: colors.isDark ? '#1c1c1e' : colors.surface2,
                borderColor: colors.isDark ? '#2c2c2e' : colors.line,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            hitSlop={4}
          >
            <RNImage
              source={activeLogoInfo.source}
              style={[
                styles.modelPillIcon,
                activeLogoInfo.isChatGPT && { tintColor: colors.ink },
              ]}
              resizeMode="contain"
            />
            <Text
              style={[styles.modelPillText, { color: colors.ink }]}
              numberOfLines={1}
            >
              {selectedModel.name}
            </Text>
            <IconChevronDown size={13} color={colors.ink3} />
          </Pressable>

          <View style={styles.ratioWrapper}>
            <AspectRatioSelector
              ratios={selectedModel.ratios}
              selectedRatio={selectedRatio}
              onSelectRatio={setSelectedRatio}
              disabled={isGenerating}
            />
          </View>

          {/* Quota Indicator */}
          {userPlan === 'free' ? (
            <Pressable
              style={[
                styles.quotaBadge,
                {
                  backgroundColor: colors.isDark ? '#202024' : colors.surface2,
                  borderColor: colors.isDark ? '#2e2e34' : colors.line,
                },
                quotaInfo && !quotaInfo.canGenerate && styles.quotaBadgeExhausted,
              ]}
              onPress={() => setUpgradeModalVisible(true)}
            >
              <Text style={[styles.quotaBadgeText, { color: colors.ink2 }]}>
                {quotaInfo
                  ? quotaInfo.canGenerate
                    ? `${quotaInfo.remaining}/10 left`
                    : 'Limit reached'
                  : '10/day'}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.quotaBadgePro}>
              <Text style={styles.quotaBadgeProText}>✨ Unlimited</Text>
            </View>
          )}
        </View>

        {/* Reference images multi-strip */}
        {referenceImages.length > 0 && (
          <View style={styles.referenceStripContainer}>
            <View style={styles.referenceStripHeader}>
              <View style={styles.referenceBadgeRow}>
                <IconWand size={13} color={colors.accent} strokeWidth={2} />
                <Text style={[styles.referenceStripTitle, { color: colors.ink }]}>
                  Reference Images ({referenceImages.length}/{maxRefImages})
                </Text>
                <View style={styles.modelBadge}>
                  <Text style={styles.modelBadgeText}>
                    {selectedModel.name}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={handleClearAllReferenceImages}
                hitSlop={6}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={[styles.clearAllText, { color: colors.ink3 }]}>
                  Clear all
                </Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.referenceThumbsList}
              keyboardShouldPersistTaps="handled"
            >
              {referenceImages.map((ref, idx) => (
                <View
                  key={ref.id}
                  style={[styles.refThumbWrap, { borderColor: colors.line }]}
                >
                  <ExpoImage
                    source={{ uri: ref.uri }}
                    style={styles.refThumb}
                    contentFit="cover"
                  />
                  <View style={styles.refIndexBadge}>
                    <Text style={styles.refIndexText}>#{idx}</Text>
                  </View>
                  <Pressable
                    onPress={() => handleRemoveReferenceImage(ref.id)}
                    style={styles.removeRefBtn}
                    hitSlop={6}
                    accessibilityLabel={`Remove reference image ${idx + 1}`}
                  >
                    <IconX size={11} color="#ffffff" strokeWidth={2.5} />
                  </Pressable>
                </View>
              ))}

              {referenceImages.length < maxRefImages && (
                <Pressable
                  onPress={handleChooseImageSource}
                  disabled={isGenerating}
                  style={({ pressed }) => [
                    styles.addRefThumbBtn,
                    {
                      borderColor: colors.line,
                      backgroundColor: colors.surface,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  accessibilityLabel="Add another reference image"
                >
                  <IconPlus size={18} color={colors.ink2} />
                  <Text style={[styles.addRefThumbText, { color: colors.ink3 }]}>
                    Add
                  </Text>
                </Pressable>
              )}
            </ScrollView>
          </View>
        )}

        {/* Input bar */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.isDark ? '#1c1c1e' : colors.surface2,
              borderColor: colors.isDark ? '#2c2c2e' : colors.line,
            },
          ]}
        >
          {isListening || isTranscribing ? (
            <VoiceWaveformBar
              isListening={isListening}
              isTranscribing={isTranscribing}
              audioLevel={audioLevel}
              onCancel={cancelListening}
              onStop={stopListening}
            />
          ) : (
            <>
              <Pressable
                onPress={handleChooseImageSource}
                disabled={isGenerating}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.attachBtn,
                  referenceImages.length > 0 && styles.attachBtnActive,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
                accessibilityLabel={
                  referenceImages.length > 0
                    ? 'Manage reference images'
                    : 'Attach reference image'
                }
              >
                {referenceImages.length > 0 ? (
                  <IconWand size={18} color="#000000" strokeWidth={2.2} />
                ) : (
                  <IconPlus size={22} color={colors.ink2} />
                )}
              </Pressable>

              <TextInput
                ref={inputRef}
                style={[styles.input, { color: colors.ink }]}
                placeholder={
                  referenceImages.length > 0
                    ? referenceImages.length === 1
                      ? 'Describe changes to your image...'
                      : `Describe changes across ${referenceImages.length} images...`
                    : 'Generate Image'
                }
                placeholderTextColor={colors.ink3}
                value={promptText}
                onChangeText={setPromptText}
                multiline
                maxLength={1000}
                editable={!isGenerating}
                blurOnSubmit={false}
              />

              <View style={styles.rightGroup}>
                <Pressable
                  disabled={isGenerating}
                  onPress={handleMicPress}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.micBtn,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                  accessibilityLabel="Dictate prompt with voice"
                >
                  <IconMicrophone size={20} color={colors.ink2} />
                </Pressable>

                <Pressable
                  disabled={!promptText.trim() || isGenerating}
                  onPress={() => handleGenerate(promptText)}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.sendBtn,
                    {
                      backgroundColor: promptText.trim()
                        ? colors.accent
                        : colors.isDark
                          ? '#2c2c2e'
                          : colors.line,
                      opacity: pressed
                        ? 0.8
                        : promptText.trim()
                          ? 1
                          : 0.4,
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
            </>
          )}
        </View>
      </View>

      {/* Model selector sheet */}
      <ImageModelSelectorSheet
        visible={isModelSheetOpen}
        onClose={() => setIsModelSheetOpen(false)}
        selectedModelId={selectedModel.id}
        onSelectModel={(model) => {
          setSelectedModel(model);
          if (!model.supportsImageToImage && referenceImages.length > 0) {
            // If user explicitly chose a text-only model while reference images were attached, clear reference images
            setReferenceImages([]);
          } else {
            const modelMax = getMaxReferenceImagesForModel(model.id);
            if (referenceImages.length > modelMax) {
              setReferenceImages((prev) => prev.slice(0, modelMax));
            }
          }
          if (!model.ratios.some((r) => r.value === selectedRatio)) {
            setSelectedRatio(model.ratios[0]?.value || '1:1');
          }
        }}
      />

      {/* Image source selector sheet */}
      <ImageSourceSheet
        visible={isSourceSheetOpen}
        onClose={() => setIsSourceSheetOpen(false)}
        onSelectCamera={() => handlePickFromSource('camera')}
        onSelectLibrary={() => handlePickFromSource('library')}
      />

      {/* Voice overlay */}
      <VoiceOverlay
        visible={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
      />

      {/* Plan upgrade modal */}
      <UpgradePlanModal
        visible={upgradeModalVisible}
        onClose={() => setUpgradeModalVisible(false)}
        targetFeatureName="Unlimited Image Generation"
        recommendedPlan="pro"
        onSuccess={() => {
          checkDailyImageQuota(userProfile).then(setQuotaInfo).catch(() => {});
        }}
      />
    </KeyboardWrapper>
  );
};

const styles = StyleSheet.create({
  scrollWrapper: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 28,
    zIndex: 10,
  },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 48,
    zIndex: 10,
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md + 4,
  },
  newChatGreeting: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  brandLogo: {
    width: 140,
    height: 48,
    marginBottom: spacing.md,
  },
  greetingTitle: {
    fontSize: 24,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  greetingSubtitle: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  composerContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs + 2,
    gap: spacing.xs + 2,
  },
  composerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    gap: spacing.xs,
  },
  modelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: '#2c2c2e',
    gap: 4,
    minHeight: 28,
    maxWidth: 175,
  },
  modelPillIcon: {
    width: 15,
    height: 15,
    borderRadius: 3.5,
    marginRight: 1,
  },
  chatgptIconTint: {
    tintColor: '#ffffff',
  },
  modelPillText: {
    color: '#ffffff',
    fontSize: typography.fontSize.xs,
    fontWeight: '500',
    flexShrink: 1,
  },
  ratioWrapper: {
    flex: 1,
    alignItems: 'flex-end',
  },
  quotaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: radius.full,
    backgroundColor: '#202024',
    borderWidth: 1,
    borderColor: '#2e2e34',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quotaBadgeExhausted: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  quotaBadgeText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#9ca3af',
  },
  quotaBadgePro: {
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quotaBadgeProText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#60a5fa',
  },
  referenceStripContainer: {
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  referenceStripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  referenceBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  referenceStripTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  modelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: '#ffffff',
  },
  modelBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000000',
  },
  clearAllText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '500',
  },
  referenceThumbsList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingVertical: 2,
  },
  refThumbWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  refThumb: {
    width: '100%',
    height: '100%',
  },
  refIndexBadge: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  refIndexText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  removeRefBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRefThumbBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  addRefThumbText: {
    fontSize: 9,
    fontWeight: '500',
  },
  inputBar: {
    minHeight: 52,
    maxHeight: 120,
    borderRadius: 26,
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: '#2c2c2e',
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
    backgroundColor: '#ffffff',
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.base,
    maxHeight: 100,
    color: '#ffffff',
    paddingTop: Platform.OS === 'ios' ? 8 : 4,
    paddingBottom: Platform.OS === 'ios' ? 8 : 4,
    paddingHorizontal: spacing.xs,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  micBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
