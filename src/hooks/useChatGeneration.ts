import { useState, useRef, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { LLMFallbackService } from '../services/llm/LLMFallbackService';
import { LLMMessage, LLMContentPart } from '../services/llm/providers';
import { toStoredAttachment, serializeAttachmentsForDb, toMobileFileViewUrl } from '../utils/attachments';
import { STORAGE_BUCKET_ID } from '../config/appwrite';
import { useModelStore } from '../stores/useModelStore';
import { chatService, generateUUID } from '../services/chatService';
import { AIModelsOption, DEEP_RESEARCH_MODELS } from '../config/models';
import { parseAiResponse } from '../utils/parseAiResponse';
import { auth } from '../config/firebase';
import { researchService } from '../services/researchService';
import { useResearchStore } from '../stores/useResearchStore';
import { webSearchService, SearchResultItem } from '../services/search/webSearchService';
import { analyzeUserQuery } from '../services/search/queryPlanner';

import { toMobileUploadUrl, toMobileAnalyzeUrl, toMobileFileUrl } from '../config/mobileApi';
import { checkModelEligibility, calculateChatCredits, deductUsageCredits } from '../services/creditEngine';
import { UserProfile } from '../services/userService';
import { AdaptiveResponseOrchestrator } from '../services/intelligence';

// ── Attachment type exposed from this hook ────────────────────────────────────
export interface ChatAttachment {
  uri: string;
  name: string;
  mimeType: string;
  type: 'image' | 'file';
  /** base64 data URI for images, extracted text content for text files */
  data?: string;
}

// ── Types ────────────────────────────────────────────────────────────────────
export type { SearchResultItem };

interface UseChatGenerationOptions {
  /** The current conversation libId. Null = new conversation (first message). */
  currentLibId: string | null;
  userEmail: string;
  userId: string;
  userPlan?: string;
  userProfile?: UserProfile | null;
  refreshProfile?: () => Promise<any>;
  onConversationCreated?: (libId: string, title?: string) => void;
  /**
   * When true the hook generates AI responses but never writes to Appwrite.
   * No library record, no chat record — session is fully ephemeral.
   */
  isIncognito?: boolean;
}

interface UseChatGenerationReturn {
  isSearching: boolean;
  isThinking: boolean;
  isFileAnalyzing: boolean;
  progressMessage: string;
  sourceList: SearchResultItem[];
  /** Clean final answer (no <think> tags) */
  aiResponse: string;
  /** Extracted reasoning/thinking trace (may be empty) */
  aiThinking: string;
  generateResponse: (
    query: string,
    searchType?: 'chat' | 'search' | 'research',
    history?: Array<{ role: 'user' | 'assistant'; content: string }>,
    attachments?: any[],
  ) => Promise<{ dbId: string; processedFiles?: any[]; sources?: SearchResultItem[]; isVerified?: boolean; confidenceLevel?: string } | void>;
  reset: () => void;
}

// ── Build LLM messages from query + search context + history ──────────────────
function buildMessages(
  query: string,
  sources: SearchResultItem[],
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  attachments: ChatAttachment[] = [],
): LLMMessage[] {
  const messages: LLMMessage[] = [];

  let systemContent =
    'You are ChatBox AI, a helpful, accurate, and concise AI assistant. ' +
    "Answer the user's question clearly and helpfully. Use markdown formatting where appropriate.";

  if (sources.length > 0) {
    const ctx = sources
      .slice(0, 6)
      .map((s, i) => {
        const desc = (s.description || s.content || '').trim().slice(0, 350);
        return `[${i + 1}] ${s.title}\n${desc}\nURL: ${s.url}`;
      })
      .join('\n\n');
    systemContent +=
      '\n\nYou have access to the following live web search results. ' +
      'Ground your answer accurately in these sources and naturally cite facts using [1], [2], etc., corresponding to the numbered sources above. Do not invent ungrounded URLs:\n\n' +
      ctx;
  }

  messages.push({ role: 'system', content: systemContent });

  // Last 10 turns of conversation history
  for (const turn of conversationHistory.slice(-10)) {
    messages.push({ role: turn.role, content: turn.content });
  }

  // Build the final user message — multimodal if there are image attachments
  const imageAttachments = attachments.filter(a => a.type === 'image' && a.data);
  const fileAttachments = attachments.filter(a => a.type === 'file' && a.data);

  // Append file text content to the query
  let fullQuery = query;
  if (fileAttachments.length > 0) {
    const fileTexts = fileAttachments
      .map(f => `[File: ${f.name}]\n${f.data}`)
      .join('\n\n');
    fullQuery = `${query}\n\n${fileTexts}`;
  }

  if (imageAttachments.length > 0) {
    // Multimodal content array
    const parts: LLMContentPart[] = [{ type: 'text', text: fullQuery }];
    for (const img of imageAttachments) {
      parts.push({
        type: 'image_url',
        image_url: { url: img.data!, detail: 'auto' },
      });
    }
    messages.push({ role: 'user', content: parts });
  } else {
    messages.push({ role: 'user', content: fullQuery });
  }

  return messages;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useChatGeneration = ({
  currentLibId,
  userEmail,
  userId,
  userPlan = 'free',
  userProfile,
  refreshProfile,
  onConversationCreated,
  isIncognito = false,
}: UseChatGenerationOptions): UseChatGenerationReturn => {
  // Keep isIncognito in a ref so the stable generateResponse closure can read it
  const isIncognitoRef = useRef(isIncognito);
  useEffect(() => {
    isIncognitoRef.current = isIncognito;
  }, [isIncognito]);

  const userProfileRef = useRef(userProfile);
  const refreshProfileRef = useRef(refreshProfile);
  useEffect(() => {
    userProfileRef.current = userProfile;
    refreshProfileRef.current = refreshProfile;
  }, [userProfile, refreshProfile]);
  const [isSearching, setIsSearching] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isFileAnalyzing, setIsFileAnalyzing] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [sourceList, setSourceList] = useState<SearchResultItem[]>([]);
  const [aiResponse, setAiResponse] = useState('');
  const [aiThinking, setAiThinking] = useState('');

  // Active libId stored in a ref — reading/writing a ref is synchronous and
  // does NOT trigger re-renders, which is what we want here.
  const activeLibIdRef = useRef<string | null>(currentLibId);

  // Store onConversationCreated in a ref so generateResponse doesn't need it
  // as a dep and doesn't get re-created every render.
  const onConversationCreatedRef = useRef(onConversationCreated);
  useEffect(() => {
    onConversationCreatedRef.current = onConversationCreated;
  });

  const { selectedModel, effortLevel, thinkingMode, webSearchEnabled } = useModelStore();
  // Store selectedModel, effortLevel, thinkingMode, webSearchEnabled in refs for stable closures
  const selectedModelRef = useRef(selectedModel);
  const effortLevelRef = useRef(effortLevel);
  const thinkingModeRef = useRef(thinkingMode);
  const webSearchEnabledRef = useRef(webSearchEnabled);
  useEffect(() => {
    selectedModelRef.current = selectedModel;
    effortLevelRef.current = effortLevel;
    thinkingModeRef.current = thinkingMode;
    webSearchEnabledRef.current = webSearchEnabled;
  }, [selectedModel, effortLevel, thinkingMode, webSearchEnabled]);

  // Sync activeLibIdRef when parent changes activeLibId (e.g. history navigation)
  useEffect(() => {
    activeLibIdRef.current = currentLibId;
  }, [currentLibId]);

  // Guard against concurrent calls
  const isGeneratingRef = useRef(false);

  const reset = useCallback(() => {
    setIsSearching(false);
    setIsThinking(false);
    setProgressMessage('');
    setSourceList([]);
    setAiResponse('');
    setAiThinking('');
    isGeneratingRef.current = false;
  }, []);

  // generateResponse has MINIMAL deps — userEmail is the only real dep.
  // Everything else comes from stable refs. This means the function identity
  // is stable across renders and won't cause unnecessary re-renders in parents.
  const generateResponse = useCallback(
    async (
      query: string,
      searchType: 'chat' | 'search' | 'research' = 'chat',
      history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
      attachments: any[] = []
    ): Promise<{ dbId: string; processedFiles?: any[]; sources?: SearchResultItem[]; isVerified?: boolean; confidenceLevel?: string } | void> => {
      const effectiveEmail = (userEmail || (isIncognitoRef.current ? 'incognito_session' : '')).trim().toLowerCase();
      if (!effectiveEmail || !query.trim()) return;
      if (isGeneratingRef.current) {
        console.warn('[useChatGeneration] Already generating, ignoring call');
        return;
      }
      isGeneratingRef.current = true;
      const isDeepResearch = searchType === 'research';
      const queryAnalysis = analyzeUserQuery(query);

      // Web Search activates ONLY when the user explicitly enables the "Web search" toggle in the + menu.
      // Normal Search (default) processes prompt purely via the AI model pipeline without web retrieval.
      const isWebSearchToggleOn = Boolean(useModelStore.getState().webSearchEnabled);
      const shouldWebSearch = !isDeepResearch && isWebSearchToggleOn;
      const currentThinkingMode = thinkingModeRef.current;
      const currentEffortLevel = effortLevelRef.current;

      // Always reset states cleanly at the start of each generation to avoid state leakage
      setAiResponse('');
      setProgressMessage('');
      setAiThinking('');
      setSourceList([]);

      const normalizedEmail = effectiveEmail;

      // ── Step 1: Resolve libId ──────────────────────────────────────────────
      let libId = activeLibIdRef.current;
      const isFirstMessage = !libId;

      if (isFirstMessage) {
        libId = generateUUID();
        activeLibIdRef.current = libId; // immediately persist to ref
      }

      // ── Step 2: Web Search ─────────────────────────────────────────────────
      let sources: SearchResultItem[] = [];

      if (shouldWebSearch) {
        setIsSearching(true);
        setProgressMessage('Searching the web...');

        try {
          sources = await webSearchService.search(queryAnalysis.cleanSearchQuery, 8);
          setSourceList(sources);
          if (sources.length > 0) {
            setProgressMessage(`Found ${sources.length} sources, evaluating...`);
          }
        } catch (searchErr: any) {
          console.log('[useChatGeneration] Web search non-fatal error:', searchErr.message);
        } finally {
          setIsSearching(false);
        }
      }

      // ── Step 3: Create library record (first message only) ─────────────────
      // Skip entirely in incognito mode — no DB trace left behind.
      if (isFirstMessage && !isIncognitoRef.current) {
        try {
          const model = selectedModelRef.current;
          await chatService.createConversation({
            libId: libId!,
            userEmail: normalizedEmail,
            searchInput: query,
            type: searchType,
            selectedModel: (model as any)?.modelApi || 'auto',
            modelName: model?.name || 'Auto',
          });
          // Notify parent (AppShell → Drawer) via ref callback — stable
          onConversationCreatedRef.current?.(libId!, query);
        } catch (err: any) {
          console.warn('[useChatGeneration] createConversation failed:', err?.message || err);
          // Non-fatal: continue to generate response anyway
        }
      }

      // ── Step 4: LLM Generation ────────────────────────────────────────────
      setIsThinking(true);
      if (currentThinkingMode) {
        setProgressMessage('Preparing reasoning...');
      } else {
        setProgressMessage('Thinking...');
      }

      const model = selectedModelRef.current;
      let modelId =
        (model as any)?.publicId || (model as any)?.modelApi || 'auto';

      // ── Plan-Aware Auto Model Routing ─────────────────────────────────────
      if (modelId === 'auto') {
        const plan = userPlan.toLowerCase();
        const availableModels = searchType === 'research' ? DEEP_RESEARCH_MODELS : AIModelsOption;

        // Exclude the 'Auto' model itself from the random pool
        const pool = availableModels.filter((m: any) => {
          if (m.modelApi === 'auto' || m.publicId === 'auto') return false;

          const isModelMax = m.accessTier === 'max';
          const isModelPro = m.isPro || m.accessTier === 'pro';

          if (plan === 'free') {
            return !isModelPro && !isModelMax;
          } else if (plan === 'pro') {
            return !isModelMax;
          }
          // 'max' plan can access everything
          return true;
        });

        if (pool.length > 0) {
          const randomModel: any = pool[Math.floor(Math.random() * pool.length)];
          modelId = randomModel.publicId || randomModel.modelApi;
        } else {
          modelId = 'chatboxai/qwen-3.8-27b';
        }
      }

      const messages = buildMessages(query, sources, history, attachments);

      // ── Plan-Aware Pre-Flight Credit & Model Eligibility Check ───────────
      const resolvedModelForCheck = {
        modelApi: modelId,
        publicId: modelId,
        accessTier: (model as any)?.accessTier,
        isPro: (model as any)?.isPro,
      };

      if (userProfileRef.current) {
        const eligibility = checkModelEligibility(userProfileRef.current, resolvedModelForCheck);
        if (!eligibility.allowed) {
          setIsThinking(false);
          setIsSearching(false);
          setIsFileAnalyzing(false);
          setProgressMessage('');
          isGeneratingRef.current = false;
          setAiResponse(eligibility.reason);
          return;
        }
      }

      let responseText = '';
      let llmResult: any = null;
      let finalThinking = '';
      let finalAnswerClean = '';
      let filePaths: any[] = [];

      try {
        if (searchType === 'research') {
          // --- DEEP RESEARCH BRANCH ---
          setIsSearching(true);
          setIsThinking(true);
          setProgressMessage('Understanding query & research goals…');

          try {
            const researchRes = await researchService.executeResearch({
              searchInput: query,
              selectedModel: (model as any)?.modelApi || 'auto',
              conversationHistory: history,
              userEmail: normalizedEmail,
              onProgress: (stageMsg) => setProgressMessage(stageMsg),
            });

            setIsSearching(false);
            finalAnswerClean = researchRes.aiResponse || '';
            finalThinking = researchRes.thinkingContent || '';
            sources = (researchRes.sources || researchRes.searchResult || []) as SearchResultItem[];
            setSourceList(sources);

            llmResult = {
              resolvedModel: { provider: 'Deep Research Engine', modelApi: (model as any)?.modelApi || 'auto' },
            };

            useResearchStore.getState().fetchQuota(normalizedEmail).catch(() => { });
          } catch (researchErr: any) {
            setIsSearching(false);
            if (researchErr.response?.status === 403 && researchErr.response?.data?.error === 'RESEARCH_LIMIT_REACHED') {
              useResearchStore.getState().openLimitSheet();
              throw new Error(researchErr.response?.data?.message || 'Weekly Deep Research limit reached. Resets on Sunday.');
            }
            throw researchErr;
          }
        } else if (attachments.length > 0) {
          // --- REMOTE ANALYSIS BRANCH (Handles files securely) ---
          const token = await auth.currentUser?.getIdToken();
          if (!token) throw new Error("Authentication required for file analysis");

          setIsFileAnalyzing(true);
          setProgressMessage(`Uploading files (0/${attachments.length})...`);

          // 1. Upload files with controlled concurrency (Max 4 parallel)
          let uploadedCount = 0;
          const uploadBatches = [];
          for (let i = 0; i < attachments.length; i += 4) {
            uploadBatches.push(attachments.slice(i, i + 4));
          }

          for (const batch of uploadBatches) {
            const batchPromises = batch.map(async (attachment) => {
              const uploadUrl = toMobileUploadUrl();
              let data: any = null;

              if (Platform.OS !== 'web' && typeof FileSystem?.uploadAsync === 'function' && (attachment.uri.startsWith('file://') || attachment.uri.startsWith('content://'))) {
                try {
                  const uploadRes = await FileSystem.uploadAsync(uploadUrl, attachment.uri, {
                    httpMethod: 'POST',
                    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
                    fieldName: 'file',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Accept': 'application/json',
                    },
                  });
                  data = JSON.parse(uploadRes.body);
                } catch (fsErr) {
                  console.warn('FileSystem.uploadAsync failed, falling back to fetch FormData:', fsErr);
                }
              }

              if (!data) {
                const formData = new FormData();
                formData.append('file', {
                  uri: attachment.uri,
                  name: attachment.name || `file_${Date.now()}.bin`,
                  type: attachment.mimeType || 'application/octet-stream',
                } as any);

                const fetchRes = await fetch(uploadUrl, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                  },
                  body: formData,
                });
                data = await fetchRes.json();
              }

              if (!data?.success || !data?.fileId) throw new Error(data?.error || 'Failed to upload file');

              const mobileFileUrl = toMobileFileUrl(data.fileId);

              const stored = toStoredAttachment({
                fileId: data.fileId,
                path: data.fileId,
                bucketId: data.bucketId || STORAGE_BUCKET_ID,
                publicUrl: mobileFileUrl,
                fileName: data.fileName || attachment.name,
                fileType: data.fileType || attachment.mimeType,
                fileSize: data.fileSize,
              });
              if (!stored) throw new Error('Upload response had no file id');
              return stored;
            });

            const results = await Promise.allSettled(batchPromises);
            for (const res of results) {
              uploadedCount++;
              setProgressMessage(`Uploading files (${uploadedCount}/${attachments.length})...`);
              if (res.status === 'fulfilled') {
                filePaths.push(res.value);
              } else {
                console.warn('File upload failed:', res.reason);
              }
            }
          }

          if (filePaths.length === 0) {
            throw new Error('All file uploads failed. Please try again.');
          }

          setProgressMessage('Analyzing files...');

          // 2. Chunked Pre-Analysis to avoid backend timeouts (Chunk size: 4 files)
          const CHUNK_SIZE = 4;
          const fileChunks = [];
          for (let i = 0; i < filePaths.length; i += CHUNK_SIZE) {
            fileChunks.push(filePaths.slice(i, i + CHUNK_SIZE));
          }

          let aggregatedAiResponse = '';
          let aggregatedThinking = '';
          let actualModel = 'api/mobile/analyze';
          let actualProvider = 'ChatBox Mobile API';

          for (let i = 0; i < fileChunks.length; i++) {
            const chunk = fileChunks[i];
            setProgressMessage(`Analyzing files (Batch ${i + 1}/${fileChunks.length})...`);

            // The final chunk answers the user's question; previous chunks just summarize for context.
            const isFinalChunk = (i === fileChunks.length - 1);
            const chunkPrompt = isFinalChunk ? query : 'Please extract all text, information, and context from these files. Provide a comprehensive summary so I can use it to answer the user\'s final question.';

            // Include aggregated context in the final chunk if we had previous batches
            const finalPromptContext = (isFinalChunk && aggregatedAiResponse)
              ? `Previously Analyzed Context:\n${aggregatedAiResponse}\n\nCurrent Question: ${query}`
              : chunkPrompt;

            const analyzeRes = await fetch(toMobileAnalyzeUrl(), {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                prompt: finalPromptContext,
                fileIds: chunk.map((f: any) => f.fileId),
                // To save tokens, only pass conversation history on the final chunk
                conversationHistory: isFinalChunk ? history : [],
                memoryEnabled: isFinalChunk,
              }),
            });

            const analyzeData = await analyzeRes.json();
            if (!analyzeRes.ok || analyzeData.error) {
              if (isFinalChunk && !aggregatedAiResponse) {
                if (analyzeRes.status === 429) throw new Error("Rate limit exceeded. Please try again later.");
                if (analyzeRes.status === 402) throw new Error("Insufficient AI credits for document analysis.");
                throw new Error(analyzeData.error || 'Analysis failed');
              } else {
                console.warn(`Chunk ${i + 1} analysis failed:`, analyzeData.error);
                continue;
              }
            }

            if (isFinalChunk) {
              aggregatedAiResponse = analyzeData.aiResponse || aggregatedAiResponse;
              if (analyzeData.thinkingContent) aggregatedThinking += (aggregatedThinking ? '\n\n' : '') + analyzeData.thinkingContent;
            } else {
              // Append summary to the running context
              aggregatedAiResponse += (aggregatedAiResponse ? '\n\n' : '') + (analyzeData.aiResponse || '');
            }
          }

          setIsFileAnalyzing(false);
          setIsThinking(true);
          setProgressMessage('Preparing answer...');

          finalAnswerClean = aggregatedAiResponse || '';
          finalThinking = currentThinkingMode ? (aggregatedThinking || '') : '';
          responseText = finalAnswerClean; // For fallback

          llmResult = {
            resolvedModel: { provider: actualProvider, modelApi: actualModel },
          };
        } else {
          // --- ADAPTIVE RESPONSE INTELLIGENCE PIPELINE ---
          const orchestrated = await AdaptiveResponseOrchestrator.execute({
            query,
            modelId,
            userEmail: normalizedEmail,
            conversationHistory: history,
            sources,
            attachments,
            isIncognito: isIncognitoRef.current,
            effortLevel: currentEffortLevel,
            thinkingMode: currentThinkingMode,
            onProgress: (stageMsg) => setProgressMessage(stageMsg),
          });

          finalAnswerClean = orchestrated.finalAnswer;
          finalThinking = currentThinkingMode ? (orchestrated.finalThinking || '') : '';
          responseText = finalAnswerClean;

          llmResult = {
            resolvedModel: { provider: orchestrated.modelUsed, modelApi: modelId },
            orchestrated,
          };
        }
      } catch (err: any) {
        console.error('[useChatGeneration] generation failed:', err?.message || err);
        setIsThinking(false);
        setIsSearching(false);
        setIsFileAnalyzing(false);
        setProgressMessage('');
        isGeneratingRef.current = false;
        const errMsg = err?.message || 'Generation failed. Please try again.';
        setAiResponse(`Sorry, an error occurred while processing your request: ${errMsg}`);
        return;
      }

      // ── Step 5b: Dual-Wallet Credit Deduction ────────────────────────────
      if (userProfileRef.current && !isIncognitoRef.current) {
        const promptTokens = Math.max(10, Math.ceil(query.length / 4));
        const completionTokens = Math.max(15, Math.ceil((finalAnswerClean || responseText).length / 4));
        const creditCalc = calculateChatCredits(modelId, promptTokens, completionTokens);
        const searchCost = sources.length > 0 ? 25 : 0;
        const totalCreditsToDeduct = creditCalc.creditsUsed + searchCost;

        deductUsageCredits({
          userProfile: userProfileRef.current,
          modelIdOrApi: modelId,
          creditsToDeduct: totalCreditsToDeduct,
          metadata: {
            lib_id: currentLibId,
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            search_cost: searchCost,
          },
        })
          .then(() => {
            refreshProfileRef.current?.();
          })
          .catch((err: any) => {
            console.warn('[useChatGeneration] Credit deduction non-fatal:', err?.message || err);
          });
      }

      // ── Step 6: Persist to Appwrite ───────────────────────────────────────
      // In incognito mode: skip ALL DB writes. Surface result directly to UI.
      if (isIncognitoRef.current) {
        setAiThinking(finalThinking);
        setAiResponse(finalAnswerClean || responseText);
        setIsThinking(false);
        setProgressMessage('');
        isGeneratingRef.current = false;
        return {
          dbId: '',
          processedFiles: filePaths,
          sources,
          isVerified: llmResult?.orchestrated?.isVerified,
          confidenceLevel: llmResult?.orchestrated?.confidence?.level,
        };
      }

      // Only save the CLEAN final answer to aiResp (no <think> pollution).
      // If there are sources, store them alongside the reasoning in a wrapper
      // so reasoning is persisted and survives a reload (Option A).
      try {
        const resolvedModel = llmResult?.resolvedModel;
        let searchResultPayload = '';
        const isVerified = llmResult?.orchestrated?.isVerified;
        const confidenceLevel = llmResult?.orchestrated?.confidence?.level;

        if (sources.length > 0 || finalThinking || isVerified || confidenceLevel) {
          // Build a wrapper object: { sources: [...], reasoning: '...', isVerified: true, confidence: '...' }
          searchResultPayload = JSON.stringify({
            sources: sources.length > 0 ? sources : [],
            ...(finalThinking ? { reasoning: finalThinking } : {}),
            ...(isVerified ? { isVerified: true } : {}),
            ...(confidenceLevel ? { confidence: confidenceLevel } : {}),
          });
        }

        const hasFiles = filePaths && filePaths.length > 0;
        const dbProcessed = hasFiles ? serializeAttachmentsForDb(filePaths) : undefined;

        const chatRecord = await chatService.addChatMessage({
          libId: libId!,
          userEmail: normalizedEmail,
          userSearchInput: query,
          aiResp: finalAnswerClean || responseText, // fallback: save raw if parse failed
          searchResult: searchResultPayload,
          analysisType: isDeepResearch
            ? 'deep_research'
            : (hasFiles ? 'file_analysis' : (sources.length > 0 ? 'web_search' : 'text_only')),
          usedModel: resolvedModel?.provider || model?.name || '',
          modelApi: resolvedModel?.modelApi || (model as any)?.modelApi || '',
          analyzedFilesCount: hasFiles ? filePaths.length : 0,
          processedFiles: dbProcessed,
          isThinkingMode: currentThinkingMode && !!finalThinking,
        });

        const dbId = chatRecord ? chatRecord.id : '';

        // ── Step 7: Surface result to UI ──────────────────────────────────────
        // Set both before clearing isThinking so ChatScreen sees complete state.
        setAiThinking(finalThinking);
        setAiResponse(finalAnswerClean || responseText);
        setIsThinking(false);
        setProgressMessage('');
        isGeneratingRef.current = false;

        return {
          dbId,
          processedFiles: filePaths,
          sources,
          isVerified,
          confidenceLevel,
        };
      } catch (dbErr: any) {
        // Non-fatal — user still sees the response even if DB write fails
        console.warn('[useChatGeneration] addChatMessage failed:', dbErr?.message || dbErr);

        // Still resolve UI state
        setAiThinking(finalThinking);
        setAiResponse(finalAnswerClean || responseText);
        setIsThinking(false);
        setProgressMessage('');
        isGeneratingRef.current = false;

        return {
          dbId: '',
          processedFiles: filePaths,
          sources,
          isVerified: llmResult?.orchestrated?.isVerified,
          confidenceLevel: llmResult?.orchestrated?.confidence?.level,
        };
      }
    },
    // Only userEmail is a true dep; everything else comes from stable refs
    [userEmail],
  );

  return {
    isSearching,
    isThinking,
    isFileAnalyzing,
    progressMessage,
    sourceList,
    aiResponse,
    aiThinking,
    generateResponse,
    reset,
  };
};
