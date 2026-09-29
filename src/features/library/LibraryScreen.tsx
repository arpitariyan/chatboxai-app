import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconArrowLeft,
  IconMessage2,
  IconPhoto,
  IconBrain,
  IconWorld,
  IconDotsVertical,
  IconPin,
  IconPinned,
  IconPencil,
  IconTrash,
  IconSearch,
  IconX,
  IconBooks,
} from '@tabler/icons-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColors, typography, spacing, radius } from '@/theme';
import { chatService, ConversationItem, cleanConversationTitle } from '@/services/chatService';
import { pinService } from '@/services/pinService';

interface LibraryScreenProps {
  onBack: () => void;
  onSelectConversation: (libId: string, title?: string, type?: string) => void;
  refreshTrigger?: number;
}

function formatConversationDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) {
      return d.toLocaleDateString([], { weekday: 'short' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export const LibraryScreen: React.FC<LibraryScreenProps> = ({ 
  onBack, 
  onSelectConversation,
  refreshTrigger = 0
}) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { currentUser } = useAuth();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search filter
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  const loadData = useCallback(async (isPull = false) => {
    if (!currentUser?.email) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (isPull) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [items, pins] = await Promise.all([
        chatService.fetchUserConversations(currentUser.email),
        pinService.getPinnedIds(currentUser.email),
      ]);
      setConversations(items);
      setPinnedIds(pins);
    } catch (err: any) {
      if (__DEV__) {
        console.warn('[LibraryScreen] Error loading conversations:', err?.message || err);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser?.email]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  // Subscribe to pin service changes
  useEffect(() => {
    const unsub = pinService.addListener((updatedPins) => {
      setPinnedIds(updatedPins);
    });
    return unsub;
  }, []);

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
      if (__DEV__) console.warn('[LibraryScreen] Rename error:', err);
      loadData();
    } finally {
      setIsRenaming(false);
      setRenameTarget(null);
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
      if (__DEV__) console.warn('[LibraryScreen] Delete error:', err);
      loadData();
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleTogglePin = async () => {
    if (!actionTarget || !currentUser?.email) return;
    const targetLibId = actionTarget.libId;
    setIsActionModalOpen(false);

    // Optimistic UI update
    setPinnedIds((prev) =>
      prev.includes(targetLibId)
        ? prev.filter((id) => id !== targetLibId)
        : [targetLibId, ...prev]
    );

    await pinService.togglePin(targetLibId, currentUser.email);
  };

  // Filter and sort conversations: Pinned first, then sorted newest first
  const displayedConversations = useMemo(() => {
    let list = [...conversations];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((item) =>
        (item.title || '').toLowerCase().includes(q) ||
        (item.rawTitle || '').toLowerCase().includes(q) ||
        (item.type || '').toLowerCase().includes(q)
      );
    }

    // Sort: pinned first, then newest
    return list.sort((a, b) => {
      const aPinned = pinnedIds.includes(a.libId) ? 1 : 0;
      const bPinned = pinnedIds.includes(b.libId) ? 1 : 0;
      if (aPinned !== bPinned) {
        return bPinned - aPinned;
      }
      const aTime = new Date(a.createdAt).getTime() || 0;
      const bTime = new Date(b.createdAt).getTime() || 0;
      return bTime - aTime;
    });
  }, [conversations, pinnedIds, searchQuery]);

  const renderItem = ({ item }: { item: ConversationItem }) => {
    const isPinned = pinnedIds.includes(item.libId);
    let IconComp = IconMessage2;
    let iconColor = colors.ink;
    let typeLabel = 'Chat';

    if (item.type === 'image-generation') {
      IconComp = IconPhoto;
      iconColor = colors.accent || '#c084fc';
      typeLabel = 'Image Generation';
    } else if (item.type === 'deep-research') {
      IconComp = IconBrain;
      iconColor = '#eab308';
      typeLabel = 'Deep Research';
    } else if (item.type === 'website-builder') {
      IconComp = IconWorld;
      iconColor = '#38bdf8';
      typeLabel = 'Website';
    }

    const formattedDate = formatConversationDate(item.createdAt);

    return (
      <Pressable
        onPress={() => onSelectConversation(item.libId, item.title, item.type)}
        style={({ pressed }) => [
          styles.optionRow,
          {
            backgroundColor: pressed ? colors.hover : colors.surface,
            borderColor: colors.line,
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.985 : 1 }],
          },
        ]}
      >
        {/* Left circular icon container inspired by AttachmentSheet */}
        <View style={[styles.iconContainer, { backgroundColor: colors.inset || '#26262a' }]}>
          <IconComp size={20} color={iconColor} strokeWidth={1.8} />
        </View>

        {/* Text Column */}
        <View style={styles.optionTextCol}>
          <Text style={[styles.optionTitle, { color: colors.ink }]} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.subtitleRow}>
            {isPinned && (
              <View style={styles.pinnedBadge}>
                <IconPinned size={12} color={colors.accent || colors.ink} strokeWidth={2} />
                <Text style={[styles.pinnedBadgeText, { color: colors.accent || colors.ink }]}>
                  Pinned
                </Text>
                <Text style={[styles.dotSeparator, { color: colors.ink3 }]}>•</Text>
              </View>
            )}
            <Text style={[styles.optionSubtitle, { color: colors.ink3 }]}>
              {typeLabel}
            </Text>
            {formattedDate ? (
              <>
                <Text style={[styles.dotSeparator, { color: colors.ink3 }]}>•</Text>
                <Text style={[styles.optionSubtitle, { color: colors.ink3 }]}>
                  {formattedDate}
                </Text>
              </>
            ) : null}
          </View>
        </View>

        {/* Right three-dot button */}
        <Pressable 
          onPress={(e) => {
            e.stopPropagation();
            handleOpenActionMenu(item);
          }}
          hitSlop={10}
          accessibilityLabel="Conversation actions"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.threeDotBtn,
            {
              backgroundColor: pressed ? colors.hover : 'transparent',
            },
          ]}
        >
          <IconDotsVertical size={18} color={colors.ink3} strokeWidth={1.9} />
        </Pressable>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header: Matches Home page Header.tsx ── */}
      <View
        style={[
          styles.headerContainer,
          {
            backgroundColor: colors.background,
            paddingTop: Math.max(insets.top, 12),
          },
        ]}
      >
        <View style={styles.headerRow}>
          {/* Left Action: Back button */}
          <Pressable
            onPress={onBack}
            hitSlop={8}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: pressed ? colors.hover : colors.surface,
                borderColor: colors.line,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <IconArrowLeft size={20} color={colors.ink} strokeWidth={2} />
          </Pressable>

          {/* Centered Title */}
          <View style={styles.titleContainer} pointerEvents="none">
            <Text style={[styles.headerTitle, { color: colors.ink }]}>Library</Text>
          </View>

          {/* Right Action: Search toggle button */}
          <Pressable
            onPress={() => {
              setShowSearch((p) => {
                if (p) setSearchQuery('');
                return !p;
              });
            }}
            hitSlop={8}
            accessibilityLabel="Search library"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: showSearch || pressed ? colors.hover : colors.surface,
                borderColor: colors.line,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            {showSearch ? (
              <IconX size={18} color={colors.ink} strokeWidth={2} />
            ) : (
              <IconSearch size={18} color={colors.ink} strokeWidth={2} />
            )}
          </Pressable>
        </View>

        {/* Optional Search Bar */}
        {showSearch && (
          <View style={[styles.searchBarWrapper, { borderColor: colors.line, backgroundColor: colors.surface }]}>
            <IconSearch size={16} color={colors.ink3} strokeWidth={2} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search conversations..."
              placeholderTextColor={colors.ink3}
              style={[styles.searchInput, { color: colors.ink }]}
              autoFocus
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={6}>
                <IconX size={14} color={colors.ink3} />
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* ── Main List ── */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent || colors.ink} />
          <Text style={[styles.loadingText, { color: colors.ink3 }]}>Loading library...</Text>
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <IconBooks size={32} color={colors.ink3} strokeWidth={1.8} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.ink }]}>Your library is empty</Text>
          <Text style={[styles.emptySubtitle, { color: colors.ink3 }]}>
            All your conversations and creations will be saved here automatically.
          </Text>
        </View>
      ) : displayedConversations.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.emptySubtitle, { color: colors.ink3 }]}>
            No conversations match "{searchQuery}"
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayedConversations}
          keyExtractor={(item) => item.libId}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true)}
              tintColor={colors.accent || colors.ink}
            />
          }
        />
      )}

      {/* ── Context Actions Modal (Pin, Edit, Delete) ── */}
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

            {/* Pin / Unpin */}
            <Pressable
              onPress={handleTogglePin}
              style={({ pressed }) => [
                styles.actionMenuItem,
                { backgroundColor: pressed ? colors.hover : 'transparent' },
              ]}
            >
              {pinnedIds.includes(actionTarget?.libId || '') ? (
                <>
                  <IconPinned size={18} color={colors.accent || colors.ink} strokeWidth={2} />
                  <Text style={[styles.actionMenuText, { color: colors.ink }]}>Unpin Chat</Text>
                </>
              ) : (
                <>
                  <IconPin size={18} color={colors.ink} strokeWidth={2} />
                  <Text style={[styles.actionMenuText, { color: colors.ink }]}>Pin Chat</Text>
                </>
              )}
            </Pressable>

            {/* Rename */}
            <Pressable
              onPress={handleStartRename}
              style={({ pressed }) => [
                styles.actionMenuItem,
                { backgroundColor: pressed ? colors.hover : 'transparent' },
              ]}
            >
              <IconPencil size={18} color={colors.ink} strokeWidth={2} />
              <Text style={[styles.actionMenuText, { color: colors.ink }]}>Edit Title</Text>
            </Pressable>

            {/* Delete */}
            <Pressable
              onPress={handleStartDelete}
              style={({ pressed }) => [
                styles.actionMenuItem,
                { backgroundColor: pressed ? 'rgba(239, 68, 68, 0.12)' : 'transparent' },
              ]}
            >
              <IconTrash size={18} color="#ef4444" strokeWidth={2} />
              <Text style={[styles.actionMenuText, { color: '#ef4444' }]}>Delete Chat</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ── Rename Dialog Modal ── */}
      <Modal
        visible={!!renameTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameTarget(null)}
      >
        <View style={styles.dialogBackdrop}>
          <View style={[styles.dialogCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={[styles.dialogTitle, { color: colors.ink }]}>Edit Title</Text>
            <Text style={[styles.dialogSubtitle, { color: colors.ink2 }]}>
              Enter a new title for this conversation.
            </Text>

            <TextInput
              value={renameTitle}
              onChangeText={setRenameTitle}
              placeholder="Conversation title"
              placeholderTextColor={colors.ink3}
              autoFocus
              maxLength={140}
              style={[
                styles.renameInput,
                { color: colors.ink, backgroundColor: colors.background, borderColor: colors.line },
              ]}
            />

            <View style={styles.dialogButtonRow}>
              <Pressable
                onPress={() => setRenameTarget(null)}
                disabled={isRenaming}
                style={({ pressed }) => [
                  styles.dialogCancelBtn,
                  { backgroundColor: colors.background, borderColor: colors.line, opacity: pressed ? 0.7 : 1 },
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
                    backgroundColor: colors.ink,
                    opacity: isRenaming || !renameTitle.trim() ? 0.5 : pressed ? 0.85 : 1,
                  },
                ]}
              >
                {isRenaming ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text style={[styles.dialogBtnText, { color: colors.background }]}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Delete Confirmation Dialog Modal ── */}
      <Modal
        visible={!!deleteTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteTarget(null)}
      >
        <View style={styles.dialogBackdrop}>
          <View style={[styles.dialogCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <View style={styles.deleteIconCircle}>
              <IconTrash size={22} color="#ef4444" strokeWidth={2} />
            </View>
            <Text style={[styles.dialogTitle, { color: colors.ink, textAlign: 'center' }]}>Delete chat?</Text>
            <Text style={[styles.dialogSubtitle, { color: colors.ink2, textAlign: 'center' }]}>
              This will permanently delete this conversation and all messages stored within it.
            </Text>

            <View style={[styles.dialogButtonRow, { marginTop: spacing.md }]}>
              <Pressable
                onPress={() => setDeleteTarget(null)}
                disabled={isDeleting}
                style={({ pressed }) => [
                  styles.dialogCancelBtn,
                  { backgroundColor: colors.background, borderColor: colors.line, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.dialogBtnText, { color: colors.ink }]}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleConfirmDelete}
                disabled={isDeleting}
                style={({ pressed }) => [
                  styles.dialogDeleteBtn,
                  { opacity: isDeleting ? 0.5 : pressed ? 0.85 : 1 },
                ]}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={[styles.dialogBtnText, { color: '#ffffff', fontWeight: 'bold' }]}>Delete</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    width: '100%',
    borderBottomWidth: 0,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    zIndex: 10,
  },
  headerRow: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderCurve: radius.borderCurve,
  },
  titleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    paddingVertical: 0,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.sm,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 100,
    gap: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    borderCurve: radius.borderCurve,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextCol: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  pinnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  pinnedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dotSeparator: {
    fontSize: 10,
    marginHorizontal: 5,
  },
  optionSubtitle: {
    fontSize: 12,
  },
  threeDotBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  actionMenuCard: {
    width: 250,
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.xs + 2,
    borderCurve: radius.borderCurve,
  },
  actionMenuHeader: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: 11,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  actionMenuText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
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
    fontWeight: '700',
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
    borderCurve: radius.borderCurve,
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
    borderCurve: radius.borderCurve,
  },
  dialogConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: radius.borderCurve,
  },
  dialogDeleteBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.control,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: radius.borderCurve,
  },
  dialogBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
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
