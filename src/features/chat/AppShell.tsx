import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Header } from '@/components/common/Header';
import { Drawer } from '@/components/common/Drawer';
import { ChatScreen } from './ChatScreen';
import { SettingsScreen } from '@/components/settings/SettingsScreen';
import { ModelOption } from '@/components/chat/ModelSelectorSheet';
import { useThemeColors } from '@/theme';
import { useAuth } from '@/contexts/AuthContext';

export const AppShell: React.FC = () => {
  const colors = useThemeColors();
  const { currentUser } = useAuth();

  const [activeView, setActiveView] = useState<'chat' | 'settings'>('chat');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeLibId, setActiveLibId] = useState<string | null>(null);
  const [chatSessionId, setChatSessionId] = useState(() => Date.now().toString());
  // Incremented whenever a new conversation is created — triggers Drawer history refresh
  const [drawerRefreshTrigger, setDrawerRefreshTrigger] = useState(0);

  // =====================================================================
  // STRICT USER ISOLATION AT SHELL LEVEL
  // When the user account changes (logout OR account switch), we:
  //   1. Close the drawer immediately (prevents showing stale data mid-animation)
  //   2. Reset all active session state (activeLibId, chatSessionId)
  //   3. key=drawerKey on <Drawer> forces React to fully unmount+remount it,
  //      killing all stale conversations[] / rename / delete state.
  // =====================================================================
  const lastUserEmailRef = useRef<string | undefined>(currentUser?.email);
  useEffect(() => {
    const prevEmail = lastUserEmailRef.current;
    const nextEmail = currentUser?.email;
    if (prevEmail === nextEmail) return; // No change

    lastUserEmailRef.current = nextEmail;
    console.log('[AppShell] User account changed:', prevEmail, '->', nextEmail ?? 'LOGGED OUT');

    // 1. Close drawer immediately to prevent cross-user flash
    setIsDrawerOpen(false);
    // 2. Reset active chat session
    setActiveLibId(null);
    setChatSessionId(Date.now().toString());
    // 3. Reset refresh counter for new user session
    setDrawerRefreshTrigger(0);
  }, [currentUser?.email]);

  // ── All callbacks are stable (useCallback with no deps or only setter deps) ──
  // This prevents them from being new functions on every AppShell render,
  // which would otherwise propagate down and force child re-mounts.

  const handleNewChat = React.useCallback(() => {
    setActiveLibId(null);
    setChatSessionId(Date.now().toString());
    setActiveView('chat');
  }, []);

  const handleSelectChatHistory = React.useCallback((libId: string) => {
    setActiveLibId(libId);
    setChatSessionId(libId);
    setActiveView('chat');
  }, []);

  const handleConversationCreated = React.useCallback((libId: string) => {
    setActiveLibId(libId);
    // Notify Drawer to refresh its history list (new conversation just saved to Appwrite)
    setDrawerRefreshTrigger((prev) => prev + 1);
  }, []);

  const handleOpenDrawer = React.useCallback(() => setIsDrawerOpen(true), []);
  const handleCloseDrawer = React.useCallback(() => setIsDrawerOpen(false), []);
  const handleOpenSettings = React.useCallback(() => setActiveView('settings'), []);
  const handleBackFromSettings = React.useCallback(() => setActiveView('chat'), []);

  // key derived from user email — React fully unmounts Drawer when user changes,
  // ensuring zero stale state (conversations, rename/delete modals, etc.) leaks between accounts.
  const drawerKey = currentUser?.email ?? 'no-user';

  return (
    <View style={[styles.shell, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      {activeView === 'chat' && (
        <Header
          onOpenDrawer={handleOpenDrawer}
          onNewChat={handleNewChat}
        />
      )}

      {/* Main Active View */}
      {activeView === 'chat' ? (
        <ChatScreen
          key={chatSessionId}
          activeLibId={activeLibId}
          onConversationCreated={handleConversationCreated}
        />
      ) : (
        <SettingsScreen onBack={handleBackFromSettings} />
      )}

      {/* Slide-over Navigation Drawer.
          key=drawerKey forces full React remount on user change — eliminates all cross-user data leaks. */}
      <Drawer
        key={drawerKey}
        visible={isDrawerOpen}
        onClose={handleCloseDrawer}
        onSelectNewChat={handleNewChat}
        onSelectChatHistory={handleSelectChatHistory}
        onOpenSettings={handleOpenSettings}
        refreshTrigger={drawerRefreshTrigger}
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
