import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Platform,
  Image,
  Keyboard,
  Pressable,
  LayoutChangeEvent,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { IconArrowDown } from '@tabler/icons-react-native';
import { ChatBubble, MessageItem } from '@/components/chat/ChatBubble';
import { ThinkingBlock } from '@/components/chat/ThinkingBlock';
import { Composer } from '@/components/chat/Composer';
import { SuggestionCards } from '@/components/chat/SuggestionCards';
import { AddMenuSheet } from '@/components/chat/AttachmentSheet';
import { VoiceOverlay } from '@/components/chat/VoiceOverlay';
import { DeepResearchLimitSheet } from '@/components/chat/DeepResearchLimitSheet';
import { ResearchProgressIndicator } from '@/components/chat/ResearchProgressIndicator';
import { useResearchStore } from '@/stores/useResearchStore';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColors, spacing, typography } from '@/theme';
import { chatService, cleanConversationTitle } from '@/services/chatService';
import { useChatGeneration, ChatAttachment } from '@/hooks/useChatGeneration';
import { useModelStore } from '@/stores/useModelStore';
import { parseStoredAttachments } from '@/utils/attachments';
import { getFadeGradientConfig } from '@/utils/gradientFade';

// ── Hoist this out of the component so it is created exactly ONCE ──────────
// Calling Animated.createAnimatedComponent() inside render creates a new type
// each render, which forces React to fully unmount+remount the tree and
// resets the ScrollView scroll position (the root cause of the scroll jump).
// This must live at module level, never inside a component or function body.
const AnimatedScrollContainer = Animated.createAnimatedComponent(
  // We actually just use View here since we manage keyboard insets ourselves
  View,
);

const logoImg = require('../../../assets/images/logo.png');

interface ChatScreenProps {
  activeLibId?: string | null;
  onConversationCreated?: (libId: string, title?: string) => void;
  onConversationActiveChange?: (isActive: boolean) => void;
  onConversationTitleChange?: (title: string) => void;
  onSelectCreateImage?: (initialPrompt?: string, initialReferenceUri?: string) => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  activeLibId,
  onConversationCreated,
  onConversationActiveChange,
  onConversationTitleChange,
  onSelectCreateImage,
}) => {
  const colors = useThemeColors();
  const { currentUser, userProfile } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);

  const [currentLibIdState, setCurrentLibIdState] = useState<string | null>(
    activeLibId || null,
  );
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);

  // ── Scroll-down FAB — use a ref for the bool so handleScroll is stable ──
  const showScrollDownRef = useRef(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const scrollButtonOpacity = useRef(new Animated.Value(0)).current;

  // ── Near-bottom guard: only auto-scroll on keyboard open when near bottom ─
  const isNearBottomRef = useRef(true);

  const { selectedModel } = useModelStore();

  const userEmail = currentUser?.email?.trim().toLowerCase() ?? '';
  const userId = currentUser?.uid ?? '';

  // ── Stable onConversationCreated & onConversationTitleChange callback refs ──
  const onConversationCreatedRef = useRef(onConversationCreated);
  const onConversationTitleChangeRef = useRef(onConversationTitleChange);
  useEffect(() => {
    onConversationCreatedRef.current = onConversationCreated;
    onConversationTitleChangeRef.current = onConversationTitleChange;
  });

  const handleConversationCreatedStable = useCallback((libId: string, title?: string) => {
    setCurrentLibIdState(libId);
    if (title) {
      onConversationTitleChangeRef.current?.(cleanConversationTitle(title));
    }
    onConversationCreatedRef.current?.(libId, title);
  }, []); // empty deps — stable forever

  // ── Notify parent shell whenever conversation becomes active vs empty home screen ──
  useEffect(() => {
    const isConv = Boolean(activeLibId || currentLibIdState || messages.length > 0);
    onConversationActiveChange?.(isConv);
  }, [activeLibId, currentLibIdState, messages.length, onConversationActiveChange]);

  const {
    isSearching,
    isThinking,
    isFileAnalyzing,
    progressMessage,
    sourceList,
    aiResponse,
    aiThinking,
    generateResponse,
    reset: resetGeneration,
  } = useChatGeneration({
    currentLibId: currentLibIdState,
    userEmail,
    userId,
    userPlan: userProfile?.plan || 'free',
    onConversationCreated: handleConversationCreatedStable,
  });

  // ── Track latest aiResponse and aiThinking in refs (stable closure) ────────
  const aiResponseRef = useRef('');
  const aiThinkingRef = useRef('');
  const sourceListRef = useRef(sourceList);
  useEffect(() => {
    aiResponseRef.current = aiResponse;
    aiThinkingRef.current = aiThinking;
    sourceListRef.current = sourceList;
  }, [aiResponse, aiThinking, sourceList]);

  // ── Reset when user account changes ──────────────────────────────────────
  useEffect(() => {
    setMessages([]);
    setCurrentLibIdState(null);
    isNearBottomRef.current = true;
  }, [currentUser?.email]);

  // ── Sync activeLibId from parent ──────────────────────────────────────────
  useEffect(() => {
    setCurrentLibIdState(activeLibId || null);
  }, [activeLibId]);

  // ── Load history when activeLibId is set ─────────────────────────────────
  useEffect(() => {
    if (!activeLibId || !currentUser?.email) {
      setMessages([]);
      return;
    }

    // CRITICAL FIX: If activeLibId just became truthy (via handleConversationCreated in AppShell)
    // but we already have local messages, this means we JUST sent our first message.
    // We MUST NOT fetch history from the DB right now, because the DB doesn't have the AI response
    // yet (it's still generating), and fetching history would overwrite the local user message with an empty array!
    if (messages.length > 0) {
      return;
    }

    let isMounted = true;
    setIsLoadingHistory(true);
    regeneratingMessageIdRef.current = null;

    chatService
      .fetchConversationChats(activeLibId, currentUser.email)
      .then((records) => {
        if (!isMounted) return;

        const loadedMessages: MessageItem[] = [];
        const userQueryToIndex = new Map<string, number>();

        for (const rec of records) {
          const formattedTime = rec.createdAt
            ? new Date(rec.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })
            : '';

          if (rec.userSearchInput) {
            let userIdx = userQueryToIndex.get(rec.userSearchInput);
            const isRegeneration = userIdx !== undefined && !rec.processedFiles;

            if (!isRegeneration) {
              // First time seeing this user query
              let parsedAttachments: any[] | undefined = parseStoredAttachments(rec.processedFiles);
              if (parsedAttachments.length === 0) parsedAttachments = undefined;

              loadedMessages.push({
                id: `${rec.id}-user`,
                role: 'user',
                content: rec.userSearchInput,
                timestamp: formattedTime,
                attachments: parsedAttachments,
              });
              userQueryToIndex.set(rec.userSearchInput, loadedMessages.length - 1);
            }

            if (rec.aiResp) {
              // Unpack the searchResult field — it may be a plain array of sources
              // or an Option-A wrapper object { sources: [...], reasoning: '...' }
              let parsedSources: any[] | undefined;
              let persistedReasoning: string | undefined;
              if (rec.searchResult) {
                try {
                  const raw = JSON.parse(rec.searchResult as string);
                  if (Array.isArray(raw)) {
                    parsedSources = raw;
                  } else if (raw && typeof raw === 'object') {
                    // Option A wrapper
                    parsedSources = Array.isArray(raw.sources) ? raw.sources : undefined;
                    persistedReasoning = typeof raw.reasoning === 'string' && raw.reasoning
                      ? raw.reasoning
                      : undefined;
                  }
                } catch {
                  parsedSources = undefined;
                }
              }

              if (isRegeneration) {
                // This is a regenerated version! Group it.
                // The AI message will be exactly after the user message (userIdx + 1)
                const aiMsg = loadedMessages[userIdx! + 1];
                if (aiMsg && aiMsg.role === 'assistant') {
                  if (!aiMsg.versions) {
                    aiMsg.versions = [{
                      id: aiMsg.id,
                      content: aiMsg.content,
                      thinking: aiMsg.thinking,
                      searchResult: aiMsg.searchResult,
                      modelName: aiMsg.modelName,
                      liked: aiMsg.liked,
                      disliked: aiMsg.disliked,
                    }];
                  }
                  aiMsg.versions.push({
                    id: `${rec.id}-ai`,
                    content: rec.aiResp,
                    thinking: persistedReasoning,
                    searchResult: parsedSources,
                    modelName: selectedModel?.name || 'ChatBox AI',
                    liked: rec.liked,
                    disliked: rec.disliked,
                  });
                  
                  aiMsg.currentVersionIndex = aiMsg.versions.length - 1;
                  aiMsg.content = rec.aiResp;
                  aiMsg.thinking = persistedReasoning;
                  aiMsg.searchResult = parsedSources;
                  aiMsg.modelName = selectedModel?.name || 'ChatBox AI';
                  aiMsg.liked = rec.liked;
                  aiMsg.disliked = rec.disliked;
                }
              } else {
                // New AI response
                loadedMessages.push({
                  id: `${rec.id}-ai`,
                  role: 'assistant',
                  content: rec.aiResp,
                  thinking: persistedReasoning,
                  timestamp: formattedTime,
                  searchResult: parsedSources,
                  modelName: selectedModel?.name || 'ChatBox AI',
                  liked: rec.liked,
                  disliked: rec.disliked,
                });
              }
            }

          }
        }

        setMessages(loadedMessages);
        setIsLoadingHistory(false);

        // Notify parent of conversation title from first user query
        const firstUserMsg = loadedMessages.find((m) => m.role === 'user');
        if (firstUserMsg && firstUserMsg.content) {
          onConversationTitleChangeRef.current?.(cleanConversationTitle(firstUserMsg.content));
        }

        // Scroll to bottom once after history loads
        requestAnimationFrame(() => {
          scrollViewRef.current?.scrollToEnd({ animated: false });
          isNearBottomRef.current = true;
        });
      })
      .catch((err) => {
        if (isMounted) {
          console.warn('[ChatScreen] Error loading history:', err);
          setIsLoadingHistory(false);
        }
      });

    return () => {
      isMounted = false;
    };
    // selectedModel intentionally omitted — only re-run when libId or user changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLibId, currentUser?.email]);

  // ── AI response → append message to list ─────────────────────────────────
  // IMPORTANT: We use a separate stable effect that captures state via ref
  // to avoid stale closures. resetGeneration() is called AFTER the message
  // is appended so the sourceList is still available.
  useEffect(() => {
    if (!isThinking && aiResponse) {
      const currentSources = sourceListRef.current;
      const currentThinking = aiThinkingRef.current;
      const assistantMessage: MessageItem = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: aiResponse,
        thinking: currentThinking || undefined,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        isStreaming: true, // Trigger local typewriter animation in ChatBubble
        modelName: selectedModel?.name || 'Auto',
        searchResult: currentSources.length > 0 ? currentSources : undefined,
      };

      setMessages((prev) => {
        if (regeneratingMessageIdRef.current) {
          const regenId = regeneratingMessageIdRef.current;
          const idx = prev.findIndex((m) => m.id === regenId);
          if (idx !== -1) {
            const newMessages = [...prev];
            const target = { ...newMessages[idx] };
            if (!target.versions) {
              target.versions = [{
                id: target.id,
                content: target.content,
                thinking: target.thinking,
                searchResult: target.searchResult,
                modelName: target.modelName,
                liked: target.liked,
                disliked: target.disliked,
              }];
            }
            target.versions.push({
              id: assistantMessage.id,
              content: assistantMessage.content,
              thinking: assistantMessage.thinking,
              searchResult: assistantMessage.searchResult,
              modelName: assistantMessage.modelName,
              liked: assistantMessage.liked,
              disliked: assistantMessage.disliked,
            });
            target.currentVersionIndex = target.versions.length - 1;
            // DO NOT OVERWRITE target.id HERE! Overwriting it destroys the React key
            // and forces the ChatBubble to unmount and remount, which loses state.
            target.content = assistantMessage.content;
            target.thinking = assistantMessage.thinking;
            target.searchResult = assistantMessage.searchResult;
            target.modelName = assistantMessage.modelName;
            target.liked = assistantMessage.liked;
            target.disliked = assistantMessage.disliked;
            
            newMessages[idx] = target;
            return newMessages;
          }
        }
        return [...prev, assistantMessage];
      });

      // Scroll to bottom smoothly
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
        isNearBottomRef.current = true;
      });

      // Clear generation state AFTER appending
      regeneratingMessageIdRef.current = null;
      resetGeneration();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isThinking, aiResponse]);

  // ── Keyboard handling — only for scroll adjustment, NO layout manipulation ─
  // On Android: the OS already resizes the window (adjustResize/adjustPan).
  // We only need to scroll the content if the user was near the bottom.
  // On iOS: KeyboardAvoidingView with behavior='padding' handles layout.
  useEffect(() => {
    const handleKeyboardShow = () => {
      // Only scroll down if user was already near the bottom
      if (isNearBottomRef.current) {
        const t = setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
        return () => clearTimeout(t);
      }
    };

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(showEvent, handleKeyboardShow);
    return () => sub.remove();
  }, []); // stable — no state deps

  // ── Scroll handler — STABLE, uses refs so no new function on re-render ───
  // The key fix: using refs instead of state inside the callback so that
  // the ScrollView's onScroll prop never changes identity and never causes
  // the view to re-mount or reset its scroll offset.
  const handleScroll = useCallback((event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const distanceFromBottom =
      contentSize.height - layoutMeasurement.height - contentOffset.y;

    // Update near-bottom guard ref
    isNearBottomRef.current = distanceFromBottom <= 200;

    // Show/hide scroll-down FAB using ref to avoid re-render dependency
    const shouldShow = distanceFromBottom > 150;
    if (shouldShow !== showScrollDownRef.current) {
      showScrollDownRef.current = shouldShow;
      setShowScrollDown(shouldShow);
      Animated.timing(scrollButtonOpacity, {
        toValue: shouldShow ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [scrollButtonOpacity]); // scrollButtonOpacity is a stable ref value, effectively stable

  // ── Handle layout changes from container ─────────────────────────────────
  const handleLayout = useCallback((_e: LayoutChangeEvent) => {
    // No-op: we no longer use manual height tracking for keyboard offset
    // (previously this caused incorrect Animated padding on Android)
  }, []);

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSendMessage = useCallback(
    async (
      text: string, 
      searchType: 'chat' | 'search' | 'research' = 'chat',
      attachments?: ChatAttachment[],
      historyOverride?: Array<{ role: 'user' | 'assistant'; content: string }>
    ) => {
      const messageContent = text.trim();
      if ((!messageContent && (!attachments || attachments.length === 0)) || isThinking || isSearching) return;

      if (!currentUser?.email) {
        console.warn('[ChatScreen] Cannot send: not logged in');
        return;
      }

      // Build display content for the user bubble
      const displayContent = messageContent || '';

      const userMessage: MessageItem = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: displayContent,
        attachments: attachments,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      setMessages((prev) => [...prev, userMessage]);
      isNearBottomRef.current = true;
      // Clear pending attachments after sending
      setPendingAttachments([]);

      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      });

      // Pass the current messages as history so LLM has full context
      const history = historyOverride || messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      const result = await generateResponse(messageContent || ' ', searchType, history, attachments);

      // Once generation and DB write finish, update the local user message with the REAL DB id
      // and merge uploaded file metadata (fileId, publicUrl, etc.) while strictly preserving local preview URIs.
      if (result?.dbId || result?.processedFiles) {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== userMessage.id) return msg;

            let mergedAttachments = msg.attachments;
            if (result?.processedFiles && result.processedFiles.length > 0) {
              mergedAttachments = (msg.attachments || []).map((att, idx) => {
                const processed =
                  result.processedFiles![idx] ||
                  result.processedFiles!.find(
                    (p: any) => p.name === att.name || p.fileName === att.name
                  );
                if (!processed) return att;
                return {
                  ...att,
                  fileId: processed.fileId || att.fileId,
                  name: processed.name || processed.fileName || att.name,
                  mimeType: processed.mimeType || processed.fileType || att.mimeType,
                  size: processed.size || processed.fileSize || att.size,
                  publicUrl: processed.publicUrl || att.publicUrl,
                  viewUrl: processed.viewUrl || att.viewUrl,
                  previewUrl: processed.previewUrl || att.previewUrl,
                  // Retain local memory URI for current active session (never remote HTTP/Appwrite URLs)
                  uri: att.uri || (processed.uri && /^(?:file|content|ph|assets-library|blob):\/\//i.test(processed.uri) ? processed.uri : undefined),
                };
              });
            }

            return {
              ...msg,
              id: result?.dbId ? `${result.dbId}-user` : msg.id,
              attachments: mergedAttachments,
            };
          })
        );
      }
    },
    [isThinking, isSearching, currentUser?.email, generateResponse, messages],
  );

  const regeneratingMessageIdRef = useRef<string | null>(null);

  const handleRegenerate = useCallback(
    (id: string) => {
      const idx = messages.findIndex((m) => m.id === id);
      if (idx > 0 && messages[idx - 1]?.role === 'user') {
        const history = messages
          .slice(0, idx - 1)
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }));
        
        // DO NOT push a new user message to the UI. Just trigger response directly.
        regeneratingMessageIdRef.current = id;
        generateResponse(messages[idx - 1].content, 'chat', history);
      }
    },
    [messages, handleSendMessage],
  );

  const handleFeedback = useCallback((id: string, field: 'liked' | 'disliked', value: boolean) => {
    // Extract the raw DB id by removing the '-ai' suffix if present
    const dbId = id.replace(/-ai$/, '');
    
    // Update local state instantly
    setMessages((prev) => prev.map((msg) => {
      if (msg.id === id) {
        const updated = { ...msg, [field]: value };
        // Sync active version in versions array if present
        if (updated.versions && updated.currentVersionIndex !== undefined) {
          updated.versions[updated.currentVersionIndex][field] = value;
        }
        return updated;
      }
      return msg;
    }));

    // Update DB
    chatService.updateMessageFeedback(dbId, field, value);
  }, []);

  const handleVersionChange = useCallback((id: string, direction: 'prev' | 'next') => {
    setMessages((prev) => prev.map((msg) => {
      if (msg.id === id && msg.versions && msg.versions.length > 1) {
        const currentIndex = msg.currentVersionIndex || 0;
        const newIndex = direction === 'prev' 
          ? Math.max(0, currentIndex - 1)
          : Math.min(msg.versions.length - 1, currentIndex + 1);
        
        if (newIndex === currentIndex) return msg;

        const newActive = msg.versions[newIndex];
        return {
          ...msg,
          currentVersionIndex: newIndex,
          id: newActive.id, // we swap the ID too so it matches DB precisely
          content: newActive.content,
          searchResult: newActive.searchResult,
          modelName: newActive.modelName,
          liked: newActive.liked,
          disliked: newActive.disliked,
        };
      }
      return msg;
    }));
  }, []);

  // ── Composer behavior ─────────────────────────────────────────────────────
  const handleComposerFocus = useCallback(() => {
    if (isNearBottomRef.current) {
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, []);

  const handleStop = useCallback(() => resetGeneration(), [resetGeneration]);
  const handleOpenAttachments = useCallback(() => setIsAttachmentOpen(true), []);
  const handleOpenVoice = useCallback(() => setIsVoiceOpen(true), []);
  const handleCloseAttachments = useCallback(() => setIsAttachmentOpen(false), []);
  const handleCloseVoice = useCallback(() => setIsVoiceOpen(false), []);

  const handleAttachmentsSelected = useCallback((newAttachments: ChatAttachment[]) => {
    setPendingAttachments(prev => {
      const existingUris = new Set(prev.map(a => a.uri));
      const fresh = newAttachments.filter(a => !existingUris.has(a.uri));
      return [...prev, ...fresh].slice(0, 20);
    });
  }, []);

  const handleClearAttachment = useCallback((uri: string) => {
    setPendingAttachments(prev => prev.filter(a => a.uri !== uri));
  }, []);

  const isGenerating = isSearching || isThinking || isFileAnalyzing;

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      onLayout={handleLayout}
    >
      <KeyboardWrapper colors={colors}>
        <ConversationContent
          messages={messages}
          isLoadingHistory={isLoadingHistory}
          isSearching={isSearching}
          isThinking={isThinking}
          progressMessage={progressMessage}
          showScrollDown={showScrollDown}
          scrollButtonOpacity={scrollButtonOpacity}
          scrollViewRef={scrollViewRef}
          isNearBottomRef={isNearBottomRef}
          handleScroll={handleScroll}
          handleSendMessage={handleSendMessage}
          handleRegenerate={handleRegenerate}
          handleFeedback={handleFeedback}
          handleVersionChange={handleVersionChange}
          handleComposerFocus={handleComposerFocus}
          handleStop={handleStop}
          handleOpenAttachments={handleOpenAttachments}
          handleOpenVoice={handleOpenVoice}
          isGenerating={isGenerating}
          isFileAnalyzing={isFileAnalyzing}
          currentUser={currentUser}
          userProfile={userProfile}
          colors={colors}
          pendingAttachments={pendingAttachments}
          onClearAttachment={handleClearAttachment}
        />
      </KeyboardWrapper>

      {/* Sheets (outside keyboard wrapper to avoid layout issues) */}
      <AddMenuSheet
        visible={isAttachmentOpen}
        onClose={handleCloseAttachments}
        onAttachmentsSelected={handleAttachmentsSelected}
        onSelectCreateImage={() => {
          const imgAtt = pendingAttachments.find((a) => a.type === 'image');
          onSelectCreateImage?.(undefined, imgAtt?.uri);
        }}
      />
      <VoiceOverlay visible={isVoiceOpen} onClose={handleCloseVoice} />
    </View>
  );
};

// ── Keyboard Wrapper — Handles iOS and Android smoothly without remounts ──────
// ── Keyboard Wrapper — Handles iOS and Android smoothly without remounts ──────

const AnimatedKeyboardAvoidingView = Animated.createAnimatedComponent(KeyboardAvoidingView);

const KeyboardWrapper: React.FC<{ children: React.ReactNode; colors: any }> = ({ children, colors }) => {
  const androidKeyboardOffset = useRef(new Animated.Value(0)).current;
  const initialLayoutHeight = useRef<number>(0);
  const currentLayoutHeight = useRef<number>(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      const kh = e?.endCoordinates?.height || 0;
      // If the window successfully resized by itself, the height diff will be roughly the keyboard height.
      const heightDiff = initialLayoutHeight.current - currentLayoutHeight.current;
      
      if (heightDiff >= kh * 0.7) {
        // OS handled it, no extra padding needed
        Animated.timing(androidKeyboardOffset, {
          toValue: 0,
          duration: 250,
          useNativeDriver: false,
        }).start();
      } else {
        // OS failed to resize window, manual padding required
        Animated.timing(androidKeyboardOffset, {
          toValue: kh,
          duration: 250,
          useNativeDriver: false,
        }).start();
      }
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      Animated.timing(androidKeyboardOffset, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [androidKeyboardOffset]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (initialLayoutHeight.current === 0 || h > initialLayoutHeight.current) {
      initialLayoutHeight.current = h;
    }
    currentLayoutHeight.current = h;
  }, []);

  return (
    <AnimatedKeyboardAvoidingView
      style={[
        { flex: 1, backgroundColor: colors.background },
        Platform.OS === 'android' && { paddingBottom: androidKeyboardOffset }
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
      onLayout={Platform.OS === 'android' ? handleLayout : undefined}
    >
      {children}
    </AnimatedKeyboardAvoidingView>
  );
};

// ── Extracted inner content — keeps ChatScreen itself smaller and avoids ──────
// re-creating nested component types inside the render of ChatScreen.
interface ContentProps {
  messages: MessageItem[];
  isLoadingHistory: boolean;
  isSearching: boolean;
  isThinking: boolean;
  progressMessage: string;
  showScrollDown: boolean;
  scrollButtonOpacity: Animated.Value;
  scrollViewRef: React.RefObject<ScrollView | null>;
  isNearBottomRef: React.MutableRefObject<boolean>;
  handleScroll: (e: any) => void;
  handleSendMessage: (text: string, type: 'chat' | 'search' | 'research', attachments?: ChatAttachment[]) => void;
  handleRegenerate: (id: string) => void;
  handleFeedback: (id: string, field: 'liked' | 'disliked', value: boolean) => void;
  handleVersionChange: (id: string, direction: 'prev' | 'next') => void;
  handleComposerFocus: () => void;
  handleStop: () => void;
  handleOpenAttachments: () => void;
  handleOpenVoice: () => void;
  isGenerating: boolean;
  isFileAnalyzing: boolean;
  currentUser: any;
  userProfile: any;
  colors: any;
  pendingAttachments: ChatAttachment[];
  onClearAttachment: (uri: string) => void;
}

const ConversationContent: React.FC<ContentProps> = ({
  messages,
  isLoadingHistory,
  isSearching,
  isThinking,
  progressMessage,
  showScrollDown,
  scrollButtonOpacity,
  scrollViewRef,
  isNearBottomRef,
  handleScroll,
  handleSendMessage,
  handleRegenerate,
  handleFeedback,
  handleVersionChange,
  handleComposerFocus,
  handleStop,
  handleOpenAttachments,
  handleOpenVoice,
  isGenerating,
  isFileAnalyzing,
  currentUser,
  userProfile,
  colors,
  pendingAttachments,
  onClearAttachment,
}: {
  messages: MessageItem[];
  isLoadingHistory: boolean;
  isSearching: boolean;
  isThinking: boolean;
  progressMessage: string;
  showScrollDown: boolean;
  scrollButtonOpacity: any;
  scrollViewRef: any;
  isNearBottomRef: any;
  handleScroll: any;
  handleSendMessage: any;
  handleRegenerate: any;
  handleFeedback: any;
  handleVersionChange: any;
  handleComposerFocus: any;
  handleStop: any;
  handleOpenAttachments: any;
  handleOpenVoice: any;
  isGenerating: boolean;
  isFileAnalyzing: boolean;
  currentUser: any;
  userProfile: any;
  colors: any;
  pendingAttachments: ChatAttachment[];
  onClearAttachment: (uri: string) => void;
}) => {
  const { thinkingMode } = useModelStore();
  const isResearchMode = useResearchStore((s) => s.isResearchMode);
  const isEmptyChat = !isLoadingHistory && messages.length === 0;

  const topFadeConfig = useMemo(() => {
    return getFadeGradientConfig(colors.background, 'toTransparent');
  }, [colors.background]);

  const bottomFadeConfig = useMemo(() => {
    return getFadeGradientConfig(colors.background, 'fromTransparent');
  }, [colors.background]);

  return (
    <View style={{ flex: 1 }}>
      {/* ── Scrollable conversation area with cinema-grade edge fades ── */}
      <View style={styles.scrollWrapper}>
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.scrollContent,
            // 72px padding ensures that when scrolled to the very bottom,
            // the entire last message is cleanly above the 48px bottom fade.
            { paddingBottom: 72 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          // These prevent the ScrollView from auto-scrolling to focused inputs
          // inside its tree (which is what causes the jump on Android)
          maintainVisibleContentPosition={
            messages.length > 0 ? { minIndexForVisible: 0 } : undefined
          }
        >
          {isLoadingHistory ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.ink2 }]}>
                Loading conversation...
              </Text>
            </View>
          ) : isEmptyChat ? (
            /* New Chat greeting */
            <Pressable style={styles.newChatGreeting} onPress={Keyboard.dismiss}>
              <Image source={logoImg} style={styles.brandLogo} resizeMode="contain" />
              <Text style={[styles.greetingTitle, { color: colors.ink }]}>
                Hello, {currentUser?.displayName || userProfile?.name || 'there'}!
              </Text>
              <Text style={[styles.greetingSubtitle, { color: colors.ink2 }]}>
                What can I help you build or explore today?
              </Text>
              <View style={{ width: '100%', marginTop: spacing.md }}>
                <SuggestionCards
                  onSelectSuggestion={(prompt) => handleSendMessage(prompt, 'chat')}
                />
              </View>
            </Pressable>
          ) : (
            /* Thread */
            <View style={styles.threadContainer}>
              {messages.map((msg) => (
                <ChatBubble 
                  key={msg.id} 
                  message={msg} 
                  onRegenerate={handleRegenerate}
                  onFeedback={handleFeedback}
                  onVersionChange={handleVersionChange}
                />
              ))}
              {(isSearching || isThinking || isFileAnalyzing) && (
                <View style={styles.thinkingContainer}>
                  {((isSearching && isResearchMode) || progressMessage.toLowerCase().includes('research')) ? (
                    <ResearchProgressIndicator progressMessage={progressMessage} />
                  ) : isSearching ? (
                    // Show dedicated web search indicator during web retrieval phase
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
                      <ActivityIndicator size="small" color={colors.accent || '#3b82f6'} />
                      <Text style={[styles.thinkingText, { color: colors.ink }]}>
                        {progressMessage || 'Searching the web...'}
                      </Text>
                    </View>
                  ) : thinkingMode ? (
                    // Show Reasoning style loader if thinking mode is active
                    <ThinkingBlock 
                      content="" 
                      isFinished={false} 
                      isLoading={true} 
                      loadingTitle={
                        isFileAnalyzing 
                          ? (progressMessage || 'Analyzing files...')
                          : (progressMessage || 'Preparing reasoning...')
                      }
                    />
                  ) : (
                    // Standard loader for normal generation or file analysis
                    <>
                      <ActivityIndicator size="small" color={colors.accent} />
                      <Text style={[styles.thinkingText, { color: colors.ink2 }]}>
                        {progressMessage || (isFileAnalyzing ? 'Analyzing files...' : 'Thinking...')}
                      </Text>
                    </>
                  )}
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Top Fade Gradient: soft seamless edge as messages scroll towards the header */}
        <LinearGradient
          colors={topFadeConfig.colors}
          locations={topFadeConfig.locations}
          style={styles.topFade}
          pointerEvents="none"
        />

        {/* Bottom Fade Gradient: soft seamless edge as messages scroll towards the composer */}
        <LinearGradient
          colors={bottomFadeConfig.colors}
          locations={bottomFadeConfig.locations}
          style={styles.bottomFade}
          pointerEvents="none"
        />
      </View>

      {/* ── Scroll-down FAB ── */}
      <Animated.View
        style={[
          styles.scrollDownWrapper,
          {
            opacity: scrollButtonOpacity,
            transform: [
              {
                translateY: scrollButtonOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                }),
              },
            ],
            pointerEvents: showScrollDown ? 'box-none' : 'none',
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.scrollDownButton,
            {
              backgroundColor: '#27272a',
              borderColor: 'rgba(255, 255, 255, 0.15)',
              transform: [{ scale: pressed ? 0.92 : 1 }],
            },
          ]}
          onPress={() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
            isNearBottomRef.current = true;
          }}
        >
          <IconArrowDown size={18} color="#e4e4e7" strokeWidth={2.5} />
        </Pressable>
      </Animated.View>

      {/* ── Composer (always at bottom of the flex column) ── */}
      <Composer
        onSend={handleSendMessage}
        onStop={handleStop}
        onOpenAttachments={handleOpenAttachments}
        onOpenVoice={handleOpenVoice}
        onFocus={handleComposerFocus}
        isGenerating={isGenerating}
        pendingAttachments={pendingAttachments}
        onClearAttachment={onClearAttachment}
      />

      {/* ── Deep Research Weekly Quota Limit Sheet ── */}
      <DeepResearchLimitSheet />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  scrollWrapper: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 32,
    zIndex: 10,
  },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 48,
    zIndex: 10,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md + 4,
  },
  loadingContainer: {
    flex: 1,
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  newChatGreeting: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  brandLogo: {
    width: 140,
    height: 48,
    marginBottom: spacing.md,
  },
  greetingTitle: {
    fontSize: 24,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  greetingSubtitle: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  threadContainer: {
    width: '100%',
  },
  thinkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
    width: '100%',
  },
  fileAnalysisLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
  },
  thinkingText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
  },
  scrollDownWrapper: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  scrollDownButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
});
