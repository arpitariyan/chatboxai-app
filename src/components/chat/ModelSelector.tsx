import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, FlatList, Image } from 'react-native';
import { useModelStore, UIModel } from '@/stores/useModelStore';
import { AIModelsOption, DEEP_RESEARCH_MODELS } from '@/config/models';
import { IconChevronDown, IconCheck } from '@tabler/icons-react-native';
import { typography, spacing, radius } from '@/theme';

interface ModelSelectorProps {
  isResearch: boolean;
}

const MODEL_LOGOS: Record<string, any> = {
  'openai': require('../../../assets/images/models/Chatgpt.png'),
  'anthropic': require('../../../assets/images/models/Claude.png'),
  'google': require('../../../assets/images/models/Gemini.webp'),
  'groq': require('../../../assets/images/models/groq.png'),
  'meta': require('../../../assets/images/models/Meta.png'),
  'mistral': require('../../../assets/images/models/Mistral.png'),
  'nvidia': require('../../../assets/images/models/nvidia.png'),
  'qwen': require('../../../assets/images/models/Qwen.png'),
  'stepfun-ai': require('../../../assets/images/models/Stepfun ai.png'),
  'minimaxai': require('../../../assets/images/models/MiniMax.png'),
  '01-ai': require('../../../assets/images/models/Ling.png'),
  'moonshot': require('../../../assets/images/models/kimi.png'),
  'cohere': require('../../../assets/images/models/cohere.png'),
  'auto': require('../../../assets/images/models/Auto.png'),
  'default': require('../../../assets/images/models/Auto.png'),
};

const getModelLogo = (model: UIModel) => {
  if (model.modelApi === 'auto') return MODEL_LOGOS['auto'];

  const provider = model.provider?.toLowerCase() || 'default';
  if (MODEL_LOGOS[provider]) return MODEL_LOGOS[provider];

  const name = model.name.toLowerCase();
  if (name.includes('gpt')) return MODEL_LOGOS['openai'];
  if (name.includes('claude')) return MODEL_LOGOS['anthropic'];
  if (name.includes('gemini')) return MODEL_LOGOS['google'];
  if (name.includes('llama')) return MODEL_LOGOS['meta'];
  if (name.includes('mistral')) return MODEL_LOGOS['mistral'];
  if (name.includes('qwen')) return MODEL_LOGOS['qwen'];

  return MODEL_LOGOS['default'];
};

export const ModelSelector: React.FC<ModelSelectorProps> = ({ isResearch }) => {
  const { selectedModel, setSelectedModel } = useModelStore();
  const [modalVisible, setModalVisible] = useState(false);

  const availableModels = isResearch ? DEEP_RESEARCH_MODELS : AIModelsOption;

  const handleSelect = (model: UIModel) => {
    setSelectedModel(model);
    setModalVisible(false);
  };

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.triggerBtn, { opacity: pressed ? 0.7 : 1 }]}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.triggerText} numberOfLines={1} ellipsizeMode="tail">
          {selectedModel?.name || 'Auto'}
        </Text>
        <View style={styles.chevronWrapper}>
          <IconChevronDown size={13} color="#8e8e93" />
        </View>
      </Pressable>

      <Modal visible={modalVisible} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select AI Model</Text>
            </View>
            <FlatList
              data={availableModels as UIModel[]}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.modelRow,
                    selectedModel?.id === item.id && styles.modelRowSelected
                  ]}
                  onPress={() => handleSelect(item)}
                >
                  <View style={styles.modelInfo}>
                    <Image source={getModelLogo(item)} style={styles.modelIcon} />
                    <Text style={styles.modelName}>{item.name}</Text>
                  </View>
                  {selectedModel?.id === item.id && (
                    <IconCheck size={20} color="#3b82f6" />
                  )}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    maxHeight: '70%',
  },
  sheetHeader: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c2e',
    marginBottom: spacing.xs,
  },
  sheetTitle: {
    color: '#ffffff',
    fontSize: typography.fontSize.md,
    fontWeight: 'bold',
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  modelRowSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  modelInfo: {
    flex: 1,
    paddingRight: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modelIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    resizeMode: 'contain',
  },
  modelName: {
    color: '#ffffff',
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
});
