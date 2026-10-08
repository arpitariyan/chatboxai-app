/**
 * src/components/image/ImageModelSelectorSheet.tsx
 *
 * Professional Image Model Selector modal for ChatBox AI.
 * Perfectly mirrors the Home/Search ModelSelector design:
 * - Slide-up modal with dark overlay & top drag handle
 * - Clean header with circular close button
 * - Real-time model search filter
 * - High-res branded model logos (FLUX, Stable Diffusion, Seed, ChatGPT, etc.)
 * - Rich capability badges (PRO, FAST, Img2Img)
 * - Active model checkmark & selection highlight
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
  Image,
  TextInput,
} from 'react-native';
import {
  IconCheck,
  IconSearch,
  IconX,
} from '@tabler/icons-react-native';
import {
  IMAGE_MODELS,
  ImageModelConfig,
} from '@/config/imageModels';
import { typography, spacing, radius, useThemeColors } from '@/theme';
import { useTranslation } from '@/i18n';

interface ImageModelSelectorSheetProps {
  visible: boolean;
  onClose: () => void;
  selectedModelId: string;
  onSelectModel: (model: ImageModelConfig) => void;
}

const IMAGE_MODEL_LOGOS: Record<string, any> = {
  flux: require('../../../assets/images/models/FLUX_logo.png'),
  stablediffusion: require('../../../assets/images/models/Stable_diffusion.jpg'),
  seed: require('../../../assets/images/models/Seed.webp'),
  openai: require('../../../assets/images/models/Chatgpt.png'),
  google: require('../../../assets/images/models/Gemini.webp'),
  meta: require('../../../assets/images/models/Meta.png'),
  qwen: require('../../../assets/images/models/Qwen.png'),
  mistral: require('../../../assets/images/models/Mistral.png'),
  auto: require('../../../assets/images/models/Auto.png'),
  default: require('../../../assets/images/models/FLUX_logo.png'),
};

export const getImageModelLogo = (
  model?: { name?: string; id?: string; provider?: string } | null
): { source: any; isChatGPT: boolean } => {
  const name = String(model?.name || '').toLowerCase();
  const id = String(model?.id || '').toLowerCase();
  const provider = String(model?.provider || '').toLowerCase();

  // 1. FLUX models (FLUX.2 Klein 4B, FLUX Schnell, Flux Schnell Pro, Black Forest Labs)
  if (
    name.includes('flux') ||
    id.includes('flux') ||
    id.includes('black-forest-labs') ||
    name.includes('bfl')
  ) {
    return { source: IMAGE_MODEL_LOGOS.flux, isChatGPT: false };
  }

  // 2. Stable Diffusion / Stability AI
  if (
    name.includes('stable diffusion') ||
    name.includes('sdxl') ||
    name.includes('stability') ||
    id.includes('stability') ||
    id.includes('stable-diffusion')
  ) {
    return { source: IMAGE_MODEL_LOGOS.stablediffusion, isChatGPT: false };
  }

  // 3. ByteDance / Seed / Doubao / SD-Turbo / Hyper-SD
  if (
    name.includes('seed') ||
    name.includes('doubao') ||
    name.includes('bytedance') ||
    id.includes('seed') ||
    id.includes('bytedance')
  ) {
    return { source: IMAGE_MODEL_LOGOS.seed, isChatGPT: false };
  }

  // 4. OpenAI / DALL-E / ChatGPT
  if (
    name.includes('dall-e') ||
    name.includes('dalle') ||
    name.includes('openai') ||
    provider === 'openai'
  ) {
    return { source: IMAGE_MODEL_LOGOS.openai, isChatGPT: true };
  }

  // 5. Google (Imagen, Gemini)
  if (
    name.includes('imagen') ||
    name.includes('gemini') ||
    name.includes('google') ||
    provider === 'google'
  ) {
    return { source: IMAGE_MODEL_LOGOS.google, isChatGPT: false };
  }

  // 6. Meta
  if (name.includes('meta') || name.includes('emu')) {
    return { source: IMAGE_MODEL_LOGOS.meta, isChatGPT: false };
  }

  // 7. Qwen / Wan
  if (name.includes('qwen') || name.includes('wan') || id.includes('qwen')) {
    return { source: IMAGE_MODEL_LOGOS.qwen, isChatGPT: false };
  }

  // 8. Leonardo provider fallback if not caught by FLUX
  if (provider === 'leonardo') {
    return { source: IMAGE_MODEL_LOGOS.flux, isChatGPT: false };
  }

  return { source: IMAGE_MODEL_LOGOS.default, isChatGPT: false };
};

interface ModelRowItemProps {
  item: ImageModelConfig;
  isSelected: boolean;
  onSelect: (item: ImageModelConfig) => void;
}

const ITEM_HEIGHT = 58;

const ModelRowItem = React.memo<ModelRowItemProps>(({ item, isSelected, onSelect }) => {
  const colors = useThemeColors();
  const isPro = item.provider === 'leonardo';
  const isFast =
    item.name.toLowerCase().includes('schnell') ||
    item.name.toLowerCase().includes('klein') ||
    item.id.toLowerCase().includes('schnell') ||
    item.id.toLowerCase().includes('klein');
  const logoInfo = getImageModelLogo(item);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.modelRow,
        isSelected && { backgroundColor: colors.accent + '18' },
        { opacity: pressed ? 0.75 : 1 },
      ]}
      onPress={() => onSelect(item)}
    >
      <View style={styles.modelInfo}>
        <View style={styles.modelIconWrapper}>
          <Image
            source={logoInfo.source}
            style={[
              styles.modelIcon,
              logoInfo.isChatGPT && { tintColor: colors.ink },
            ]}
            resizeMode="contain"
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
            <Text style={[styles.modelName, { color: colors.ink }]} numberOfLines={1}>
              {item.name}
            </Text>
            {isPro && (
              <View style={[styles.badgePro, { backgroundColor: colors.accent + '1a' }]}>
                <Text style={[styles.badgeProText, { color: colors.accent }]}>PRO</Text>
              </View>
            )}
            {isFast && (
              <View style={styles.badgeFast}>
                <Text style={styles.badgeFastText}>FAST</Text>
              </View>
            )}
            {item.supportsImageToImage && (
              <View style={styles.badgeImg2Img}>
                <Text style={styles.badgeImg2ImgText}>
                  {item.maxReferenceImages && item.maxReferenceImages > 1
                    ? `Img2Img (${item.maxReferenceImages} refs)`
                    : 'Img2Img'}
                </Text>
              </View>
            )}
          </View>
          {item.desc ? (
            <Text style={[styles.modelDesc, { color: colors.ink3 }]} numberOfLines={1}>
              {item.desc}
            </Text>
          ) : null}
        </View>
      </View>

      {isSelected && (
        <IconCheck size={18} color={colors.accent} strokeWidth={2.5} />
      )}
    </Pressable>
  );
});

export const ImageModelSelectorSheet: React.FC<ImageModelSelectorSheetProps> = React.memo(({
  visible,
  onClose,
  selectedModelId,
  onSelectModel,
}) => {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  // Reset search input when modal opens
  useEffect(() => {
    if (visible) {
      setSearchQuery('');
    }
  }, [visible]);

  // Deduplicate by model id
  const uniqueModels: ImageModelConfig[] = useMemo(() => {
    const list: ImageModelConfig[] = [];
    const seen = new Set<string>();
    for (const model of IMAGE_MODELS) {
      if (!seen.has(model.id)) {
        seen.add(model.id);
        list.push(model);
      }
    }
    return list;
  }, []);

  // Filter models based on search query
  const filteredModels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return uniqueModels;
    return uniqueModels.filter((m) => {
      const name = (m.name || '').toLowerCase();
      const desc = (m.desc || '').toLowerCase();
      const provider = (m.provider || '').toLowerCase();
      const id = (m.id || '').toLowerCase();
      return name.includes(q) || desc.includes(q) || provider.includes(q) || id.includes(q);
    });
  }, [uniqueModels, searchQuery]);

  const handleSelect = useCallback(
    (model: ImageModelConfig) => {
      onSelectModel(model);
      onClose();
    },
    [onSelectModel, onClose]
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: ImageModelConfig }) => (
      <ModelRowItem
        item={item}
        isSelected={item.id === selectedModelId}
        onSelect={handleSelect}
      />
    ),
    [selectedModelId, handleSelect]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close image model picker"
        />
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          {/* Sheet Top Handle */}
          <View style={[styles.sheetHandle, { backgroundColor: colors.line }]} />

          {/* Clean Non-Fussy Header matching APK Theme */}
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.ink }]}>
              {t('selectImageModel', 'Select Image Model')}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={[styles.closeBtn, { backgroundColor: colors.surface2 }]}
            >
              <IconX size={18} color={colors.ink3} />
            </Pressable>
          </View>

          {/* Unified Search Input Filter */}
          <View style={[styles.searchContainer, { backgroundColor: colors.surface2, borderColor: colors.line }]}>
            <IconSearch size={16} color={colors.ink3} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.ink }]}
              placeholder={t('searchModels', 'Search models...')}
              placeholderTextColor={colors.ink3}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery('')}
                hitSlop={8}
                style={styles.clearSearchBtn}
              >
                <IconX size={14} color={colors.ink3} />
              </Pressable>
            )}
          </View>

          {/* Models FlatList */}
          <FlatList
            data={filteredModels}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            getItemLayout={getItemLayout}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.ink3 }]}>No models match "{searchQuery}"</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#18181b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#27272a',
    borderBottomWidth: 0,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3f3f46',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: 10,
  },
  sheetTitle: {
    color: '#fbfbfb',
    fontSize: typography.fontSize.md,
    fontWeight: '700',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222226',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2e2e33',
    marginHorizontal: spacing.md,
    marginBottom: 10,
    height: 40,
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    color: '#fbfbfb',
    fontSize: 13.5,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  modelRow: {
    height: ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 8,
  },
  modelRowSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  modelInfo: {
    flex: 1,
    paddingRight: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modelIconWrapper: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    overflow: 'hidden',
  },
  modelIcon: {
    width: 24,
    height: 24,
    borderRadius: 5,
  },
  chatgptIconTint: {
    tintColor: '#ffffff',
  },
  modelName: {
    color: '#ffffff',
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  modelDesc: {
    color: '#71717a',
    fontSize: 11,
    marginTop: 1,
  },
  badgePro: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  badgeProText: {
    color: '#60a5fa',
    fontSize: 9.5,
    fontWeight: '700',
  },
  badgeFast: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  badgeFastText: {
    color: '#4ade80',
    fontSize: 9.5,
    fontWeight: '700',
  },
  badgeImg2Img: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  badgeImg2ImgText: {
    color: '#c084fc',
    fontSize: 9.5,
    fontWeight: '700',
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#71717a',
    fontSize: 13,
  },
});
