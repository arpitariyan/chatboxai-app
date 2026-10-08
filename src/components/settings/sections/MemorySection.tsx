/**
 * src/components/settings/sections/MemorySection.tsx
 *
 * Memory Settings Section for ChatBox AI Mobile APK.
 * Follows the unified Home screen + Menu/Bottom Sheet design language:
 * - Grouped Surface cards with hairline dividers
 * - AI Conversation Memory master switch
 * - Explanatory knowledge card
 * - Memory list with inclusion toggle, item delete, and clear all
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Switch,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  IconBrain,
  IconEye,
  IconEyeOff,
  IconTrash,
  IconSparkles,
  IconFolder,
  IconInfoCircle,
  IconCheck,
} from '@tabler/icons-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColors, spacing, radius, typography } from '@/theme';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import {
  fetchUserMemories,
  toggleMemoryInclusion,
  deleteMemory,
  clearAllUserMemories,
  ConversationMemoryItem,
} from '@/services/memoryService';

export const MemorySection: React.FC = () => {
  const colors = useThemeColors();
  const { currentUser, userProfile } = useAuth();
  const userDocId = userProfile?.$id;
  const userEmail = currentUser?.email || '';

  const memoryEnabled = usePreferencesStore((s) => s.memoryEnabled);
  const setMemoryEnabled = usePreferencesStore((s) => s.setMemoryEnabled);

  const [memories, setMemories] = useState<ConversationMemoryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadMemories = useCallback(async () => {
    if (!userEmail) return;
    setLoading(true);
    try {
      const res = await fetchUserMemories(userEmail, 50, 0);
      setMemories(res.memories);
      setTotalCount(res.total);
    } catch (err) {
      console.warn('[MemorySection] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  const handleToggleInclude = async (item: ConversationMemoryItem) => {
    const nextVal = !item.includedInContext;
    setTogglingId(item.$id);
    try {
      await toggleMemoryInclusion(item.$id, nextVal);
      setMemories((prev) =>
        prev.map((m) => (m.$id === item.$id ? { ...m, includedInContext: nextVal } : m))
      );
    } catch (err) {
      console.warn('[MemorySection] Toggle inclusion failed:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteItem = (item: ConversationMemoryItem) => {
    Alert.alert(
      'Delete Memory',
      'This conversation will be permanently removed from your AI memory.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(item.$id);
            try {
              await deleteMemory(item.$id);
              setMemories((prev) => prev.filter((m) => m.$id !== item.$id));
              setTotalCount((c) => Math.max(0, c - 1));
            } catch (err) {
              Alert.alert('Error', 'Failed to delete memory.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Memories?',
      `This will permanently delete all ${totalCount} saved conversation memories. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await clearAllUserMemories(userEmail);
              setMemories([]);
              setTotalCount(0);
              Alert.alert('Success', 'All memories cleared successfully.');
            } catch (err) {
              Alert.alert('Error', 'Failed to clear memories.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* ─── GROUP 1: MASTER PREFERENCE ────────────────────────────────────── */}
      <Text style={[styles.sectionHeading, { color: colors.ink3 }]}>
        AI Conversation Memory
      </Text>

      <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <View style={styles.actionRow}>
          <View style={[styles.iconBox, { backgroundColor: colors.surface2 }]}>
            <IconBrain size={18} color={colors.ink} strokeWidth={1.8} />
          </View>
          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.ink }]}>Memory Retention</Text>
            <Text style={[styles.rowSubtitle, { color: colors.ink3 }]}>
              {memoryEnabled ? 'Enabled — Assistant remembers context across chats' : 'Disabled — Each conversation is isolated'}
            </Text>
          </View>
          <Switch
            value={memoryEnabled}
            onValueChange={(val) => setMemoryEnabled(val, userDocId)}
            trackColor={{ false: colors.line2, true: colors.accent }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      {/* ─── GROUP 2: HOW IT WORKS CARD ────────────────────────────────────── */}
      <Text style={[styles.sectionHeading, { color: colors.ink3 }]}>
        How Memory Works
      </Text>

      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <View style={styles.infoRow}>
          <IconSparkles size={16} color={colors.accent} strokeWidth={1.8} style={{ marginTop: 2 }} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.infoTitle, { color: colors.ink }]}>Context Extraction</Text>
            <Text style={[styles.infoDesc, { color: colors.ink3 }]}>
              Important details, user preferences, and code contexts are automatically indexed from previous sessions.
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.line, marginLeft: 26, marginVertical: 10 }]} />

        <View style={styles.infoRow}>
          <IconEye size={16} color={colors.accent} strokeWidth={1.8} style={{ marginTop: 2 }} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.infoTitle, { color: colors.ink }]}>Selective Inclusion</Text>
            <Text style={[styles.infoDesc, { color: colors.ink3 }]}>
              Toggle individual memories on or off at any time using the visibility button.
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.line, marginLeft: 26, marginVertical: 10 }]} />

        <View style={styles.infoRow}>
          <IconFolder size={16} color={colors.accent} strokeWidth={1.8} style={{ marginTop: 2 }} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.infoTitle, { color: colors.ink }]}>Local Privacy</Text>
            <Text style={[styles.infoDesc, { color: colors.ink3 }]}>
              Memories are isolated to your user account and never shared with third parties.
            </Text>
          </View>
        </View>
      </View>

      {/* ─── GROUP 3: MEMORY MANAGER ───────────────────────────────────────── */}
      <View style={styles.managerHeaderRow}>
        <Text style={[styles.sectionHeading, { color: colors.ink3, marginTop: 0, marginBottom: 0 }]}>
          Stored Memories ({totalCount})
        </Text>
        {totalCount > 0 && (
          <Pressable
            onPress={handleClearAll}
            hitSlop={8}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.clearAllText, { color: colors.destructive || '#ef4444' }]}>
              Clear All
            </Text>
          </Pressable>
        )}
      </View>

      <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.line, marginTop: 8 }]}>
        {loading ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.emptySubText, { color: colors.ink3, marginTop: 8 }]}>Loading memories...</Text>
          </View>
        ) : memories.length === 0 ? (
          <View style={styles.emptyContainer}>
            <IconBrain size={28} color={colors.ink3} strokeWidth={1.5} />
            <Text style={[styles.emptyTitle, { color: colors.ink, marginTop: 10 }]}>No memories saved yet</Text>
            <Text style={[styles.emptySubText, { color: colors.ink3, marginTop: 4 }]}>
              Conversations will appear here as you chat with ChatBox AI.
            </Text>
          </View>
        ) : (
          memories.map((item, index) => {
            const isToggling = togglingId === item.$id;
            const isDeleting = deletingId === item.$id;

            return (
              <React.Fragment key={item.$id}>
                {index > 0 && <View style={[styles.divider, { backgroundColor: colors.line }]} />}
                <View style={styles.memoryRow}>
                  <View style={styles.memoryContentCol}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.memoryTopic, { color: colors.ink }] } numberOfLines={1}>
                        {item.summary?.topic || 'General Topic'}
                      </Text>
                      {item.conversationType === 'research' && (
                        <View style={[styles.tagBadge, { backgroundColor: 'rgba(139, 92, 246, 0.12)', borderColor: 'rgba(139, 92, 246, 0.25)' }]}>
                          <Text style={[styles.tagBadgeText, { color: colors.accent }]}>Research</Text>
                        </View>
                      )}
                    </View>

                    {item.summary?.summary ? (
                      <Text style={[styles.memoryFindings, { color: colors.ink3 }]} numberOfLines={2}>
                        {item.summary.summary}
                      </Text>
                    ) : null}

                    <Text style={[styles.memoryDate, { color: colors.ink3 }]}>
                      {new Date(item.createdAt || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>

                  {/* Actions: Include Toggle & Delete */}
                  <View style={styles.memoryActionsCol}>
                    <Pressable
                      onPress={() => handleToggleInclude(item)}
                      disabled={isToggling}
                      hitSlop={6}
                      style={({ pressed }) => [
                        styles.iconActionBtn,
                        {
                          backgroundColor: item.includedInContext ? 'rgba(74, 222, 128, 0.12)' : colors.surface2,
                          borderColor: colors.line,
                          opacity: isToggling ? 0.5 : pressed ? 0.75 : 1,
                        },
                      ]}
                      accessibilityLabel="Toggle memory in context"
                    >
                      {item.includedInContext ? (
                        <IconEye size={16} color="#4ade80" strokeWidth={2} />
                      ) : (
                        <IconEyeOff size={16} color={colors.ink3} strokeWidth={2} />
                      )}
                    </Pressable>

                    <Pressable
                      onPress={() => handleDeleteItem(item)}
                      disabled={isDeleting}
                      hitSlop={6}
                      style={({ pressed }) => [
                        styles.iconActionBtn,
                        {
                          backgroundColor: colors.surface2,
                          borderColor: colors.line,
                          opacity: isDeleting ? 0.5 : pressed ? 0.75 : 1,
                        },
                      ]}
                      accessibilityLabel="Delete memory"
                    >
                      <IconTrash size={16} color={colors.destructive || '#ef4444'} strokeWidth={1.8} />
                    </Pressable>
                  </View>
                </View>
              </React.Fragment>
            );
          })
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingBottom: spacing.lg,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  groupCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowTextCol: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  rowSubtitle: {
    fontSize: 12.5,
    marginTop: 2,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    marginLeft: 56,
  },
  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoDesc: {
    fontSize: 12.5,
    marginTop: 2,
    lineHeight: 17,
  },
  managerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingHorizontal: 4,
  },
  clearAllText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptySubText: {
    fontSize: 13,
    textAlign: 'center',
  },
  memoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  memoryContentCol: {
    flex: 1,
    marginRight: 12,
  },
  memoryTopic: {
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  tagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  tagBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  memoryFindings: {
    fontSize: 12.5,
    marginTop: 3,
    lineHeight: 16,
  },
  memoryDate: {
    fontSize: 11.5,
    marginTop: 4,
  },
  memoryActionsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
