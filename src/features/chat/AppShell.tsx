import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Share, Alert } from 'react-native';
import { Header, MenuAnchorPosition } from '@/components/common/Header';
import { Drawer } from '@/components/common/Drawer';
import { ConversationOptionsMenu } from '@/components/common/ConversationOptionsMenu';
import { ChatScreen } from './ChatScreen';
import { SettingsScreen } from '@/components/settings/SettingsScreen';
import { ImageGenScreen } from '@/features/image/ImageGenScreen';
import { ImagesScreen } from '@/features/image/ImagesScreen';
import { LibraryScreen } from '@/features/library/LibraryScreen';
import { useThemeColors } from '@/theme';
import { useAuth } from '@/contexts/AuthContext';
import { pinService } from '@/services/pinService';
import { chatService } from '@/services/chatService';
import { useIncognitoStore } from '@/stores/useIncognitoStore';
import { useModelStore } from '@/stores/useModelStore';

export const AppShell: React.FC = () => {
  const colors = useThemeColors();
  const { currentUser } = useAuth();

  const [activeView, setActiveView] = useState<'chat' | 'settings' | 'image-gen' | 'images' | 'library'>('chat');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeLibId, setActiveLibId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string>('');
  const [isConversation, setIsConversation] = useState<boolean>(Boolean(activeLibId));
  const [chatSessionId, setChatSessionId] = useState(() => Date.now().toString());
  const [imagePrompt, setImagePrompt] = useState<string | undefined>(undefined);
  const [imageReferenceUri, setImageReferenceUri] = useState<string | undefined>(undefined);
  // Incremented whenever a new conversation is created — triggers Drawer history refresh
  const [drawerRefreshTrigger, setDrawerRefreshTrigger] = useState(0);

  // Options Menu state
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchorPosition | null>(null);
  const [isPinned, setIsPinned] = useState(false);

  // ── Incognito Mode ────────────────────────────────────────────────────────
  const { isIncognito, toggleIncognito, exitIncognito } = useIncognitoStore();

  // =====================================================================
  // PIN STATE SYNCHRONIZATION
  // =====================================================================
  useEffect(() => {
    if (!activeLibId || !currentUser?.email) {
      setIsPinned(false);
      return;
    }
    pinService.isPinned(activeLibId, currentUser.email).then((pinned) => {
      setIsPinned(pinned);
    });
  }, [activeLibId, currentUser?.email]);

  useEffect(() => {
    const unsubscribe = pinService.addListener((pinnedIds) => {
      if (activeLibId) {
        setIsPinned(pinnedIds.includes(activeLibId));
      }
    });
    return unsubscribe;
  }, [activeLibId]);

  // =====================================================================
  // STRICT USER ISOLATION AT SHELL LEVEL
  // =====================================================================
  const lastUserEmailRef = useRef<string | undefined>(currentUser?.email);
  useEffect(() => {
    const prevEmail = lastUserEmailRef.current;
    const nextEmail = currentUser?.email;
    if (prevEmail === nextEmail) return; // No change

    lastUserEmailRef.current = nextEmail;
    console.log('[AppShell] User account changed:', prevEmail, '->', nextEmail ?? 'LOGGED OUT');

    // 1. Close drawer and options menu immediately to prevent cross-user flash
    setIsDrawerOpen(false);
    setIsOptionsMenuOpen(false);
    // 2. Reset active chat session
    setActiveLibId(null);
    setActiveTitle('');
    setIsConversation(false);
    setImagePrompt(undefined);
    setImageReferenceUri(undefined);
    setChatSessionId(Date.now().toString());
    // 3. Reset refresh counter for new user session
    setDrawerRefreshTrigger(0);
    // 4. Always exit incognito when account changes — never carry private sessions across accounts
    exitIncognito();
  }, [currentUser?.email, exitIncognito]);

  // ── All callbacks are stable ───────────────────────────────────────────────

  const handleNewChat = useCallback(() => {
    useModelStore.getState().setWebSearchEnabled(false);
    setActiveLibId(null);
    setActiveTitle('');
    setIsConversation(false);
    setImagePrompt(undefined);
    setImageReferenceUri(undefined);
    setChatSessionId(isIncognito ? `incognito-${Date.now()}` : Date.now().toString());
    setActiveView('chat');
  }, [isIncognito]);

  const handleSelectCreateImage = useCallback((prompt?: string, referenceImageUri?: string) => {
    exitIncognito();
    useModelStore.getState().setWebSearchEnabled(false);
    setActiveLibId(null);
    setActiveTitle('');
    setIsConversation(false);
    setImagePrompt(prompt);
    setImageReferenceUri(referenceImageUri);
    setChatSessionId(`img-${Date.now()}`);
    setActiveView('image-gen');
  }, [exitIncognito]);

  const handleSelectNewImageGeneration = useCallback(() => {
    handleSelectCreateImage();
  }, [handleSelectCreateImage]);

  const handleSelectChatHistory = useCallback((libId: string, title?: string, type?: string) => {
    exitIncognito();
    useModelStore.getState().setWebSearchEnabled(false);
    setActiveLibId(libId);
    setActiveTitle(title || '');
    setIsConversation(true);
    setChatSessionId(libId);
    setImagePrompt(undefined);
    setImageReferenceUri(undefined);
    if (type === 'image-generation') {
      setActiveView('image-gen');
    } else {
      setActiveView('chat');
    }
  }, [exitIncognito]);

  const handleConversationCreated = useCallback((libId: string, title?: string) => {
    // Never register an incognito session in the drawer
    if (isIncognito) return;
    setActiveLibId(libId);
    if (title) {
      setActiveTitle(title);
    }
    setIsConversation(true);
    // Notify Drawer to refresh its history list (new conversation just saved to Appwrite)
    setDrawerRefreshTrigger((prev) => prev + 1);
  }, [isIncognito]);

  const handleConversationActiveChange = useCallback((isActive: boolean) => {
    setIsConversation(isActive);
  }, []);

  const handleIncognitoChat = useCallback(() => {
    // Toggle incognito mode and always start a fresh chat session
    toggleIncognito();
    useModelStore.getState().setWebSearchEnabled(false);
    setActiveLibId(null);
    setActiveTitle('');
    setIsConversation(false);
    setImagePrompt(undefined);
    setImageReferenceUri(undefined);
    setChatSessionId(`incognito-${Date.now()}`);
    setActiveView('chat');
    console.log('[AppShell] Incognito toggled');
  }, [toggleIncognito]);

  const handleOpenDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const handleCloseDrawer = useCallback(() => setIsDrawerOpen(false), []);
  const handleOpenSettings = useCallback(() => setActiveView('settings'), []);
  const handleOpenImages = useCallback(() => setActiveView('images'), []);
  const handleOpenLibrary = useCallback(() => setActiveView('library'), []);
  const handleBackToChat = useCallback(() => setActiveView('chat'), []);

  // ── Three-Dot Menu Actions ─────────────────────────────────────────────────

  const handleShareConversation = useCallback(async () => {
    if (!activeLibId) return;
    const shareUrl = activeView === 'image-gen'
      ? `https://chatboxai.co.in/image-gen/${activeLibId}`
      : `https://chatboxai.co.in/search/${activeLibId}`;
    const shareTitle = activeTitle || (activeView === 'image-gen' ? 'Image Generation' : 'Conversation');
    try {
      await Share.share({
        title: shareTitle,
        message: `Check out this ${activeView === 'image-gen' ? 'image' : 'conversation'} on ChatBox AI:\n${shareUrl}`,
        url: shareUrl,
      });
    } catch (error) {
      console.warn('[AppShell] Share error:', error);
    }
  }, [activeLibId, activeTitle, activeView]);

  const handleTogglePin = useCallback(async () => {
    if (!activeLibId || !currentUser?.email) return;
    try {
      const nextPinned = await pinService.togglePin(activeLibId, currentUser.email);
      setIsPinned(nextPinned);
    } catch (error) {
      console.warn('[AppShell] Toggle pin error:', error);
    }
  }, [activeLibId, currentUser?.email]);

  const handleGoToHome = useCallback(() => {
    handleNewChat();
  }, [handleNewChat]);

  const handleDeleteConversation = useCallback(() => {
    if (!activeLibId || !currentUser?.email) return;

    Alert.alert(
      'Delete conversation?',
      'Are you sure you want to delete this conversation? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const targetLibId = activeLibId;
            const targetEmail = currentUser.email!;
            try {
              // 1. Clean up local pinned state
              await pinService.unpin(targetLibId, targetEmail);
              // 2. Delete conversation records from backend/database
              await chatService.deleteConversation(targetLibId, targetEmail);
              // 3. Trigger Drawer history refresh
              setDrawerRefreshTrigger((prev) => prev + 1);
              // 4. Return user cleanly to Home / New Chat
              handleNewChat();
            } catch (error) {
              console.error('[AppShell] Delete conversation error:', error);
              Alert.alert('Error', 'Failed to delete conversation. Please try again.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, [activeLibId, currentUser?.email, handleNewChat]);

  const handleOpenOptionsMenu = useCallback((anchor?: MenuAnchorPosition) => {
    setMenuAnchor(anchor || null);
    setIsOptionsMenuOpen(true);
  }, []);

  // key derived from user email — React fully unmounts Drawer when user changes,
  // ensuring zero stale state (conversations, rename/delete modals, etc.) leaks between accounts.
  const drawerKey = currentUser?.email ?? 'no-user';

  return (
    <View style={[styles.shell, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      {activeView !== 'settings' && activeView !== 'images' && activeView !== 'library' && (
        <Header
          onOpenDrawer={handleOpenDrawer}
          onNewChat={handleNewChat}
          onOpenOptionsMenu={handleOpenOptionsMenu}
          onIncognitoChat={handleIncognitoChat}
          isConversation={isConversation}
          isIncognito={isIncognito}
        />
      )}

      {/* Main Active View */}
      {activeView === 'chat' ? (
        <ChatScreen
          key={chatSessionId}
          activeLibId={activeLibId}
          onConversationCreated={handleConversationCreated}
          onConversationActiveChange={handleConversationActiveChange}
          onConversationTitleChange={setActiveTitle}
          onSelectCreateImage={handleSelectCreateImage}
          isIncognito={isIncognito}
        />
      ) : activeView === 'image-gen' ? (
        <ImageGenScreen
          key={chatSessionId}
          initialLibId={activeLibId}
          initialPrompt={imagePrompt}
          initialReferenceImageUri={imageReferenceUri}
          onConversationCreated={handleConversationCreated}
          onConversationActiveChange={handleConversationActiveChange}
          onConversationTitleChange={setActiveTitle}
        />
      ) : activeView === 'images' ? (
        <ImagesScreen onBack={handleBackToChat} />
      ) : activeView === 'library' ? (
        <LibraryScreen 
          onBack={handleBackToChat} 
          onSelectConversation={handleSelectChatHistory}
          refreshTrigger={drawerRefreshTrigger}
        />
      ) : (
        <SettingsScreen onBack={handleBackToChat} />
      )}

      {/* Slide-over Navigation Drawer */}
      <Drawer
        key={drawerKey}
        visible={isDrawerOpen}
        onClose={handleCloseDrawer}
        onSelectNewChat={handleNewChat}
        onSelectChatHistory={handleSelectChatHistory}
        onSelectNewImageGeneration={handleSelectNewImageGeneration}
        onOpenSettings={handleOpenSettings}
        onOpenImages={handleOpenImages}
        onOpenLibrary={handleOpenLibrary}
        refreshTrigger={drawerRefreshTrigger}
      />

      {/* Three-Dot Options Menu Popup */}
      <ConversationOptionsMenu
        visible={isOptionsMenuOpen}
        onClose={() => setIsOptionsMenuOpen(false)}
        title={activeTitle}
        isPinned={isPinned}
        anchorPosition={menuAnchor}
        onShare={handleShareConversation}
        onTogglePin={handleTogglePin}
        onGoToHome={handleGoToHome}
        onDelete={handleDeleteConversation}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    width: '100%',
  },
});
