import { create } from 'zustand';
import { AIModelsOption, DEEP_RESEARCH_MODELS } from '../config/models';

export interface UIModel {
  id: string | number;
  name: string;
  desc: string;
  modelApi: string;
  provider: string;
  isPro: boolean;
  accessTier?: string;
  costTier?: number;
  reasoningParam?: any;
}

interface ModelStoreState {
  selectedModel: UIModel;
  setSelectedModel: (model: UIModel) => void;
  syncModelWithMode: (isResearch: boolean) => void;
}

export const useModelStore = create<ModelStoreState>((set, get) => ({
  selectedModel: AIModelsOption[0] as UIModel, // Default to Auto
  setSelectedModel: (model: UIModel) => set({ selectedModel: model }),
  syncModelWithMode: (isResearch: boolean) => {
    const { selectedModel, setSelectedModel } = get();
    if (isResearch) {
      if (!DEEP_RESEARCH_MODELS.some(m => m.id === selectedModel?.id)) {
        setSelectedModel(DEEP_RESEARCH_MODELS[0] as UIModel);
      }
    } else {
      if (!AIModelsOption.some(m => m.id === selectedModel?.id)) {
        setSelectedModel(AIModelsOption[0] as UIModel);
      }
    }
  }
}));
