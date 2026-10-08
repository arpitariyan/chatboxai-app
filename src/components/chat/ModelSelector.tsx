import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, FlatList, Image, TextInput } from 'react-native';
import { useModelStore, UIModel } from '@/stores/useModelStore';
import { AIModelsOption, DEEP_RESEARCH_MODELS } from '@/config/models';
import { canAccessModel, normalizePlan } from '@/config/subscriptionPlans';
import { useAuth } from '@/contexts/AuthContext';
import { UpgradePlanModal } from '@/components/common/UpgradePlanModal';
import {
  IconChevronDown,
  IconCheck,
  IconLock,
  IconSearch,
  IconX,
} from '@tabler/icons-react-native';
import { typography, spacing, radius, useThemeColors } from '@/theme';
import { useTranslation } from '@/i18n';

interface ModelSelectorProps {
  isResearch: boolean;
}

const MODEL_LOGOS: Record<string, any> = {
  openai: require('../../../assets/images/models/Chatgpt.png'),
  anthropic: require('../../../assets/images/models/Claude.png'),
  google: require('../../../assets/images/models/Gemini.webp'),
  meta: require('../../../assets/images/models/Meta.png'),
  nvidia: require('../../../assets/images/models/nvidia.png'),
  mistral: require('../../../assets/images/models/Mistral.png'),
  qwen: require('../../../assets/images/models/Qwen.png'),
  poolside: require('../../../assets/images/models/Poolside.webp'),
  ling: require('../../../assets/images/models/Ling.png'),
  minimax: require('../../../assets/images/models/MiniMax.png'),
  stepfun: require('../../../assets/images/models/Stepfun ai.png'),
  kimi: require('../../../assets/images/models/kimi.png'),
  cohere: require('../../../assets/images/models/cohere.png'),
  groq: require('../../../assets/images/models/groq.png'),
  seed: require('../../../assets/images/models/Seed.webp'),
  zai: require('../../../assets/images/models/Z-ai.webp'),
  auto: require('../../../assets/images/models/Auto.png'),
  default: require('../../../assets/images/models/Auto.png'),
};

export const getModelLogo = (
  model?: { name?: string; modelApi?: string; provider?: string } | null
): { source: any; isChatGPT: boolean } => {
  const name = String(model?.name || '').toLowerCase();
  const api = String(model?.modelApi || '').toLowerCase();
  const provider = String(model?.provider || '').toLowerCase();

  // 1. Auto (Search default recommendation)
  if (api === 'auto' || name === 'auto' || name.startsWith('auto ')) {
    return { source: MODEL_LOGOS.auto, isChatGPT: false };
  }

  // 2. OpenAI / ChatGPT (GPT-5, GPT-OSS 120B/20B, etc. ALWAYS use ChatGPT logo)
  if (
    name.includes('gpt') ||
    name.includes('openai') ||
    name.includes('chatgpt') ||
    api.includes('openai') ||
    api.includes('gpt')
  ) {
    return { source: MODEL_LOGOS.openai, isChatGPT: true };
  }

  // 3. Anthropic Claude
  if (name.includes('claude') || name.includes('anthropic') || api.includes('anthropic')) {
    return { source: MODEL_LOGOS.anthropic, isChatGPT: false };
  }

  // 4. Google (Gemini, Lyria, Gemma)
  if (
    name.includes('gemini') ||
    name.includes('lyria') ||
    name.includes('gemma') ||
    name.includes('google') ||
    api.includes('google') ||
    api.includes('gemini')
  ) {
    return { source: MODEL_LOGOS.google, isChatGPT: false };
  }

  // 5. Meta Llama
  if (name.includes('llama') || name.includes('meta') || api.includes('meta')) {
    return { source: MODEL_LOGOS.meta, isChatGPT: false };
  }

  // 6. Nvidia Nemotron
  if (
    name.includes('nemotron') ||
    name.includes('nvidia') ||
    name.includes('dbrx') ||
    api.includes('nvidia')
  ) {
    return { source: MODEL_LOGOS.nvidia, isChatGPT: false };
  }

  // 7. Poolside Laguna
  if (name.includes('laguna') || name.includes('poolside') || api.includes('poolside')) {
    return { source: MODEL_LOGOS.poolside, isChatGPT: false };
  }

  // 8. Qwen (Alibaba)
  if (name.includes('qwen') || api.includes('qwen')) {
    return { source: MODEL_LOGOS.qwen, isChatGPT: false };
  }

  // 9. Mistral
  if (name.includes('mistral') || name.includes('mixtral') || api.includes('mistral')) {
    return { source: MODEL_LOGOS.mistral, isChatGPT: false };
  }

  // 10. Moonshot / Kimi
  if (name.includes('kimi') || name.includes('moonshot') || api.includes('moonshot')) {
    return { source: MODEL_LOGOS.kimi, isChatGPT: false };
  }

  // 11. Ling / 01-AI
  if (name.includes('ling') || name.includes('01-ai') || api.includes('01-ai')) {
    return { source: MODEL_LOGOS.ling, isChatGPT: false };
  }

  // 12. MiniMax
  if (name.includes('minimax') || api.includes('minimax')) {
    return { source: MODEL_LOGOS.minimax, isChatGPT: false };
  }

  // 13. StepFun
  if (name.includes('stepfun') || name.includes('step 3') || api.includes('stepfun')) {
    return { source: MODEL_LOGOS.stepfun, isChatGPT: false };
  }

  // 14. Cohere / North
  if (name.includes('cohere') || name.includes('north') || name.includes('command') || api.includes('cohere')) {
    return { source: MODEL_LOGOS.cohere, isChatGPT: false };
  }

  // 15. Z-AI / GLM
  if (name.includes('glm') || name.includes('z-ai') || api.includes('z-ai')) {
    return { source: MODEL_LOGOS.zai, isChatGPT: false };
  }

  // 16. Seed / Doubao
  if (name.includes('seed') || api.includes('seed')) {
    return { source: MODEL_LOGOS.seed, isChatGPT: false };
  }

  // 17. Groq Compounds
  if (name.includes('groq compound') || provider === 'groq') {
    return { source: MODEL_LOGOS.groq, isChatGPT: false };
  }

  // 18. Fallback by provider
  if (MODEL_LOGOS[provider]) {
    return { source: MODEL_LOGOS[provider], isChatGPT: provider === 'openai' };
  }

  return { source: MODEL_LOGOS.default, isChatGPT: false };
};

interface ModelRowItemProps {
  item: UIModel;
  isSelected: boolean;
  isAccessible: boolean;
  onSelect: (item: UIModel) => void;
  onLockedPress: (item: UIModel) => void;
}

const ModelRowItem = React.memo<ModelRowItemProps>(({
  item,
  isSelected,
  isAccessible,
  onSelect,
  onLockedPress,
}) => {
  const colors = useThemeColors();
  const isMaxModel = item.accessTier === 'max';
  const isProModel = item.isPro || item.accessTier === 'pro';
  const logoInfo = getModelLogo(item);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.modelRow,
        isSelected && { backgroundColor: colors.accent + '18' },
        !isAccessible && styles.modelRowLocked,
        { opacity: pressed ? 0.75 : 1 },
      ]}
      onPress={() => {
        if (isAccessible) {
          onSelect(item);
        } else {
          onLockedPress(item);
        }
      }}
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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text
              style={[
                styles.modelName,
                { color: colors.ink },
                !isAccessible && { color: colors.ink3 },
              ]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            {isMaxModel && (
              <View style={styles.badgeMax}>
                <Text style={styles.badgeMaxText}>MAX</Text>
              </View>
            )}
            {isProModel && !isMaxModel && (
              <View style={[styles.badgePro, { backgroundColor: colors.accent + '1a' }]}>
                <Text style={[styles.badgeProText, { color: colors.accent }]}>PRO</Text>
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

      {isSelected && isAccessible && (
        <IconCheck size={18} color={colors.accent} strokeWidth={2.5} />
      )}

      {!isAccessible && (
        <View style={[styles.lockContainer, { backgroundColor: colors.surface2 }]}>
          <IconLock size={15} color={colors.ink3} />
        </View>
      )}
    </Pressable>
  );
});

const ITEM_HEIGHT = 58;

export const ModelSelector: React.FC<ModelSelectorProps> = React.memo(({ isResearch }) => {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const selectedModel = useModelStore((s) => s.selectedModel);
  const setSelectedModel = useModelStore((s) => s.setSelectedModel);
  const { userProfile } = useAuth();

  const [modalVisible, setModalVisible] = useState(false);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [lockedTargetModel, setLockedTargetModel] = useState<UIModel | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const availableModels = isResearch ? DEEP_RESEARCH_MODELS : AIModelsOption;
  const userPlan = normalizePlan(userProfile?.plan);
  const paidCredits = userProfile?.paid_credits ?? 0;
  const userEmail = userProfile?.email;

  const handleSelect = useCallback((model: UIModel) => {
    setSelectedModel(model);
    setModalVisible(false);
  }, [setSelectedModel]);

  const handleLockedPress = useCallback((model: UIModel) => {
    setLockedTargetModel(model);
    setModalVisible(false);
    setUpgradeModalVisible(true);
  }, []);

  // Filter models in real time based on search input
  const filteredModels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return availableModels as UIModel[];
    return (availableModels as UIModel[]).filter((m) => {
      const name = (m.name || '').toLowerCase();
      const desc = (m.desc || '').toLowerCase();
      const api = (m.modelApi || '').toLowerCase();
      const provider = (m.provider || '').toLowerCase();
      return name.includes(q) || desc.includes(q) || api.includes(q) || provider.includes(q);
    });
  }, [availableModels, searchQuery]);

  const accessibleMap = useMemo(() => {
    const map = new Map<string | number, boolean>();
    for (const m of availableModels as UIModel[]) {
      map.set(m.id, canAccessModel(m, userPlan, paidCredits, userEmail));
    }
    return map;
  }, [availableModels, userPlan, paidCredits, userEmail]);

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  const renderItem = useCallback(({ item }: { item: UIModel }) => {
    const isAccessible = accessibleMap.get(item.id) ?? true;
    return (
      <ModelRowItem
        item={item}
        isSelected={selectedModel?.id === item.id}
        isAccessible={isAccessible}
        onSelect={handleSelect}
        onLockedPress={handleLockedPress}
      />
    );
  }, [selectedModel?.id, accessibleMap, handleSelect, handleLockedPress]);

  const activeLogoInfo = getModelLogo(selectedModel || { modelApi: 'auto', name: 'Auto' });

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.triggerBtn,
          {
            backgroundColor: colors.surface2,
            borderColor: colors.line,
          },
          { opacity: pressed ? 0.7 : 1 },
        ]}
        onPress={() => {
          setSearchQuery('');
          setModalVisible(true);
        }}
      >
        <Image
          source={activeLogoInfo.source}
          style={[
            styles.triggerIcon,
            activeLogoInfo.isChatGPT && { tintColor: colors.ink },
          ]}
          resizeMode="contain"
        />
        <Text style={[styles.triggerText, { color: colors.ink }]} numberOfLines={1} ellipsizeMode="tail">
          {selectedModel?.name || 'Auto'}
        </Text>
        <View style={styles.chevronWrapper}>
          <IconChevronDown size={13} color={colors.ink3} />
        </View>
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setModalVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Close model picker"
          />
          <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            {/* Sheet Top Handle */}
            <View style={[styles.sheetHandle, { backgroundColor: colors.line }]} />

            {/* Clean Non-Fussy Header matching APK Theme */}
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.ink }]}>
                {t('selectAiModel', 'Select AI Model')}
              </Text>
              <Pressable
                onPress={() => setModalVisible(false)}
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
                <Pressable onPress={() => setSearchQuery('')} hitSlop={8} style={styles.clearSearchBtn}>
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

      {/* Upgrade Plan Modal */}
      <UpgradePlanModal
        visible={upgradeModalVisible}
        onClose={() => setUpgradeModalVisible(false)}
        targetFeatureName={lockedTargetModel?.name}
        recommendedPlan={lockedTargetModel?.accessTier === 'max' ? 'max' : 'pro'}
      />
    </>
  );
});

const styles = StyleSheet.create({
  triggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.full,
    gap: 4,
    borderWidth: 1,
    borderColor: '#2c2c2e',
    maxWidth: '100%',
    flexShrink: 1,
  },
  triggerIcon: {
    width: 15,
    height: 15,
    marginRight: 2,
  },
  triggerText: {
    color: '#ffffff',
    fontSize: typography.fontSize.xs,
    fontWeight: '500',
    flexShrink: 1,
  },
  chevronWrapper: {
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  modelRowLocked: {
    opacity: 0.82,
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
  },
  modelIcon: {
    width: 24,
    height: 24,
  },
  chatgptIconTint: {
    tintColor: '#ffffff',
  },
  modelName: {
    color: '#ffffff',
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  modelNameLocked: {
    color: '#d1d5db',
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
  badgeMax: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  badgeMaxText: {
    color: '#c084fc',
    fontSize: 9.5,
    fontWeight: '700',
  },
  lockContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#202024',
    alignItems: 'center',
    justifyContent: 'center',
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
