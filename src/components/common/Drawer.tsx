import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  ScrollView,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  Easing,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconPhoto,
  IconBooks,
  IconClock,
  IconPuzzle,
  IconEdit,
  IconPlus,
  IconMessage2,
  IconSettings,
  IconDotsVertical,
  IconPencil,
  IconTrash,
  IconPin,
  IconPinned,
} from '@tabler/icons-react-native';
import { UserProfileSheet } from './UserProfileSheet';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColors, spacing, radius, typography } from '@/theme';
import { chatService, ConversationItem, cleanConversationTitle } from '@/services/chatService';
import { pinService } from '@/services/pinService';

const logoImg = require('../../../assets/images/logo.png');
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(320, SCREEN_WIDTH * 0.82);

interface DrawerProps {
  visible: boolean;
  onClose: () => void;
  onSelectNewChat: () => void;
  onSelectChatHistory: (libId: string, title?: string, type?: string) => void;
  onSelectNewImageGeneration?: () => void;
  onOpenSettings: () => void;
  /** Increment to force a history refresh */
  refreshTrigger?: number;
}

export const Drawer: React.FC<DrawerProps> = ({
  visible,
  onClose,
  onSelectNewChat,
  onSelectChatHistory,
  onSelectNewImageGeneration,
  onOpenSettings,
  refreshTrigger = 0,
}) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { currentUser, userProfile } = useAuth();

  const [isProfileSheetOpen, setIsProfileSheetOpen] = useState(false);
  const [rendered, setRendered] = useState(visible);

  // Live conversations from Appwrite library collection
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Context Menu / Action modal states
  const [actionTarget, setActionTarget] = useState<ConversationItem | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);

  // Rename modal states
  const [renameTarget, setRenameTarget] = useState<ConversationItem | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Delete modal states
  const [deleteTarget, setDeleteTarget] = useState<ConversationItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  // Load pinned conversation IDs for the user
  const loadPins = useCallback(async (explicitEmail?: string) => {
    const targetEmail = (explicitEmail || currentUser?.email || '').trim().toLowerCase();
    if (!targetEmail) {
      setPinnedIds([]);
      return;
    }
    const ids = await pinService.getPinnedIds(targetEmail);
    setPinnedIds(ids);
  }, [currentUser?.email]);

  // Load conversations for the authenticated user
  const loadConversations = useCallback(async (explicitEmail?: string) => {
    const targetEmail = (explicitEmail || currentUser?.email || '').trim().toLowerCase();
    if (!targetEmail) {
      setConversations([]);
      return;
    }

    setLoadingHistory(true);
    try {
      const items = await chatService.fetchUserConversations(targetEmail);
      setConversations(items);
    } catch (err) {
      console.warn('[Drawer] Failed to load conversations:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [currentUser?.email]);

  // Strict user isolation: fetch conversations and pins on user change or clear on logout
  useEffect(() => {
    if (!currentUser?.email) {
      setConversations([]);
      setPinnedIds([]);
      return;
    }
    loadConversations(currentUser.email);
    loadPins(currentUser.email);
  }, [currentUser?.email, loadConversations, loadPins]);

  // Real-time listener for pin updates across app
  useEffect(() => {
    const unsubscribe = pinService.addListener((updatedIds) => {
      setPinnedIds(updatedIds);
    });
    return unsubscribe;
  }, []);

  // Handle smooth open and close animations & refresh history on open
  useEffect(() => {
    if (visible) {
      setRendered(true);
      if (currentUser?.email) {
        loadConversations(currentUser.email);
        loadPins(currentUser.email);
      }
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    } else if (rendered) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setRendered(false);
      });
    }
  }, [visible, currentUser?.email, loadConversations]);

  // Refresh trigger when a new conversation is created
  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    if (refreshTrigger > 0 && currentUser?.email) {
      loadConversations();
    }
  }, [refreshTrigger, currentUser?.email, loadConversations]);

  const handleClose = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setRendered(false);
      onClose();
      if (callback) callback();
    });
  };

  const handleOpenActionMenu = (item: ConversationItem) => {
    setActionTarget(item);
    setIsActionModalOpen(true);
  };

  const handleStartRename = () => {
    if (!actionTarget) return;
    const item = actionTarget;
    setIsActionModalOpen(false);
    setRenameTarget(item);
    setRenameTitle(item.rawTitle || item.title);
  };

  const handleConfirmRename = async () => {
    if (!renameTarget || !renameTitle.trim() || !currentUser?.email) return;

    const trimmed = renameTitle.trim();
    const targetLibId = renameTarget.libId;
    setIsRenaming(true);

    // Optimistic update
    setConversations((prev) =>
      prev.map((c) =>
        c.libId === targetLibId
          ? { ...c, title: cleanConversationTitle(trimmed), rawTitle: trimmed }
          : c
      )
    );

    try {
      await chatService.renameConversation(targetLibId, currentUser.email, trimmed);
    } catch (err) {
      console.error('[Drawer] Rename error:', err);
      loadConversations();
    } finally {
      setIsRenaming(false);
      setRenameTarget(null);
      setRenameTitle('');
    }
  };

  const handleStartDelete = () => {
    if (!actionTarget) return;
    const item = actionTarget;
    setIsActionModalOpen(false);
    setDeleteTarget(item);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !currentUser?.email) return;
    const targetLibId = deleteTarget.libId;
    setIsDeleting(true);

    // Optimistic delete
    setConversations((prev) => prev.filter((c) => c.libId !== targetLibId));

    try {
      await chatService.deleteConversation(targetLibId, currentUser.email);
      await pinService.unpin(targetLibId, currentUser.email);
    } catch (err) {
      console.error('[Drawer] Delete error:', err);
      loadConversations();
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleTogglePin = async () => {
    if (!actionTarget || !currentUser?.email) return;
    const targetLibId = actionTarget.libId;
    setIsActionModalOpen(false);
    await pinService.togglePin(targetLibId, currentUser.email);
  };

  // Feature items matching initial Drawer design
  const featureItems = [
    { id: 'images', icon: IconPhoto, title: 'Images' },
    { id: 'library', icon: IconBooks, title: 'Library' },
    { id: 'scheduled', icon: IconClock, title: 'Scheduled' },
    { id: 'plugins', icon: IconPuzzle, title: 'Plugins' },
  ];

  const displayName = currentUser?.displayName || userProfile?.name || 'Ariyan';
  const initials = (displayName || currentUser?.email || 'A')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Partition conversations into pinned and recent
  const pinnedConversations = conversations.filter((c) => pinnedIds.includes(c.libId));
  const recentConversations = conversations.filter((c) => !pinnedIds.includes(c.libId));

  if (!visible && !rendered) return null;

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      onRequestClose={() => handleClose()}
    >
      <View style={styles.modalRoot}>
        {/* Animated Fading Backdrop */}
        <TouchableWithoutFeedback onPress={() => handleClose()}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: backdropAnim,
              },
            ]}
          />
        </TouchableWithoutFeedback>

        {/* Animated Sliding Drawer Container */}
        <Animated.View
          style={[
            styles.drawerContainer,
            {
              width: DRAWER_WIDTH,
              backgroundColor: colors.background,
              borderColor: colors.line,
              paddingTop: Math.max(insets.top, 14),
              paddingBottom: Math.max(insets.bottom, 12),
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          {/* Top Header Row: Brand Logo */}
          <View style={styles.headerRow}>
            <Image
              source={logoImg}
              style={styles.brandLogo}
              resizeMode="contain"
            />
          </View>

          {/* New Chat Quick Action Card */}
          <Pressable
            onPress={() => handleClose(onSelectNewChat)}
            style={({ pressed }) => [
              styles.newChatCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.line,
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.985 : 1 }],
              },
            ]}
          >
            <View style={styles.newChatLeft}>
              <View style={[styles.newChatIconCircle, { backgroundColor: colors.background, borderColor: colors.line }]}>
                <IconEdit size={16} color={colors.ink} />
              </View>
              <Text style={[styles.newChatTitle, { color: colors.ink }]}>
                New Chat
              </Text>
            </View>
            <IconPlus size={16} color={colors.ink3} />
          </Pressable>

          {/* Scrollable Feature Menu & Recents List */}
          <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
            {/* EXPLORE Section */}
            <Text style={[styles.sectionHeading, { color: colors.ink3 }]}>
              EXPLORE
            </Text>
            <View style={styles.featureGroup}>
              {featureItems.map((item) => {
                const IconComp = item.icon;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      if (item.id === 'images') {
                        handleClose(onSelectNewImageGeneration);
                      } else {
                        handleClose();
                      }
                    }}
                    style={({ pressed }) => [
                      styles.featureRow,
                      {
                        backgroundColor: pressed ? colors.surface : 'transparent',
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <IconComp size={19} color={colors.ink} style={{ marginRight: spacing.sm + 4 }} />
                    <Text style={[styles.featureTitle, { color: colors.ink }]}>
                      {item.title}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* PINNED Section (shown only when pinned items exist) */}
            {pinnedConversations.length > 0 && (
              <>
                <View style={styles.recentsHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <IconPin size={13} color={colors.accent || colors.ink2} />
                    <Text style={[styles.sectionHeading, { color: colors.ink3 }]}>
                      PINNED
                    </Text>
                  </View>
                </View>

                <View style={styles.recentsGroup}>
                  {pinnedConversations.map((chat: ConversationItem) => (
                    <View key={`pinned-${chat.libId}`} style={styles.recentRowContainer}>
                      <Pressable
                        onPress={() => handleClose(() => onSelectChatHistory(chat.libId, chat.title, chat.type))}
                        style={({ pressed }) => [
                          styles.recentMainButton,
                          {
                            backgroundColor: pressed ? colors.surface : 'transparent',
                            opacity: pressed ? 0.75 : 1,
                          },
                        ]}
                      >
                        {chat.type === 'image-generation' ? (
                          <IconPhoto
                            size={16}
                            color={colors.accent || colors.ink2}
                            style={{ marginRight: spacing.sm + 2 }}
                          />
                        ) : (
                          <IconPin
                            size={16}
                            color={colors.accent || colors.ink2}
                            style={{ marginRight: spacing.sm + 2 }}
                          />
                        )}
                        <Text
                          style={[styles.recentTitle, { color: colors.ink, fontWeight: '500' }]}
                          numberOfLines={1}
                        >
                          {chat.title}
                        </Text>
                      </Pressable>

                      {/* 3-Dots Action Button */}
                      <Pressable
                        onPress={() => handleOpenActionMenu(chat)}
                        hitSlop={8}
                        style={({ pressed }) => [
                          styles.recentActionBtn,
                          {
                            opacity: pressed ? 0.6 : 1,
                            backgroundColor: pressed ? colors.surface : 'transparent',
                          },
                        ]}
                      >
                        <IconDotsVertical size={16} color={colors.ink3} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* RECENTS Section */}
            <View style={styles.recentsHeaderRow}>
              <Text style={[styles.sectionHeading, { color: colors.ink3 }]}>
                RECENTS
              </Text>
              {loadingHistory && (
                <ActivityIndicator size="small" color={colors.accent} style={{ transform: [{ scale: 0.7 }] }} />
              )}
            </View>

            <View style={styles.recentsGroup}>
              {recentConversations.length === 0 && !loadingHistory && pinnedConversations.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: colors.ink3 }]}>
                    No conversations yet
                  </Text>
                </View>
              ) : (
                recentConversations.map((chat: ConversationItem) => (
                  <View key={chat.libId} style={styles.recentRowContainer}>
                    <Pressable
                      onPress={() => handleClose(() => onSelectChatHistory(chat.libId, chat.title, chat.type))}
                      style={({ pressed }) => [
                        styles.recentMainButton,
                        {
                          backgroundColor: pressed ? colors.surface : 'transparent',
                          opacity: pressed ? 0.75 : 1,
                        },
                      ]}
                    >
                      {chat.type === 'image-generation' ? (
                        <IconPhoto
                          size={17}
                          color={colors.ink3}
                          style={{ marginRight: spacing.sm + 2 }}
                        />
                      ) : (
                        <IconMessage2
                          size={17}
                          color={colors.ink3}
                          style={{ marginRight: spacing.sm + 2 }}
                        />
                      )}
                      <Text
                        style={[styles.recentTitle, { color: colors.ink }]}
                        numberOfLines={1}
                      >
                        {chat.title}
                      </Text>
                    </Pressable>

                    {/* 3-Dots Action Button */}
                    <Pressable
                      onPress={() => handleOpenActionMenu(chat)}
                      hitSlop={8}
                      style={({ pressed }) => [
                        styles.recentActionBtn,
                        {
                          opacity: pressed ? 0.6 : 1,
                          backgroundColor: pressed ? colors.surface : 'transparent',
                        },
                      ]}
                    >
                      <IconDotsVertical size={16} color={colors.ink3} />
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          </ScrollView>

          {/* Bottom Drawer Toolbar & Profile Card */}
          <View style={[styles.bottomToolbar, { borderTopColor: colors.line }]}>
            {/* User Profile Card Button */}
            <Pressable
              onPress={() => setIsProfileSheetOpen(true)}
              style={({ pressed }) => [
                styles.profileCard,
                {
                  backgroundColor: pressed ? colors.surface : 'transparent',
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.avatarCircle,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.line,
                  },
                ]}
              >
                <Text style={[styles.avatarText, { color: colors.ink }]}>
                  {initials}
                </Text>
              </View>

              <View style={styles.profileTextGroup}>
                <Text
                  style={[styles.userNameText, { color: colors.ink }]}
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
                <View style={styles.planBadgeRow}>
                  <View style={[styles.planBadge, { backgroundColor: '#1c1c1e', borderColor: colors.line }]}>
                    <Text style={styles.planBadgeText}>
                      {(userProfile?.plan || 'FREE').toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>

            {/* Quick Settings Icon Button */}
            <Pressable
              onPress={() => {
                handleClose(onOpenSettings);
              }}
              hitSlop={8}
              accessibilityLabel="Open settings"
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.settingsBtn,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.line,
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                },
              ]}
            >
              <IconSettings size={18} color={colors.ink} />
            </Pressable>
          </View>

          {/* User Profile & Logout Sheet */}
          <UserProfileSheet
            visible={isProfileSheetOpen}
            onClose={() => setIsProfileSheetOpen(false)}
            onOpenSettings={() => {
              handleClose(onOpenSettings);
            }}
          />
        </Animated.View>

        {/* ── CONTEXT ACTIONS MODAL (Rename / Delete) ── */}
        <Modal
          visible={isActionModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsActionModalOpen(false)}
        >
          <Pressable
            style={styles.dialogBackdrop}
            onPress={() => setIsActionModalOpen(false)}
          >
            <View
              style={[
                styles.actionMenuCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.line,
                },
              ]}
            >
              <Text style={[styles.actionMenuHeader, { color: colors.ink3 }]} numberOfLines={1}>
                {actionTarget?.title || 'Chat Options'}
              </Text>

              {/* Pin / Unpin Item */}
              <Pressable
                onPress={handleTogglePin}
                style={({ pressed }) => [
                  styles.actionMenuItem,
                  { backgroundColor: pressed ? colors.hover : 'transparent' },
                ]}
              >
                {pinnedIds.includes(actionTarget?.libId || '') ? (
                  <>
                    <IconPinned size={17} color={colors.accent || colors.ink} />
                    <Text style={[styles.actionMenuText, { color: colors.ink }]}>Unpin Chat</Text>
                  </>
                ) : (
                  <>
                    <IconPin size={17} color={colors.ink} />
                    <Text style={[styles.actionMenuText, { color: colors.ink }]}>Pin Chat</Text>
                  </>
                )}
              </Pressable>

              {/* Rename Item */}
              <Pressable
                onPress={handleStartRename}
                style={({ pressed }) => [
                  styles.actionMenuItem,
                  { backgroundColor: pressed ? colors.hover : 'transparent' },
                ]}
              >
                <IconPencil size={17} color={colors.ink} />
                <Text style={[styles.actionMenuText, { color: colors.ink }]}>Rename</Text>
              </Pressable>

              {/* Delete Item */}
              <Pressable
                onPress={handleStartDelete}
                style={({ pressed }) => [
                  styles.actionMenuItem,
                  { backgroundColor: pressed ? colors.hover : 'transparent' },
                ]}
              >
                <IconTrash size={17} color="#ef4444" />
                <Text style={[styles.actionMenuText, { color: '#ef4444' }]}>Delete Chat</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        {/* ── RENAME DIALOG MODAL ── */}
        <Modal
          visible={!!renameTarget}
          transparent
          animationType="fade"
          onRequestClose={() => setRenameTarget(null)}
        >
          <View style={styles.dialogBackdrop}>
            <View
              style={[
                styles.dialogCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.line,
                },
              ]}
            >
              <Text style={[styles.dialogTitle, { color: colors.ink }]}>Rename Chat</Text>
              <Text style={[styles.dialogSubtitle, { color: colors.ink2 }]}>
                Enter a new name for this conversation.
              </Text>

              <TextInput
                value={renameTitle}
                onChangeText={setRenameTitle}
                style={[
                  styles.renameInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.line,
                    color: colors.ink,
                  },
                ]}
                placeholder="Conversation title"
                placeholderTextColor={colors.ink3}
                autoFocus
                maxLength={140}
              />

              <View style={styles.dialogButtonRow}>
                <Pressable
                  onPress={() => setRenameTarget(null)}
                  disabled={isRenaming}
                  style={({ pressed }) => [
                    styles.dialogCancelBtn,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.line,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.dialogBtnText, { color: colors.ink }]}>Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={handleConfirmRename}
                  disabled={isRenaming || !renameTitle.trim()}
                  style={({ pressed }) => [
                    styles.dialogConfirmBtn,
                    {
                      backgroundColor: colors.accent,
                      opacity: isRenaming || !renameTitle.trim() ? 0.5 : pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  {isRenaming ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={[styles.dialogBtnText, { color: '#ffffff', fontWeight: 'bold' }]}>
                      Save
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── DELETE CONFIRMATION DIALOG MODAL ── */}
        <Modal
          visible={!!deleteTarget}
          transparent
          animationType="fade"
          onRequestClose={() => setDeleteTarget(null)}
        >
          <View style={styles.dialogBackdrop}>
            <View
              style={[
                styles.dialogCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.line,
                },
              ]}
            >
              <View style={styles.deleteIconCircle}>
                <IconTrash size={22} color="#ef4444" />
              </View>
              <Text style={[styles.dialogTitle, { color: colors.ink, textAlign: 'center' }]}>
                Delete chat?
              </Text>
              <Text style={[styles.dialogSubtitle, { color: colors.ink2, textAlign: 'center' }]}>
                This will permanently delete this conversation and all messages stored within it.
              </Text>

              <View style={[styles.dialogButtonRow, { marginTop: spacing.md }]}>
                <Pressable
                  onPress={() => setDeleteTarget(null)}
                  disabled={isDeleting}
                  style={({ pressed }) => [
                    styles.dialogCancelBtn,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.line,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.dialogBtnText, { color: colors.ink }]}>Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={handleConfirmDelete}
                  disabled={isDeleting}
                  style={({ pressed }) => [
                    styles.dialogDeleteBtn,
                    {
                      opacity: isDeleting ? 0.5 : pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={[styles.dialogBtnText, { color: '#ffffff', fontWeight: 'bold' }]}>
                      Delete
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  drawerContainer: {
    height: '100%',
    borderRightWidth: 1,
    paddingHorizontal: spacing.md,
    borderCurve: radius.borderCurve,
    zIndex: 100,
  },
  headerRow: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.xs,
  },
  brandLogo: {
    width: 125,
    height: 32,
  },
  newChatCard: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm + 2,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    borderCurve: radius.borderCurve,
  },
  newChatLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  newChatIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChatTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: -0.2,
  },
  scrollList: {
    flex: 1,
    marginTop: spacing.xs,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.8,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  featureGroup: {
    gap: 2,
  },
  featureRow: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs + 2,
    borderRadius: radius.sm,
  },
  featureTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  recentsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: spacing.xs,
  },
  recentsGroup: {
    gap: 2,
  },
  recentRowContainer: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  recentMainButton: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs + 2,
    borderRadius: radius.sm,
  },
  recentTitle: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.normal,
  },
  recentActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  emptyContainer: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.fontSize.xs,
    fontStyle: 'italic',
  },
  bottomToolbar: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: spacing.xs,
  },
  profileCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: radius.md,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: typography.fontWeight.bold,
  },
  profileTextGroup: {
    flex: 1,
  },
  userNameText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: -0.2,
  },
  planBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  planBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 0.5,
  },
  planBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  actionMenuCard: {
    width: 240,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xs + 2,
    borderCurve: radius.borderCurve,
  },
  actionMenuHeader: {
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  actionMenuText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    borderCurve: radius.borderCurve,
  },
  dialogTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: -0.3,
  },
  dialogSubtitle: {
    fontSize: typography.fontSize.xs,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  renameInput: {
    height: 46,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.md,
  },
  dialogButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dialogCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogDeleteBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.control,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  deleteIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
});
