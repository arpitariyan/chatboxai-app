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
  InputFile,
  Permission,
  Role,
  Query,
  ID,
} from './appwrite-admin';
import {
  IMAGE_MODELS,
  DEFAULT_IMAGE_MODEL_ID,
  GENERATION_MODES,
  getModelById,
  getProviderIdByModelId,
  supportsImageToImage,
  getDefaultImageToImageModelForProvider,
} from '../../config/imageModels';
import { logger } from './logger';

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

export async function parseReferenceImage(
  referenceImageUrl?: string | null,
  referenceImageBase64?: string | null
): Promise<Buffer | null> {
  if (!referenceImageUrl && !referenceImageBase64) {
    return null;
  }

  if (referenceImageBase64) {
    let clean = referenceImageBase64.trim();
    if (clean.includes(',')) {
      clean = clean.split(',')[1] || clean;
    }
    const buf = Buffer.from(clean, 'base64');
    if (buf.byteLength > MAX_REFERENCE_IMAGE_SIZE_BYTES) {
      throw new Error(`Reference image is too large (${(buf.byteLength / (1024 * 1024)).toFixed(1)}MB). Max size is 20MB.`);
    }
    return buf;
  }

  if (referenceImageUrl) {
    const res = await fetch(referenceImageUrl);
    if (!res.ok) {
      throw new Error(`Failed to load reference image (${res.status}): ${res.statusText}`);
    }
    const arrayBuf = await res.arrayBuffer();
    if (arrayBuf.byteLength > MAX_REFERENCE_IMAGE_SIZE_BYTES) {
      throw new Error(`Reference image is too large (${(arrayBuf.byteLength / (1024 * 1024)).toFixed(1)}MB). Max size is 20MB.`);
    }
    return Buffer.from(arrayBuf);
  }

  return null;
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
  provider?: 'huggingface' | 'leonardo';
  width?: number;
  height?: number;
  referenceImage?: string | null;
  referenceImageBase64?: string | null;
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
  provider: 'huggingface' | 'leonardo';
  width: number;
  height: number;
  generationType: 'text-to-image' | 'image-to-image';
  hasReferenceImage: boolean;
  modelWasSwitched: boolean;
  createdAt: string;
  message?: string;
}

/**
 * Executes complete generation flow with DB record creation and storage persistence.
 */
export async function executeImageGeneration(
  params: GenerateImageParams
): Promise<GenerateImageResult> {
  const { prompt, userEmail, referenceImage, referenceImageBase64 } = params;

  if (!prompt || !prompt.trim()) {
    throw new Error('Prompt is required for image generation');
  }
  if (!userEmail) {
    throw new Error('User email is required for image generation');
  }

  const normalizedEmail = userEmail.trim().toLowerCase();
  const libId = params.libId || crypto.randomUUID();

  // Parse reference image if supplied
  const referenceBuffer = await parseReferenceImage(referenceImage, referenceImageBase64);
  const isImageToImage = Boolean(referenceBuffer);

  let targetModel = params.model || DEFAULT_IMAGE_MODEL_ID;
  let targetProvider = params.provider || getProviderIdByModelId(targetModel);
  let modelConfig = getModelById(targetModel, targetProvider);
  let modelWasSwitched = false;

  // If reference image provided, check model compatibility
  if (isImageToImage) {
    if (!supportsImageToImage(targetModel)) {
      const editModel = getDefaultImageToImageModelForProvider('huggingface');
      if (editModel) {
        logger.info(`Auto-switching to edit model ${editModel.id} for image-to-image request`);
        targetModel = editModel.id;
        targetProvider = 'huggingface';
        modelConfig = editModel;
        modelWasSwitched = true;
      }
    }
  }

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
  const enhancedPrompt = enhancePromptForQuality(prompt, {
    aspectRatio,
    generationMode: isImageToImage ? GENERATION_MODES.IMAGE_TO_IMAGE : GENERATION_MODES.TEXT_TO_IMAGE,
  });

  const createdAt = new Date().toISOString();

  // 1. Create document in Appwrite with status 'generating'
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

    if (targetProvider === 'leonardo' && !isImageToImage) {
      rawBuffer = await generateLeonardoImage(enhancedPrompt, targetModel, targetWidth, targetHeight);
    } else if (isImageToImage && referenceBuffer) {
      const candidateModels = [
        targetModel,
        'stabilityai/stable-diffusion-xl-base-1.0',
        'runwayml/stable-diffusion-v1-5',
      ].filter((m, i, arr) => m && arr.indexOf(m) === i && !isHFImageToImageModelTemporarilyUnavailable(m));

      let lastErr: any = null;
      let succeededBuffer: Buffer | null = null;

      for (const cand of candidateModels) {
        try {
          succeededBuffer = await generateHFImageWithReference(
            enhancedPrompt,
            cand,
            targetWidth,
            targetHeight,
            referenceBuffer,
            modelConfig.guidanceScale || 2.5,
            modelConfig.numInferenceSteps || 50
          );
          targetModel = cand;
          modelConfig = getModelById(cand, 'huggingface');
          break;
        } catch (err: any) {
          lastErr = err;
          if (String(err?.message || '').includes('404')) {
            markHFImageToImageModelUnavailable(cand);
          }
        }
      }

      if (!succeededBuffer) {
        throw lastErr || new Error('Image-to-image generation failed for all candidates.');
      }
      rawBuffer = succeededBuffer;
    } else {
      rawBuffer = await generateHFImage(enhancedPrompt, targetModel, targetWidth, targetHeight);
    }

    // 2. Process image with Sharp to PNG
    let pngBuffer: Buffer;
    try {
      pngBuffer = await sharp(rawBuffer).png({ quality: 90, compressionLevel: 8 }).toBuffer();
    } catch {
      pngBuffer = rawBuffer;
    }

    // 3. Upload to Appwrite Storage
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

    // 4. Update document status to 'completed'
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
