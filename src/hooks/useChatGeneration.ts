import { useState, useRef, useEffect, useCallback } from 'react';
import { LLMFallbackService } from '../services/llm/LLMFallbackService';
import { LLMMessage } from '../services/llm/providers';
import { useModelStore } from '../stores/useModelStore';
import { chatService, generateUUID } from '../services/chatService';

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
  onConversationCreated?: (libId: string) => void;
}

interface UseChatGenerationReturn {
  isSearching: boolean;
  isThinking: boolean;
  progressMessage: string;
  sourceList: SearchResultItem[];
  aiResponse: string;
  generateResponse: (
    query: string,
    searchType: 'chat' | 'search' | 'research',
    history?: Array<{ role: 'user' | 'assistant'; content: string }>,
  ) => Promise<void>;
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

  messages.push({ role: 'user', content: query });
  return messages;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useChatGeneration = ({
  currentLibId,
  userEmail,
  userId,
  onConversationCreated,
}: UseChatGenerationOptions): UseChatGenerationReturn => {
  const [isSearching, setIsSearching] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [sourceList, setSourceList] = useState<SearchResultItem[]>([]);
  const [aiResponse, setAiResponse] = useState('');

  // Active libId stored in a ref — reading/writing a ref is synchronous and
  // does NOT trigger re-renders, which is what we want here.
  const activeLibIdRef = useRef<string | null>(currentLibId);

  // Store onConversationCreated in a ref so generateResponse doesn't need it
  // as a dep and doesn't get re-created every render.
  const onConversationCreatedRef = useRef(onConversationCreated);
  useEffect(() => {
    onConversationCreatedRef.current = onConversationCreated;
  });

  const { selectedModel } = useModelStore();
  // Store selectedModel in a ref for the same reason
  const selectedModelRef = useRef(selectedModel);
  useEffect(() => {
    selectedModelRef.current = selectedModel;
  }, [selectedModel]);

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
    isGeneratingRef.current = false;
  }, []);

  // generateResponse has MINIMAL deps — userEmail is the only real dep.
  // Everything else comes from stable refs. This means the function identity
  // is stable across renders and won't cause unnecessary re-renders in parents.
  const generateResponse = useCallback(
    async (
      query: string,
      searchType: 'chat' | 'search' | 'research',
      history: Array<{ role: 'user' | 'assistant'; content: string }> = []
    ) => {
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
      setProgressMessage('Generating response...');

      const model = selectedModelRef.current;
      let modelId =
        (model as any)?.publicId || (model as any)?.modelApi || 'auto';

      // Bypass LLMFallbackService AUTO_CHAIN to guarantee we use a working Groq model
      if (modelId === 'auto') {
        modelId = 'chatboxai/gpt-oss-20b';
      }

      const messages = buildMessages(query, sources, history);

      let responseText = '';
      let llmResult: any = null;

      try {
        llmResult = await LLMFallbackService.routeRequest(modelId, messages, {
          max_tokens: searchType === 'research' ? 4096 : 2048,
          temperature: 0.7,
        });
        responseText = llmResult?.choices?.[0]?.message?.content || '';
      } catch (llmErr: any) {
        console.error('[useChatGeneration] LLM generation failed:', llmErr.message);
        setIsThinking(false);
        setProgressMessage('Generation failed. Please try again.');
        isGeneratingRef.current = false;
        return;
      }

      // ── Step 5: Persist to Appwrite ───────────────────────────────────────
      try {
        const resolvedModel = llmResult?.resolvedModel;
        await chatService.addChatMessage({
          libId: libId!,
          userEmail: normalizedEmail,
          userSearchInput: query,
          aiResp: responseText,
          searchResult: sources.length > 0 ? JSON.stringify(sources) : '',
          analysisType: searchType === 'chat' ? 'text_only' : 'web_search',
          usedModel: resolvedModel?.provider || model?.name || '',
          modelApi: resolvedModel?.modelApi || (model as any)?.modelApi || '',
        });
      } catch (dbErr: any) {
        // Non-fatal — user still sees the response even if DB write fails
        console.warn('[useChatGeneration] addChatMessage failed:', dbErr?.message || dbErr);
      }

      // ── Step 6: Surface result to UI ──────────────────────────────────────
      // Set aiResponse BEFORE clearing isThinking so the ChatScreen effect
      // that reads both simultaneously sees the complete final state.
      setAiResponse(responseText);
      setIsThinking(false);
      setProgressMessage('');
      isGeneratingRef.current = false;
    },
    // Only userEmail is a true dep; everything else comes from stable refs
    [userEmail],
  );

  return {
    isSearching,
    isThinking,
    progressMessage,
    sourceList,
    aiResponse,
    generateResponse,
    reset,
  };
};
