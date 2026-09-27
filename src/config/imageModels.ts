/**
 * src/config/imageModels.ts
 *
 * Provider-aware image generation model registry for ChatBox AI Mobile.
 * Single source of truth for providers, models, aspect ratios, and capabilities.
 * Adapted directly from chatboxai_website_copy/lib/hf-image-config.js.
 */

export interface ImageAspectRatio {
  label: string;
  value: string;
  width: number;
  height: number;
}

export interface ImageModelConfig {
  id: string;
  provider: 'cloudflare' | 'huggingface' | 'leonardo';
  name: string;
  desc: string;
  ratios: ImageAspectRatio[];
  supportsTextToImage?: boolean;
  supportsImageToImage?: boolean;
  maxReferenceImages?: number;
  guidanceScale?: number;
  numInferenceSteps?: number;
}

export interface ImageProvider {
  id: 'cloudflare' | 'huggingface' | 'leonardo';
  name: string;
}

export const GENERATION_MODES = {
  TEXT_TO_IMAGE: 'text-to-image',
  IMAGE_TO_IMAGE: 'image-to-image',
} as const;

export type GenerationMode = typeof GENERATION_MODES[keyof typeof GENERATION_MODES];

export const IMAGE_PROVIDERS: ImageProvider[] = [
  { id: 'leonardo', name: 'Leonardo AI' },
  { id: 'cloudflare', name: 'Cloudflare' },
  { id: 'huggingface', name: 'Hugging Face' },
];

export const CLOUDFLARE_IMAGE_MODELS: ImageModelConfig[] = [
  {
    id: '@cf/black-forest-labs/flux-2-klein-4b',
    provider: 'cloudflare',
    name: 'FLUX.2 Klein 4B',
    desc: 'Ultra-fast distilled FLUX model with sub-second inference & multi-reference editing',
    supportsTextToImage: true,
    supportsImageToImage: true,
    maxReferenceImages: 4,
    ratios: [
      { label: 'Square (1:1)', value: '1:1', width: 1024, height: 1024 },
      { label: 'Landscape (16:9)', value: '16:9', width: 1344, height: 768 },
      { label: 'Portrait (9:16)', value: '9:16', width: 768, height: 1344 },
      { label: 'Standard (4:3)', value: '4:3', width: 1152, height: 864 },
      { label: 'Tall (3:4)', value: '3:4', width: 864, height: 1152 },
    ],
  },
];

export const HF_IMAGE_MODELS: ImageModelConfig[] = [
  {
    id: 'black-forest-labs/FLUX.1-schnell',
    provider: 'huggingface',
    name: 'FLUX Schnell',
    desc: 'Extremely fast generation with high prompt accuracy (2-4s)',
    supportsTextToImage: true,
    supportsImageToImage: false,
    ratios: [
      { label: 'Square (1:1)', value: '1:1', width: 1024, height: 1024 },
      { label: 'Landscape (16:9)', value: '16:9', width: 1360, height: 768 },
      { label: 'Portrait (9:16)', value: '9:16', width: 768, height: 1360 },
      { label: 'Wide (3:2)', value: '3:2', width: 1248, height: 832 },
      { label: 'Tall (2:3)', value: '2:3', width: 832, height: 1248 },
    ],
  },
  {
    id: 'stabilityai/stable-diffusion-xl-base-1.0',
    provider: 'huggingface',
    name: 'Stable Diffusion XL',
    desc: 'High quality photorealistic images & concepts',
    supportsTextToImage: true,
    supportsImageToImage: false,
    guidanceScale: 2.5,
    numInferenceSteps: 50,
    ratios: [
      { label: 'Square (1:1)', value: '1:1', width: 1024, height: 1024 },
      { label: 'Landscape (16:9)', value: '16:9', width: 1344, height: 768 },
      { label: 'Portrait (9:16)', value: '9:16', width: 768, height: 1344 },
      { label: 'Standard (4:3)', value: '4:3', width: 1152, height: 896 },
      { label: 'Wide (3:2)', value: '3:2', width: 1216, height: 832 },
      { label: 'Tall (2:3)', value: '2:3', width: 832, height: 1216 },
    ],
  },
];

export const LEONARDO_IMAGE_MODELS: ImageModelConfig[] = [
  {
    id: '1dd50843-d653-4516-a8e3-f0238ee453ff',
    provider: 'leonardo',
    name: 'Flux Schnell Pro',
    desc: 'Leonardo FLUX Schnell with low-latency photorealistic rendering',
    supportsTextToImage: true,
    supportsImageToImage: false,
    ratios: [
      { label: 'Square (1:1)', value: '1:1', width: 1024, height: 1024 },
      { label: 'Landscape (16:9)', value: '16:9', width: 1376, height: 768 },
      { label: 'Portrait (9:16)', value: '9:16', width: 768, height: 1376 },
      { label: 'Wide (3:2)', value: '3:2', width: 1248, height: 832 },
      { label: 'Tall (2:3)', value: '2:3', width: 832, height: 1248 },
    ],
  },
];

export const IMAGE_MODELS: ImageModelConfig[] = [
  ...LEONARDO_IMAGE_MODELS,
  ...CLOUDFLARE_IMAGE_MODELS,
  ...HF_IMAGE_MODELS,
];

export const DEFAULT_LEONARDO_MODEL_ID = '1dd50843-d653-4516-a8e3-f0238ee453ff';
export const DEFAULT_TEXT_TO_IMAGE_MODEL_ID = DEFAULT_LEONARDO_MODEL_ID;
export const DEFAULT_IMAGE_TO_IMAGE_MODEL_ID = '@cf/black-forest-labs/flux-2-klein-4b';
export const DEFAULT_CLOUDFLARE_MODEL_ID = DEFAULT_IMAGE_TO_IMAGE_MODEL_ID;

export const DEFAULT_PROVIDER_ID = 'leonardo';
export const DEFAULT_IMAGE_MODEL_ID = DEFAULT_TEXT_TO_IMAGE_MODEL_ID;

export function getDefaultTextToImageModel(): ImageModelConfig {
  return getModelById(DEFAULT_TEXT_TO_IMAGE_MODEL_ID);
}

export function getDefaultImageToImageModel(): ImageModelConfig {
  return getModelById(DEFAULT_IMAGE_TO_IMAGE_MODEL_ID);
}

export function getProviderById(providerId: string): ImageProvider {
  return IMAGE_PROVIDERS.find((p) => p.id === providerId) || IMAGE_PROVIDERS[0];
}

export function getModelsByProvider(providerId: string): ImageModelConfig[] {
  return IMAGE_MODELS.filter((m) => m.provider === providerId);
}

export function getProviderIdByModelId(modelId: string): 'cloudflare' | 'huggingface' | 'leonardo' {
  return IMAGE_MODELS.find((m) => m.id === modelId)?.provider || DEFAULT_PROVIDER_ID;
}

export function getDefaultModelForProvider(providerId: string = DEFAULT_PROVIDER_ID): ImageModelConfig {
  const providerModels = getModelsByProvider(providerId);
  return providerModels.length > 0 ? providerModels[0] : IMAGE_MODELS[0];
}

export function getModelById(modelId: string, providerId?: string | null): ImageModelConfig {
  const exact = IMAGE_MODELS.find((m) => m.id === modelId);
  if (exact) return exact;
  if (providerId) return getDefaultModelForProvider(providerId);
  return IMAGE_MODELS[0];
}

export function supportsImageToImage(modelId: string): boolean {
  const model = IMAGE_MODELS.find((m) => m.id === modelId);
  return model?.supportsImageToImage === true;
}

export function getMaxReferenceImagesForModel(modelId: string): number {
  const model = IMAGE_MODELS.find((m) => m.id === modelId);
  return model?.maxReferenceImages || 1;
}

export function getImageToImageModels(providerId?: string | null): ImageModelConfig[] {
  const editModels = IMAGE_MODELS.filter((m) => m.supportsImageToImage === true);
  if (!providerId) return editModels;
  return editModels.filter((m) => m.provider === providerId);
}

export function getDefaultImageToImageModelForProvider(
  providerId: string = 'cloudflare'
): ImageModelConfig | null {
  const editModels = getImageToImageModels(providerId);
  if (editModels.length > 0) return editModels[0];
  const allEditModels = getImageToImageModels();
  return allEditModels.length > 0 ? allEditModels[0] : null;
}
