/**
 * src/server/lib/image-generator.ts
 *
 * Robust, production-grade image generation engine for ChatBox AI Mobile.
 * Adapts website provider-aware pipeline with:
 * - Text-to-Image and Image-to-Image (reference guided editing)
 * - Multi-key failover rotation for Hugging Face and Leonardo AI
 * - Model auto-routing and parameter tuning
 * - Sharp PNG processing and optimization
 * - Appwrite Storage bucket persistence with public read access
 * - Appwrite Database record lifecycle ('generating' -> 'completed' / 'failed')
 */

import sharp from 'sharp';
import {
  databases,
  storage,
  DB_ID,
  STORAGE_BUCKET_ID,
  IMAGE_GENERATION_COLLECTION_ID,
  USERS_COLLECTION_ID,
  InputFile,
  Permission,
  Role,
  Query,
  ID,
} from './appwrite-admin';
import {
  IMAGE_MODELS,
  DEFAULT_IMAGE_MODEL_ID,
  DEFAULT_TEXT_TO_IMAGE_MODEL_ID,
  DEFAULT_IMAGE_TO_IMAGE_MODEL_ID,
  DEFAULT_CLOUDFLARE_MODEL_ID,
  GENERATION_MODES,
  getModelById,
  getProviderIdByModelId,
  supportsImageToImage,
  getDefaultImageToImageModelForProvider,
} from '../../config/imageModels';
import { logger } from './logger';

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4/accounts';
export const CLOUDFLARE_FLUX_KLEIN_MODEL = '@cf/black-forest-labs/flux-2-klein-4b';

export function getCloudflareCredentials(): { accountId: string; apiToken: string } | null {
  const accountId = (
    process.env.CLOUDFLARE_ACCOUNT_ID ||
    process.env.CF_ACCOUNT_ID ||
    '5adaa2126e141e13e54deac1befece9f'
  ).trim();
  const apiToken = (
    process.env.CLOUDFLARE_API_TOKEN ||
    process.env.CF_API_TOKEN ||
    '7GLllO_mY10_s5xiIDLXk7xaPbddsJ8r2zVFZVfK'
  ).trim();

  if (!accountId || !apiToken) {
    return null;
  }
  return { accountId, apiToken };
}

const HF_API_BASE = 'https://router.huggingface.co/hf-inference/models';
const HF_API_INFERENCE_BASE = 'https://api-inference.huggingface.co/models';
const HF_MAX_RETRIES = 3;
const HF_RETRY_DELAY_MS = 15000;
const HF_UNAVAILABLE_MODEL_TTL_MS = 10 * 60 * 1000;
const hfUnavailableImageToImageModels = new Map<string, number>();

function markHFImageToImageModelUnavailable(modelId: string) {
  hfUnavailableImageToImageModels.set(modelId, Date.now() + HF_UNAVAILABLE_MODEL_TTL_MS);
}

function isHFImageToImageModelTemporarilyUnavailable(modelId: string): boolean {
  const expiresAt = hfUnavailableImageToImageModels.get(modelId);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    hfUnavailableImageToImageModels.delete(modelId);
    return false;
  }
  return true;
}

const LEONARDO_API_BASE = (process.env.LEONARDO_API_BASE || 'https://cloud.leonardo.ai/api/rest/v1').trim();
const LEONARDO_MAX_POLL_ATTEMPTS = 40;
const LEONARDO_POLL_INTERVAL_MS = 1500;

const APPWRITE_PUBLIC_ENDPOINT =
  process.env.APPWRITE_ENDPOINT ||
  process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ||
  'https://nyc.cloud.appwrite.io/v1';

const APPWRITE_PUBLIC_PROJECT_ID =
  process.env.APPWRITE_PROJECT_ID ||
  process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ||
  '69a3eac50018b30b4556';

const MAX_REFERENCE_IMAGE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export function getPublicFileUrl(fileId: string): string {
  return `${APPWRITE_PUBLIC_ENDPOINT}/storage/buckets/${STORAGE_BUCKET_ID}/files/${fileId}/view?project=${APPWRITE_PUBLIC_PROJECT_ID}`;
}

export function enhancePromptForQuality(
  prompt: string,
  options: { aspectRatio?: string; generationMode?: string } = {}
): string {
  const normalized = String(prompt || '').trim().replace(/\s+/g, ' ');
  if (!normalized) return normalized;

  const wordCount = normalized.split(' ').filter(Boolean).length;
  let qualitySuffix = 'high quality, detailed, clean composition';

  if (wordCount >= 20) {
    qualitySuffix = 'ultra-detailed, refined lighting, sharp focus, rich texture detail';
  } else if (wordCount >= 10) {
    qualitySuffix = 'highly detailed, polished lighting, crisp textures';
  }

  const aspectRatioCue =
    options.aspectRatio && options.aspectRatio !== '1:1'
      ? `balanced composition optimized for ${options.aspectRatio}`
      : 'balanced composition';

  const editCue =
    options.generationMode === GENERATION_MODES.IMAGE_TO_IMAGE
      ? 'preserve the original structure while refining the requested changes'
      : 'strong visual clarity and coherent composition';

  return `${normalized}, ${qualitySuffix}, ${aspectRatioCue}, ${editCue}`;
}

export async function parseReferenceImages(
  referenceImages?: (string | null)[] | null,
  legacySingleUrl?: string | null,
  legacySingleBase64?: string | null
): Promise<Buffer[]> {
  const candidates: string[] = [];

  if (Array.isArray(referenceImages)) {
    for (const item of referenceImages) {
      if (item && typeof item === 'string' && item.trim()) {
        candidates.push(item.trim());
      }
    }
  }

  if (candidates.length === 0) {
    if (legacySingleBase64 && typeof legacySingleBase64 === 'string' && legacySingleBase64.trim()) {
      candidates.push(legacySingleBase64.trim());
    } else if (legacySingleUrl && typeof legacySingleUrl === 'string' && legacySingleUrl.trim()) {
      candidates.push(legacySingleUrl.trim());
    }
  }

  // Model supports up to 4 reference images
  const limited = candidates.slice(0, 4);
  const buffers: Buffer[] = [];

  for (let idx = 0; idx < limited.length; idx++) {
    const raw = limited[idx];
    let buf: Buffer | null = null;

    if (raw.startsWith('data:') || (!raw.startsWith('http://') && !raw.startsWith('https://') && raw.length > 200)) {
      let clean = raw;
      if (clean.includes(',')) {
        clean = clean.split(',')[1] || clean;
      }
      buf = Buffer.from(clean, 'base64');
    } else if (raw.startsWith('http://') || raw.startsWith('https://')) {
      const res = await fetch(raw);
      if (!res.ok) {
        throw new Error(`Failed to load reference image #${idx + 1} (${res.status}): ${res.statusText}`);
      }
      const arrayBuf = await res.arrayBuffer();
      buf = Buffer.from(arrayBuf);
    }

    if (buf) {
      if (buf.byteLength > MAX_REFERENCE_IMAGE_SIZE_BYTES) {
        throw new Error(
          `Reference image #${idx + 1} is too large (${(buf.byteLength / (1024 * 1024)).toFixed(1)}MB). Max size is 20MB.`
        );
      }

      // Try to read metadata; if the raw format is unsupported by sharp
      // (e.g. HEIC, HEIF, AVIF without optional decoders), attempt to reinterpret
      // it as a JPEG/PNG by forcing a decode — if that also fails, surface a
      // human-readable error instead of crashing the request.
      let safeBuffer = buf;
      try {
        const meta = await sharp(buf).metadata();
        if (!meta.format) {
          throw new Error('Unknown format after metadata probe');
        }
        // Force output to JPEG so the rest of the pipeline always gets a known format
        safeBuffer = await sharp(buf).jpeg({ quality: 90 }).toBuffer();
      } catch (metaErr: any) {
        // If sharp cannot read the source at all (e.g. HEIC without libheif),
        // we cannot recover server-side — surface a clear user-facing error
        logger.warn(`[parseReferenceImages] sharp could not decode reference image #${idx + 1}: ${metaErr?.message}`);
        throw new Error(
          `Reference image #${idx + 1} could not be processed — please convert it to JPEG or PNG before uploading (received format may be HEIC/HEIF which requires a different encoder). Error: ${metaErr?.message}`
        );
      }

      buffers.push(safeBuffer);
    }
  }

  return buffers;
}

export async function parseReferenceImage(
  referenceImageUrl?: string | null,
  referenceImageBase64?: string | null
): Promise<Buffer | null> {
  const images = await parseReferenceImages(null, referenceImageUrl, referenceImageBase64);
  return images.length > 0 ? images[0] : null;
}

/**
 * Preprocesses a reference image to satisfy Cloudflare Workers AI FLUX.2 Klein 4B requirements:
 * "All input images provided to these models must be smaller than 512x512 pixels"
 */
export async function preprocessReferenceImageForKlein(buffer: Buffer): Promise<Buffer> {
  return await sharp(buffer)
    .resize({
      width: 512,
      height: 512,
      fit: 'inside', // preserves aspect ratio, neither width nor height exceeds 512
      withoutEnlargement: true,
    })
    .jpeg({ quality: 90 })
    .toBuffer();
}

/**
 * Generates an image using Cloudflare Workers AI with @cf/black-forest-labs/flux-2-klein-4b.
 * Supports Text-to-Image, Image-to-Image, and Multi-Reference editing (up to 4 images).
 * Uses required multipart/form-data with preprocessed input images (<= 512x512).
 */
export async function generateCloudflareFluxKleinImage(
  prompt: string,
  width: number,
  height: number,
  referenceBuffers: Buffer[] = []
): Promise<Buffer> {
  const creds = getCloudflareCredentials();
  if (!creds) {
    throw new Error(
      'Cloudflare Workers AI credentials are not configured on the server. Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.'
    );
  }

  const { accountId, apiToken } = creds;
  const url = `${CLOUDFLARE_API_BASE}/${accountId}/ai/run/${CLOUDFLARE_FLUX_KLEIN_MODEL}`;

  let finalPrompt = prompt.trim();
  if (referenceBuffers.length > 0) {
    if (referenceBuffers.length === 1) {
      finalPrompt = `Modify input_image_0: ${prompt}. Preserve the key subject identity, structural layout, and scene context while applying requested modifications. High detail, balanced lighting.`;
    } else {
      finalPrompt = `Reference images: ${prompt}. Blend and adapt elements from the reference images, preserving key subjects while applying changes, high quality, balanced lighting.`;
    }
  }

  const form = new FormData();
  form.append('prompt', finalPrompt);
  form.append('width', String(width));
  form.append('height', String(height));

  for (let i = 0; i < Math.min(referenceBuffers.length, 4); i++) {
    const preprocessed = await preprocessReferenceImageForKlein(referenceBuffers[i]);
    const blob = new Blob([new Uint8Array(preprocessed.buffer, preprocessed.byteOffset, preprocessed.byteLength) as any], { type: 'image/jpeg' });
    form.append(`input_image_${i}`, blob, `input_image_${i}.jpg`);
  }

  logger.info(
    `Executing Cloudflare Workers AI generation: model=${CLOUDFLARE_FLUX_KLEIN_MODEL}, width=${width}, height=${height}, referenceCount=${referenceBuffers.length}`
  );

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 75000); // 75 seconds

  let res: globalThis.Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
      body: form,
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError' || err.message?.includes('aborted')) {
      throw new Error('Cloudflare Workers AI request timed out after 75 seconds. Please try again.');
    }
    logger.error('Cloudflare Workers AI network error:', { error: err.message });
    throw new Error(`Cloudflare network error: ${err.message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.ok) {
    let data: any;
    try {
      data = await res.json();
    } catch {
      const arrayBuf = await res.arrayBuffer();
      if (arrayBuf && arrayBuf.byteLength > 0) {
        return Buffer.from(arrayBuf);
      }
      throw new Error('Cloudflare Workers AI returned an empty response.');
    }

    const base64Image = data?.result?.image || data?.image;
    if (typeof base64Image === 'string' && base64Image.trim()) {
      let clean = base64Image.trim();
      if (clean.includes(',')) {
        clean = clean.split(',')[1] || clean;
      }
      return Buffer.from(clean, 'base64');
    }

    logger.error('Unexpected Cloudflare response payload:', data);
    throw new Error('Cloudflare Workers AI did not return a valid generated image payload.');
  }

  let errorDetails = '';
  try {
    const errBody: any = await res.json();
    errorDetails =
      errBody?.errors?.[0]?.message ||
      errBody?.error ||
      errBody?.message ||
      JSON.stringify(errBody);
  } catch {
    errorDetails = res.statusText || `HTTP ${res.status}`;
  }

  logger.error(`Cloudflare Workers AI failed with status ${res.status}:`, { errorDetails });

  if (res.status === 400) {
    const lower = errorDetails.toLowerCase();
    if (lower.includes('nsfw') || lower.includes('filter') || lower.includes('moderation') || lower.includes('safety')) {
      throw new Error(
        'Your prompt or reference image was flagged by safety moderation filters. Please modify your prompt or use a different image.'
      );
    }
    throw new Error(`Cloudflare Workers AI request failed: ${errorDetails}`);
  }

  if (res.status === 429) {
    throw new Error(
      'Cloudflare Workers AI rate limit or neuron quota exceeded. Please wait a moment and try again.'
    );
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      'Cloudflare Workers AI authentication failed. Please verify the server API token and Account ID.'
    );
  }

  throw new Error(`Cloudflare Workers AI error (${res.status}): ${errorDetails}`);
}

export function getHFAPIKeys(): string[] {
  const keys = [
    process.env.HUGGINGFACE_API_KEY,
    process.env.HUGGINGFACE_API_KEY_2,
    process.env.NEXT_PUBLIC_HF_API_KEY,
    process.env.HF_API_KEY,
  ];

  return Array.from(new Set(keys.filter((k): k is string => Boolean(k && k.trim()))));
}

export function getLeonardoAPIKeys(): string[] {
  const keys = [
    process.env.LEONARDO_API_KEY,
    process.env.LEONARDO_API_KEY_2,
    process.env.LEONARDO_API_KEY_3,
    process.env.LEONARDO_API_KEY_4,
  ];

  return Array.from(new Set(keys.filter((k): k is string => Boolean(k && k.trim()))));
}

/**
 * Text-to-Image with Hugging Face (handles 503 model cold starts and key rotation).
 */
export async function generateHFImage(
  prompt: string,
  modelId: string,
  width: number,
  height: number
): Promise<Buffer> {
  const keys = getHFAPIKeys();
  if (keys.length === 0) {
    throw new Error('No Hugging Face API key configured on server.');
  }

  const url = `${HF_API_BASE}/${modelId}`;
  const keyErrors: string[] = [];

  for (let keyIdx = 0; keyIdx < keys.length; keyIdx++) {
    const apiKey = keys[keyIdx];

    for (let attempt = 1; attempt <= HF_MAX_RETRIES; attempt++) {
      let res: globalThis.Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: { width, height },
          }),
        });
      } catch (err: any) {
        keyErrors.push(`Key #${keyIdx + 1} network error: ${err.message}`);
        break;
      }

      if (res.status === 503) {
        let waitMs = HF_RETRY_DELAY_MS;
        try {
          const body: any = await res.json();
          if (body?.estimated_time) {
            waitMs = Math.min(body.estimated_time * 1000, HF_RETRY_DELAY_MS);
          }
        } catch (_) {}
        if (attempt < HF_MAX_RETRIES) {
          logger.info(`HF model loading (503), key #${keyIdx + 1}, waiting ${waitMs}ms...`);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        keyErrors.push(`Key #${keyIdx + 1} unavailable after ${HF_MAX_RETRIES} attempts (503).`);
        break;
      }

      if (res.ok) {
        const ab = await res.arrayBuffer();
        return Buffer.from(ab);
      }

      let msg = res.statusText;
      try {
        const body: any = await res.json();
        msg = body?.error || body?.message || msg;
      } catch (_) {}

      if (res.status === 400) {
        throw new Error(`Hugging Face API error 400: ${msg}`);
      }

      keyErrors.push(`Key #${keyIdx + 1} status ${res.status}: ${msg}`);
      break;
    }
  }

  throw new Error(`Hugging Face generation failed on ${modelId}. ${keyErrors.join(' | ')}`);
}

/**
 * Image-to-Image with Hugging Face (reference guided modification).
 */
export async function generateHFImageWithReference(
  prompt: string,
  modelId: string,
  width: number,
  height: number,
  referenceImageBuffer: Buffer,
  guidanceScale: number = 2.5,
  numInferenceSteps: number = 50
): Promise<Buffer> {
  const keys = getHFAPIKeys();
  if (keys.length === 0) {
    throw new Error('No Hugging Face API key configured on server.');
  }

  // Resize reference image to match target dimensions
  let processedReference: Buffer;
  try {
    processedReference = await sharp(referenceImageBuffer)
      .resize(width, height, { fit: 'cover', position: 'center' })
      .png()
      .toBuffer();
  } catch (err: any) {
    throw new Error(`Failed to process reference image: ${err.message}`);
  }

  const base64Reference = processedReference.toString('base64');
  const endpointCandidates = [
    { label: 'router', url: `${HF_API_BASE}/${modelId}` },
    { label: 'api-inference', url: `${HF_API_INFERENCE_BASE}/${modelId}` },
  ];

  const payloadVariants = [
    {
      label: 'inputs=prompt+parameters.image',
      body: {
        inputs: prompt,
        parameters: {
          image: base64Reference,
          guidance_scale: guidanceScale,
          num_inference_steps: numInferenceSteps,
        },
      },
    },
    {
      label: 'inputs=image_base64+parameters.prompt',
      body: {
        inputs: base64Reference,
        parameters: {
          prompt,
          guidance_scale: guidanceScale,
          num_inference_steps: numInferenceSteps,
        },
      },
    },
    {
      label: 'inputs={prompt,image}',
      body: {
        inputs: {
          prompt,
          image: base64Reference,
        },
        parameters: {
          guidance_scale: guidanceScale,
          num_inference_steps: numInferenceSteps,
        },
      },
    },
  ];

  const keyErrors: string[] = [];

  for (let keyIdx = 0; keyIdx < keys.length; keyIdx++) {
    const apiKey = keys[keyIdx];

    for (let endIdx = 0; endIdx < endpointCandidates.length; endIdx++) {
      const endpoint = endpointCandidates[endIdx];

      for (let attempt = 1; attempt <= HF_MAX_RETRIES; attempt++) {
        for (let varIdx = 0; varIdx < payloadVariants.length; varIdx++) {
          const payloadVariant = payloadVariants[varIdx];
          let res: globalThis.Response;
          try {
            res = await fetch(endpoint.url, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payloadVariant.body),
            });
          } catch (err: any) {
            keyErrors.push(`Key #${keyIdx + 1} (${endpoint.label}) network error: ${err.message}`);
            break;
          }

          if (res.status === 503) {
            let waitMs = HF_RETRY_DELAY_MS;
            try {
              const body: any = await res.json();
              if (body?.estimated_time) {
                waitMs = Math.min(body.estimated_time * 1000, HF_RETRY_DELAY_MS);
              }
            } catch (_) {}
            if (attempt < HF_MAX_RETRIES) {
              await new Promise((r) => setTimeout(r, waitMs));
              continue;
            }
            keyErrors.push(`Key #${keyIdx + 1} (${endpoint.label}) unavailable after 503.`);
            break;
          }

          if (res.ok) {
            const ab = await res.arrayBuffer();
            return Buffer.from(ab);
          }

          let msg = res.statusText;
          try {
            const body: any = await res.json();
            msg = body?.error || body?.message || msg;
          } catch (_) {}

          if (res.status === 404) {
            keyErrors.push(`Key #${keyIdx + 1} (${endpoint.label}) 404: ${msg}`);
            break;
          }

          // If payload shape error, try next variant
          if (res.status === 400 && String(msg).toLowerCase().includes('multiple values') && varIdx < payloadVariants.length - 1) {
            continue;
          }

          if (res.status === 400) {
            throw new Error(`Hugging Face API 400: ${msg}`);
          }

          keyErrors.push(`Key #${keyIdx + 1} (${endpoint.label}) ${res.status}: ${msg}`);
          break;
        }
      }
    }
  }

  throw new Error(`Hugging Face image-to-image failed on ${modelId}. ${keyErrors.join(' | ')}`);
}

/**
 * Text-to-Image with Leonardo AI (polls until generation is finished).
 */
export async function generateLeonardoImage(
  prompt: string,
  modelId: string,
  width: number,
  height: number
): Promise<Buffer> {
  const keys = getLeonardoAPIKeys();
  if (keys.length === 0) {
    throw new Error('No Leonardo API key configured on server.');
  }

  const keyErrors: string[] = [];

  for (let keyIdx = 0; keyIdx < keys.length; keyIdx++) {
    const apiKey = keys[keyIdx];

    try {
      const createRes = await fetch(`${LEONARDO_API_BASE}/generations`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId,
          prompt,
          width,
          height,
          num_images: 1,
          contrast: 3.5,
          enhancePrompt: false,
        }),
      });

      const createData: any = await createRes.json().catch(() => ({}));
      if (!createRes.ok) {
        const msg = createData?.error || createData?.message || createRes.statusText;
        keyErrors.push(`Key #${keyIdx + 1} Leonardo status ${createRes.status}: ${msg}`);
        continue;
      }

      const generationId =
        createData?.sdGenerationJob?.generationId ||
        createData?.generationId ||
        createData?.id;

      if (!generationId) {
        keyErrors.push(`Key #${keyIdx + 1}: Leonardo did not return generationId`);
        continue;
      }

      let finalImageUrl: string | null = null;

      for (let poll = 1; poll <= LEONARDO_MAX_POLL_ATTEMPTS; poll++) {
        await new Promise((r) => setTimeout(r, LEONARDO_POLL_INTERVAL_MS));

        const pollRes = await fetch(`${LEONARDO_API_BASE}/generations/${generationId}`, {
          method: 'GET',
          headers: {
            accept: 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
        });

        const pollData: any = await pollRes.json().catch(() => ({}));
        if (!pollRes.ok) continue;

        const genStatus = String(
          pollData?.generations_by_pk?.status ||
          pollData?.sdGenerationJob?.status ||
          pollData?.status ||
          ''
        ).toUpperCase();

        finalImageUrl =
          pollData?.generations_by_pk?.generated_images?.[0]?.url ||
          pollData?.generated_images?.[0]?.url ||
          pollData?.generation?.generated_images?.[0]?.url;

        if (finalImageUrl) break;

        if (genStatus.includes('FAIL') || genStatus.includes('ERROR')) {
          throw new Error(`Leonardo generation failed with status: ${genStatus}`);
        }
      }

      if (!finalImageUrl) {
        throw new Error('Leonardo generation timed out waiting for image URL.');
      }

      const dlRes = await fetch(finalImageUrl);
      if (!dlRes.ok) {
        throw new Error(`Failed to download image from Leonardo (${dlRes.status})`);
      }

      const ab = await dlRes.arrayBuffer();
      return Buffer.from(ab);
    } catch (err: any) {
      keyErrors.push(`Key #${keyIdx + 1}: ${err.message}`);
    }
  }

  throw new Error(`All configured Leonardo keys failed. ${keyErrors.join(' | ')}`);
}

export interface GenerateImageParams {
  prompt: string;
  userEmail: string;
  model?: string;
  provider?: 'cloudflare' | 'huggingface' | 'leonardo';
  width?: number;
  height?: number;
  referenceImage?: string | null;
  referenceImageBase64?: string | null;
  referenceImages?: string[] | null;
  libId?: string;
}

export interface GenerateImageResult {
  success: boolean;
  docId: string;
  libId: string;
  imageUrl: string;
  publicUrl: string;
  prompt: string;
  model: string;
  modelName: string;
  provider: 'cloudflare' | 'huggingface' | 'leonardo';
  width: number;
  height: number;
  generationType: 'text-to-image' | 'image-to-image';
  hasReferenceImage: boolean;
  referenceImageCount: number;
  modelWasSwitched: boolean;
  createdAt: string;
  message?: string;
}

export function getGroqAPIKeys(): string[] {
  const keys = [
    process.env.GROQ_API_KEY,
    process.env.EXPO_PUBLIC_GROQ_API_KEY,
    process.env.EXPO_PUBLIC_GROQ_API_KEY_2,
    process.env.EXPO_PUBLIC_GROQ_API_KEY_3,
    process.env.EXPO_PUBLIC_GROQ_API_KEY_4,
    process.env.EXPO_PUBLIC_GROQ_API_KEY_5,
    process.env.EXPO_PUBLIC_GROQ_API_KEY_6,
    process.env.EXPO_PUBLIC_GROQ_API_KEY_7,
  ];
  return Array.from(new Set(keys.filter((k): k is string => Boolean(k && k.trim()))));
}

export async function enhancePromptWithGroq(
  userPrompt: string,
  options: { isImageToImage: boolean }
): Promise<string> {
  const keys = getGroqAPIKeys();
  if (keys.length === 0) {
    logger.warn('No Groq API keys found, skipping backend prompt enhancement.');
    return userPrompt;
  }

  const systemInstruction = options.isImageToImage
    ? `You are an expert image generation prompt enhancer. The user is providing a prompt to modify an existing image (Image-to-Image). 
Your task is to transform their request into a highly detailed, professional image-generation prompt.
CRITICAL RULES:
1. Preserve the user's actual intent exactly.
2. Explicitly describe that parts of the image NOT mentioned by the user must remain completely unchanged and preserved.
3. Add appropriate visual details (lighting, style, quality) that fit their request, without introducing conflicting elements.
4. Output ONLY the enhanced prompt text. No explanations, no quotes, no conversational filler.`
    : `You are an expert image generation prompt enhancer. The user is providing a prompt for a new image (Text-to-Image).
Your task is to transform their short request into a highly detailed, professional image-generation prompt.
CRITICAL RULES:
1. Preserve the user's core intent and subject.
2. Enhance with professional details: composition, environment, visual style, lighting, perspective, framing, colors, and quality (e.g., ultra-detailed, cinematic lighting).
3. Do not add details that conflict with the user's original instructions.
4. Output ONLY the enhanced prompt text. No explanations, no quotes, no conversational filler.`;

  for (const key of keys) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gemma2-9b-it',
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.6,
          max_tokens: 256,
        }),
      });

      if (res.ok) {
        const data: any = await res.json();
        const enhancedText = data.choices?.[0]?.message?.content?.trim();
        if (enhancedText) {
          logger.info('Prompt successfully enhanced via Groq backend.');
          return enhancedText;
        }
      }
    } catch (err) {
      // silently fall through to next key
    }
  }

  logger.warn('Groq prompt enhancement failed on all keys, falling back to original prompt.');
  return userPrompt;
}

/**
 * Executes complete generation flow with DB record creation and storage persistence.
 */
export async function executeImageGeneration(
  params: GenerateImageParams
): Promise<GenerateImageResult> {
  const { prompt, userEmail, referenceImage, referenceImageBase64, referenceImages } = params;

  if (!prompt || !prompt.trim()) {
    throw new Error('Prompt is required for image generation');
  }
  if (!userEmail) {
    throw new Error('User email is required for image generation');
  }

  const normalizedEmail = userEmail.trim().toLowerCase();
  const libId = params.libId || crypto.randomUUID();

  // 1. Verify user credits
  const CREDIT_COST_PER_GENERATION = 50;
  let userDocId: string | null = null;
  let currentCredits = 5000;
  try {
    const userDocs = await databases.listDocuments(DB_ID, USERS_COLLECTION_ID, [
      Query.equal('email', normalizedEmail),
      Query.limit(1),
    ]);
    if (userDocs.documents && userDocs.documents.length > 0) {
      userDocId = userDocs.documents[0].$id;
      currentCredits =
        typeof userDocs.documents[0].credits === 'number'
          ? userDocs.documents[0].credits
          : 5000;
    }
  } catch (err: any) {
    logger.warn('Could not check user credits in Appwrite users collection:', { error: err.message });
  }

  if (currentCredits < CREDIT_COST_PER_GENERATION) {
    throw new Error(
      `Insufficient credits. You currently have ${currentCredits} credits, but ${CREDIT_COST_PER_GENERATION} credits are required to generate an image.`
    );
  }

  // 2. Parse reference images (supports up to 4 reference images)
  const referenceBuffers = await parseReferenceImages(referenceImages, referenceImage, referenceImageBase64);
  const isImageToImage = referenceBuffers.length > 0;
  const cfCreds = getCloudflareCredentials();

  let targetModel = params.model || (isImageToImage && cfCreds ? CLOUDFLARE_FLUX_KLEIN_MODEL : DEFAULT_TEXT_TO_IMAGE_MODEL_ID);
  let targetProvider = params.provider || getProviderIdByModelId(targetModel);
  let modelWasSwitched = false;

  // If reference images provided, strictly route to Cloudflare FLUX.2 Klein 4B
  if (isImageToImage) {
    if (targetModel !== CLOUDFLARE_FLUX_KLEIN_MODEL) {
      modelWasSwitched = true;
    }
    targetModel = CLOUDFLARE_FLUX_KLEIN_MODEL;
    targetProvider = 'cloudflare';
  } else {
    // Normal text-only generation: Route through Leonardo Flux Schnell Pro
    // (Never route normal text-only generation through Cloudflare)
    if (targetModel === CLOUDFLARE_FLUX_KLEIN_MODEL || targetProvider === 'cloudflare' || !targetModel) {
      targetModel = DEFAULT_TEXT_TO_IMAGE_MODEL_ID;
      targetProvider = 'leonardo';
      modelWasSwitched = true;
    }
  }

  let modelConfig = getModelById(targetModel, targetProvider);

  // Resolve target dimensions
  let targetWidth = params.width ? Number(params.width) : modelConfig.ratios[0].width;
  let targetHeight = params.height ? Number(params.height) : modelConfig.ratios[0].height;

  // Validate or fall back to model's default ratio
  const ratioMatch = modelConfig.ratios.find(
    (r) => r.width === targetWidth && r.height === targetHeight
  );
  if (!ratioMatch) {
    targetWidth = modelConfig.ratios[0].width;
    targetHeight = modelConfig.ratios[0].height;
  }

  const aspectRatio = ratioMatch?.value || `${targetWidth}:${targetHeight}`;
  const groqEnhancedPrompt = await enhancePromptWithGroq(prompt, {
    isImageToImage,
  });

  const enhancedPrompt = enhancePromptForQuality(groqEnhancedPrompt, {
    aspectRatio,
    generationMode: isImageToImage ? GENERATION_MODES.IMAGE_TO_IMAGE : GENERATION_MODES.TEXT_TO_IMAGE,
  });

  const createdAt = new Date().toISOString();

  // 3. Create document in Appwrite with status 'generating'
  const initialPayload = {
    libId,
    userEmail: normalizedEmail,
    prompt: prompt.trim(),
    model: targetModel,
    width: targetWidth,
    height: targetHeight,
    status: 'generating',
    created_at: createdAt,
    generatedImagePath: '',
    publicUrl: '',
  };

  const doc = await databases.createDocument(
    DB_ID,
    IMAGE_GENERATION_COLLECTION_ID,
    ID.unique(),
    initialPayload,
    [
      Permission.read(Role.any()),
      Permission.write(Role.any()),
      Permission.update(Role.any()),
      Permission.delete(Role.any()),
    ]
  );

  const docId = doc.$id;

  try {
    let rawBuffer: Buffer;

    if (isImageToImage) {
      rawBuffer = await generateCloudflareFluxKleinImage(
        enhancedPrompt,
        targetWidth,
        targetHeight,
        referenceBuffers
      );
      targetModel = CLOUDFLARE_FLUX_KLEIN_MODEL;
      targetProvider = 'cloudflare';
    } else if (targetProvider === 'leonardo' || targetModel === DEFAULT_TEXT_TO_IMAGE_MODEL_ID) {
      rawBuffer = await generateLeonardoImage(enhancedPrompt, targetModel, targetWidth, targetHeight);
    } else {
      rawBuffer = await generateHFImage(enhancedPrompt, targetModel, targetWidth, targetHeight);
    }

    // 4. Process image with Sharp to PNG
    let pngBuffer: Buffer;
    try {
      pngBuffer = await sharp(rawBuffer).png({ quality: 90, compressionLevel: 8 }).toBuffer();
    } catch {
      pngBuffer = rawBuffer;
    }

    // 5. Upload to Appwrite Storage
    const safeModelName = targetModel.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `gen_${safeModelName}_${libId}_${Date.now()}.png`;
    const serverFileId = crypto.randomUUID().replace(/-/g, '').slice(0, 20);

    const inputFile = InputFile.fromBuffer(pngBuffer, fileName);
    const uploaded = await storage.createFile(
      STORAGE_BUCKET_ID,
      serverFileId,
      inputFile,
      [
        Permission.read(Role.any()),
        Permission.write(Role.any()),
        Permission.update(Role.any()),
        Permission.delete(Role.any()),
      ]
    );

    const publicUrl = getPublicFileUrl(uploaded.$id);

    // 6. Update document status to 'completed'
    await databases.updateDocument(
      DB_ID,
      IMAGE_GENERATION_COLLECTION_ID,
      docId,
      {
        status: 'completed',
        generatedImagePath: uploaded.$id,
        publicUrl,
        model: targetModel,
      }
    );

    // 7. Deduct credits from user profile in Appwrite
    if (userDocId) {
      try {
        const newBalance = Math.max(0, currentCredits - CREDIT_COST_PER_GENERATION);
        await databases.updateDocument(DB_ID, USERS_COLLECTION_ID, userDocId, {
          credits: newBalance,
        });
        logger.info(`Deducted ${CREDIT_COST_PER_GENERATION} credits from ${normalizedEmail}. Remaining: ${newBalance}`);
      } catch (deductErr: any) {
        logger.warn('Failed to update deducted user credits:', { error: deductErr.message });
      }
    }

    logger.info(`Image generation completed: docId=${docId}, libId=${libId}, fileId=${uploaded.$id}`);

    return {
      success: true,
      docId,
      libId,
      imageUrl: publicUrl,
      publicUrl,
      prompt: prompt.trim(),
      model: targetModel,
      modelName: modelConfig.name,
      provider: targetProvider,
      width: targetWidth,
      height: targetHeight,
      generationType: isImageToImage ? 'image-to-image' : 'text-to-image',
      hasReferenceImage: isImageToImage,
      referenceImageCount: referenceBuffers.length,
      modelWasSwitched,
      createdAt,
      message: `Image generated successfully with ${modelConfig.name}`,
    };
  } catch (err: any) {
    logger.error('Image generation failed during execution:', { error: err.message, docId, libId });
    try {
      await databases.updateDocument(
        DB_ID,
        IMAGE_GENERATION_COLLECTION_ID,
        docId,
        { status: 'failed' }
      );
    } catch (_) {}
    throw err;
  }
}

/**
 * Fetches all generations for a given libId scoped to the authenticated user.
 */
export async function getImageGenerationsForUser(libId: string, userEmail: string) {
  const normalizedEmail = userEmail.trim().toLowerCase();

  const res = await databases.listDocuments(DB_ID, IMAGE_GENERATION_COLLECTION_ID, [
    Query.equal('libId', libId),
    Query.equal('userEmail', normalizedEmail),
    Query.orderDesc('$createdAt'),
    Query.limit(100),
  ]);

  return (res.documents || []).map((doc: any) => ({
    ...doc,
    entryId: doc.$id,
    libId: doc.libId || doc.$id,
    publicUrl: doc.publicUrl || (doc.generatedImagePath ? getPublicFileUrl(doc.generatedImagePath) : ''),
  }));
}

/**
 * Fetches all generations across all libIds for the authenticated user.
 */
export async function getAllImageGenerationsForUser(userEmail: string) {
  const normalizedEmail = userEmail.trim().toLowerCase();

  const res = await databases.listDocuments(DB_ID, IMAGE_GENERATION_COLLECTION_ID, [
    Query.equal('userEmail', normalizedEmail),
    Query.orderDesc('$createdAt'),
    Query.limit(100),
  ]);

  return (res.documents || []).map((doc: any) => ({
    ...doc,
    entryId: doc.$id,
    libId: doc.libId || doc.$id,
    publicUrl: doc.publicUrl || (doc.generatedImagePath ? getPublicFileUrl(doc.generatedImagePath) : ''),
  }));
}
