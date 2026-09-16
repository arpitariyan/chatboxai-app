import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Keyboard,
  Pressable,
  LayoutChangeEvent,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { ChatBubble, MessageItem } from '@/components/chat/ChatBubble';
import { Composer } from '@/components/chat/Composer';
import { SuggestionCards } from '@/components/chat/SuggestionCards';
import { ModelSelectorSheet, ModelOption } from '@/components/chat/ModelSelectorSheet';
import { AttachmentSheet } from '@/components/chat/AttachmentSheet';
import { VoiceOverlay } from '@/components/chat/VoiceOverlay';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColors, spacing, radius, typography } from '@/theme';
import { chatService, generateUUID } from '@/services/chatService';

const logoImg = require('../../../assets/images/logo.png');

interface ChatScreenProps {
  activeLibId?: string | null;
  currentModel: string;
  onSelectModel: (model: ModelOption) => void;
  onConversationCreated?: (libId: string) => void;
  isModelSelectorOpen: boolean;
  onCloseModelSelector: () => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  activeLibId,
  currentModel,
  onSelectModel,
  onConversationCreated,
  isModelSelectorOpen,
  onCloseModelSelector,
}) => {
  const colors = useThemeColors();
  const { currentUser, userProfile } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);

  const [currentLibIdState, setCurrentLibIdState] = useState<string | null>(activeLibId || null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [androidKeyboardOffset, setAndroidKeyboardOffset] = useState(0);

  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);

  const initialLayoutHeight = useRef(Dimensions.get('window').height);
  const currentLayoutHeight = useRef(Dimensions.get('window').height);

  // Reset state when user account changes
  useEffect(() => {
    setMessages([]);
    setCurrentLibIdState(null);
  }, [currentUser?.email]);

  // Sync activeLibId from parent
  useEffect(() => {
    setCurrentLibIdState(activeLibId || null);
  }, [activeLibId]);

  // Load existing conversation messages from 'chats' collection when activeLibId is set
  // strictly verified against currentUser.email
  useEffect(() => {
    if (!activeLibId || !currentUser?.email) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    setIsLoadingHistory(true);

    chatService
      .fetchConversationChats(activeLibId, currentUser.email)
      .then((records) => {
        if (!isMounted) return;

        const loadedMessages: MessageItem[] = [];
        for (const rec of records) {
          const formattedTime = rec.createdAt
            ? new Date(rec.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';

          // Add user bubble
          if (rec.userSearchInput) {
            loadedMessages.push({
              id: `${rec.id}-user`,
              role: 'user',
              content: rec.userSearchInput,
              timestamp: formattedTime,
            });
          }

          // Add assistant bubble
          if (rec.aiResp) {
            loadedMessages.push({
              id: `${rec.id}-ai`,
              role: 'assistant',
              content: rec.aiResp,
              timestamp: formattedTime,
            });
          }
        }

        setMessages(loadedMessages);
        setIsLoadingHistory(false);

        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: false });
        }, 150);
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
  }, [activeLibId, currentUser?.email]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const layoutHeight = e.nativeEvent.layout.height;
    currentLayoutHeight.current = layoutHeight;
  };

  // Auto-adapt keyboard on Android & iOS
  useEffect(() => {
    const handleKeyboardShow = (e: any) => {
      const kh = e?.endCoordinates?.height || 0;
      setIsKeyboardVisible(true);

      if (Platform.OS === 'android') {
        const heightDiff = initialLayoutHeight.current - currentLayoutHeight.current;
        if (heightDiff >= kh * 0.7) {
          setAndroidKeyboardOffset(0);
        } else {
          setAndroidKeyboardOffset(kh);
        }
      }

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 50);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 180);
    };

    const handleKeyboardHide = () => {
      setIsKeyboardVisible(false);
      if (Platform.OS === 'android') {
        setAndroidKeyboardOffset(0);
      }
    };

    const willShowSub = Keyboard.addListener('keyboardWillShow', handleKeyboardShow);
    const didShowSub = Keyboard.addListener('keyboardDidShow', handleKeyboardShow);
    const willHideSub = Keyboard.addListener('keyboardWillHide', handleKeyboardHide);
    const didHideSub = Keyboard.addListener('keyboardDidHide', handleKeyboardHide);

    return () => {
      willShowSub.remove();
      didShowSub.remove();
      willHideSub.remove();
      didHideSub.remove();
    };
  }, []);

  // Send User Message & Persist to Appwrite (library on first turn, chats on all turns)
  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend || inputText).trim();
    if (!messageContent || isGenerating) return;

    if (!currentUser?.email) {
      console.warn('[ChatScreen] Cannot send message: User not logged in');
      return;
    }

    const userEmail = currentUser.email.trim().toLowerCase();
    const userTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMessage: MessageItem = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      timestamp: userTimestamp,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsGenerating(true);

    // Auto-scroll to bottom
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    // Generate response
    const assistantTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const responseText = `Here is a response powered by ${currentModel}:\n\n"${messageContent}"\n\nChatBox AI provides fast, intelligent assistance with code, writing, research, and analysis. Let me know if you need any further clarification or follow-up!`;

    setTimeout(async () => {
      const assistantMessage: MessageItem = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        timestamp: assistantTimestamp,
        isStreaming: false,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsGenerating(false);

      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

      // ── Persist strictly for this authenticated user ──
      try {
        let targetLibId = currentLibIdState;

        // If this is a new conversation session:
        if (!targetLibId) {
          targetLibId = generateUUID();
          setCurrentLibIdState(targetLibId);

          // 1. Create parent conversation record in 'library' for this user
          await chatService.createConversation({
            libId: targetLibId,
            userEmail,
            searchInput: messageContent,
            type: 'search',
            selectedModel: currentModel,
            modelName: currentModel,
          });

          // Notify AppShell
          onConversationCreated?.(targetLibId);
        }

        // 2. Add message turn to 'chats' collection
        await chatService.addChatMessage({
          libId: targetLibId,
          userEmail,
          userSearchInput: messageContent,
          aiResp: responseText,
          analysisType: 'text_only',
          usedModel: currentModel,
        });
      } catch (saveError) {
        console.warn('[ChatScreen] Error persisting chat turn:', saveError);
      }
    }, 1200);
  };

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingBottom: Platform.OS === 'android' ? androidKeyboardOffset : 0,
        },
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      onLayout={handleLayout}
    >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {isLoadingHistory ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.ink2 }]}>
              Loading conversation...
            </Text>
          </View>
        ) : messages.length === 0 ? (
          /* Empty Chat / New Chat Home Greeting Screen */
          <Pressable
            style={styles.newChatGreeting}
            onPress={Keyboard.dismiss}
          >
            <Image source={logoImg} style={styles.brandLogo} resizeMode="contain" />
            <Text style={[styles.greetingTitle, { color: colors.ink }]}>
              Hello, {currentUser?.displayName || userProfile?.name || 'there'}!
            </Text>
            <Text style={[styles.greetingSubtitle, { color: colors.ink2 }]}>
              What can I help you build or explore today?
            </Text>

            {/* Suggestion Prompt Pills */}
            <View style={{ width: '100%', marginTop: spacing.md }}>
              <SuggestionCards onSelectSuggestion={(prompt) => handleSendMessage(prompt)} />
            </View>
          </Pressable>
        ) : (
          /* Conversation Thread List */
          <View style={styles.threadContainer}>
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Floating 48px Tactile Composer Dock */}
      <Composer
        value={inputText}
        onChangeText={setInputText}
        onFocus={() => {
          setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 150);
        }}
        onSend={() => handleSendMessage()}
        onStop={() => setIsGenerating(false)}
        onOpenAttachments={() => setIsAttachmentOpen(true)}
        onOpenVoice={() => setIsVoiceOpen(true)}
        isGenerating={isGenerating}
        isKeyboardVisible={isKeyboardVisible}
      />

      {/* Model Selector Sheet */}
      <ModelSelectorSheet
        visible={isModelSelectorOpen}
        onClose={onCloseModelSelector}
        selectedModelId="chatbox-4o"
        onSelectModel={onSelectModel}
      />

      {/* Attachment Options Sheet */}
      <AttachmentSheet
        visible={isAttachmentOpen}
        onClose={() => setIsAttachmentOpen(false)}
        onSelectOption={(type) => {
          console.log('Selected attachment type:', type);
        }}
      />

      {/* Voice Mode Overlay */}
      <VoiceOverlay
        visible={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
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
});
