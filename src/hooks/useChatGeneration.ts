import { useState, useRef, useEffect, useCallback } from 'react';
import { LLMFallbackService } from '../services/llm/LLMFallbackService';
import { LLMMessage, LLMContentPart } from '../services/llm/providers';
import { toStoredAttachment, serializeAttachmentsForDb, toMobileFileViewUrl } from '../utils/attachments';
import { STORAGE_BUCKET_ID } from '../config/appwrite';
import { useModelStore } from '../stores/useModelStore';
import { chatService, generateUUID } from '../services/chatService';
import { AIModelsOption, DEEP_RESEARCH_MODELS } from '../config/models';
import { parseAiResponse } from '../utils/parseAiResponse';
import { auth } from '../config/firebase';

import { toMobileUploadUrl, toMobileAnalyzeUrl, toMobileFileUrl } from '../config/mobileApi';

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

export interface SearchResultItem {
  title: string;
  description: string;
  url: string;
  name?: string;
  image?: string;
  thumbnail?: string;
  publishedAt?: string;
  source?: string;
}

interface UseChatGenerationOptions {
  /** The current conversation libId. Null = new conversation (first message). */
  currentLibId: string | null;
  userEmail: string;
  userId: string;
  userPlan?: string;
  onConversationCreated?: (libId: string) => void;
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
  ) => Promise<{ dbId: string; processedFiles?: any[] } | void>;
  reset: () => void;
}

// ── DuckDuckGo Instant Answer search (on-device, no server required) ──────────
async function fetchDuckDuckGoResults(query: string): Promise<SearchResultItem[]> {
  try {
    const encoded = encodeURIComponent(query);
    const url =
      `https://api.duckduckgo.com/?q=${encoded}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`DDG HTTP ${res.status}`);
    const data = await res.json();

    const results: SearchResultItem[] = [];

    // Abstract (single canonical answer)
    if (data.AbstractURL && data.Abstract) {
      results.push({
        title: data.Heading || query,
        description: data.Abstract,
        url: data.AbstractURL,
        name:
          data.AbstractSource ||
          data.AbstractURL.replace(/https?:\/\//, '').split('/')[0],
        image: data.Image || '',
        thumbnail: data.Image || '',
      });
    }

    // Related Topics
    const topics: any[] = data.RelatedTopics || [];
    for (const t of topics) {
      if (t.FirstURL && t.Text) {
        results.push({
          title: t.Text.split(' - ')[0] || t.Text.slice(0, 80),
          description: t.Text,
          url: t.FirstURL,
          name: t.FirstURL.replace(/https?:\/\//, '').split('/')[0],
          image: t.Icon?.URL || '',
          thumbnail: t.Icon?.URL || '',
        });
      }
      if (Array.isArray(t.Topics)) {
        for (const st of t.Topics) {
          if (st.FirstURL && st.Text) {
            results.push({
              title: st.Text.split(' - ')[0] || st.Text.slice(0, 80),
              description: st.Text,
              url: st.FirstURL,
              name: st.FirstURL.replace(/https?:\/\//, '').split('/')[0],
              image: st.Icon?.URL || '',
              thumbnail: st.Icon?.URL || '',
            });
          }
        }
      }
    }

    return results.slice(0, 12);
  } catch (err: any) {
    console.warn('[Search] DuckDuckGo search failed, continuing without sources:', err.message);
    return [];
  }
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
      .slice(0, 8)
      .map((s, i) => `[${i + 1}] ${s.title}\n${s.description}\nURL: ${s.url}`)
      .join('\n\n');
    systemContent +=
      '\n\nYou have access to the following web search results. ' +
      'Use them where relevant and cite sources naturally:\n\n' +
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
  onConversationCreated,
}: UseChatGenerationOptions): UseChatGenerationReturn => {
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

  const { selectedModel, effortLevel, thinkingMode } = useModelStore();
  // Store selectedModel and effortLevel in refs for stable closures
  const selectedModelRef = useRef(selectedModel);
  const effortLevelRef = useRef(effortLevel);
  const thinkingModeRef = useRef(thinkingMode);
  useEffect(() => {
    selectedModelRef.current = selectedModel;
    effortLevelRef.current = effortLevel;
    thinkingModeRef.current = thinkingMode;
  }, [selectedModel, effortLevel, thinkingMode]);

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
    ): Promise<{ dbId: string; processedFiles?: any[] } | void> => {
      if (!userEmail || !query.trim()) return;
      if (isGeneratingRef.current) {
        console.warn('[useChatGeneration] Already generating, ignoring call');
        return;
      }
      isGeneratingRef.current = true;

      // Reset only visible states, not source list (that's set fresh below)
      setAiResponse('');
      setProgressMessage('');

      const normalizedEmail = userEmail.trim().toLowerCase();

      // ── Step 1: Resolve libId ──────────────────────────────────────────────
      let libId = activeLibIdRef.current;
      const isFirstMessage = !libId;

      if (isFirstMessage) {
        libId = generateUUID();
        activeLibIdRef.current = libId; // immediately persist to ref
      }

      // ── Step 2: Web Search ─────────────────────────────────────────────────
      let sources: SearchResultItem[] = [];

      if (searchType === 'search' || searchType === 'research') {
        setIsSearching(true);
        setProgressMessage(
          searchType === 'research' ? 'Deep researching the web...' : 'Searching the web...',
        );

        sources = await fetchDuckDuckGoResults(query);
        setSourceList(sources);
        setIsSearching(false);
      }

      // ── Step 3: Create library record (first message only) ─────────────────
      if (isFirstMessage) {
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
          onConversationCreatedRef.current?.(libId!);
        } catch (err: any) {
          console.warn('[useChatGeneration] createConversation failed:', err?.message || err);
          // Non-fatal: continue to generate response anyway
        }
      }

      // ── Step 4: LLM Generation ────────────────────────────────────────────
      setIsThinking(true);
      setProgressMessage('Preparing answer...');

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
          modelId = 'chatboxai/gpt-oss-20b';
        }
      }

      const messages = buildMessages(query, sources, history, attachments);
      const currentEffortLevel = effortLevelRef.current;
      const currentThinkingMode = thinkingModeRef.current;

      let responseText = '';
      let llmResult: any = null;
      let finalThinking = '';
      let finalAnswerClean = '';
      let filePaths: any[] = [];

      try {
        if (attachments.length > 0) {
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
              const formData = new FormData();
              formData.append('file', {
                uri: attachment.uri,
                name: attachment.name || `file_${Date.now()}.bin`,
                type: attachment.mimeType || 'application/octet-stream',
              } as any);

              const uploadRes = await require('axios').default.post(toMobileUploadUrl(), formData, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'multipart/form-data',
                },
              });

              const data = uploadRes.data;
              if (!data.success || !data.fileId) throw new Error(data.error || 'Failed to upload file');

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
          finalThinking = aggregatedThinking || '';
          responseText = finalAnswerClean; // For fallback

          llmResult = {
            resolvedModel: { provider: actualProvider, modelApi: actualModel },
          };
        } else {
          // --- LOCAL SERVICE BRANCH (Fast text-only/fallback) ---
          llmResult = await LLMFallbackService.routeRequest(modelId, messages, {
            max_tokens: searchType === 'research' ? 4096 : 2048,
            temperature: currentEffortLevel === 'Low' ? 0.7 : currentEffortLevel === 'Medium' ? 0.6 : 0.5,
            effortLevel: currentEffortLevel,
            thinkingMode: currentThinkingMode,
          });
          responseText = llmResult?.choices?.[0]?.message?.content || '';

          const parsed = parseAiResponse(responseText);
          finalThinking = parsed.thinking;
          finalAnswerClean = parsed.finalAnswer;
        }
      } catch (err: any) {
        console.error('[useChatGeneration] generation failed:', err.message);
        setIsThinking(false);
        setProgressMessage(err.message || 'Generation failed. Please try again.');
        isGeneratingRef.current = false;
        return;
      }

      // ── Step 6: Persist to Appwrite ───────────────────────────────────────
      // Only save the CLEAN final answer to aiResp (no <think> pollution).
      // If there are sources, store them alongside the reasoning in a wrapper
      // so reasoning is persisted and survives a reload (Option A).
      try {
        const resolvedModel = llmResult?.resolvedModel;
        let searchResultPayload = '';
        if (sources.length > 0 || finalThinking) {
          // Build a wrapper object: { sources: [...], reasoning: '...' }
          searchResultPayload = JSON.stringify({
            sources: sources.length > 0 ? sources : [],
            ...(finalThinking ? { reasoning: finalThinking } : {}),
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
          analysisType: hasFiles ? 'file_analysis' : (searchType === 'chat' ? 'text_only' : 'web_search'),
          usedModel: resolvedModel?.provider || model?.name || '',
          modelApi: resolvedModel?.modelApi || (model as any)?.modelApi || '',
          analyzedFilesCount: hasFiles ? filePaths.length : 0,
          processedFiles: dbProcessed,
          isThinkingMode: hasFiles ? true : !!finalThinking,
        });

        const dbId = chatRecord ? chatRecord.id : '';

        // ── Step 7: Surface result to UI ──────────────────────────────────────
        // Set both before clearing isThinking so ChatScreen sees complete state.
        setAiThinking(finalThinking);
        setAiResponse(finalAnswerClean || responseText);
        setIsThinking(false);
        setProgressMessage('');
        isGeneratingRef.current = false;

        return { dbId, processedFiles: filePaths };
      } catch (dbErr: any) {
        // Non-fatal — user still sees the response even if DB write fails
        console.warn('[useChatGeneration] addChatMessage failed:', dbErr?.message || dbErr);

        // Still resolve UI state
        setAiThinking(finalThinking);
        setAiResponse(finalAnswerClean || responseText);
        setIsThinking(false);
        setProgressMessage('');
        isGeneratingRef.current = false;

        return;
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
