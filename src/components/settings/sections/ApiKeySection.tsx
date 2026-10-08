/**
 * src/components/settings/sections/ApiKeySection.tsx
 *
 * API Keys & Credits Management Section for ChatBox AI Mobile APK.
 * Full 1:1 parity with ChatboxAI Web (chatboxai.co.in) adapted for mobile:
 * - API Key Lifecycle (Create, Environment toggle, View/Hide, Copy, Delete)
 * - Developer Compute Wallet in INR
 * - Razorpay In-App Payment Checkout for buying API credits (presets & custom)
 * - Real Transaction Activity Ledger
 * - Usage Trend Analytics with interactive periods (Daily, Weekly, Monthly)
 * - Balance Rules and API Quickstart Documentation
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  IconKey,
  IconPlus,
  IconRefresh,
  IconCopy,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconTrash,
  IconWallet,
  IconCoins,
  IconActivity,
  IconChartBar,
  IconBolt,
  IconBook,
  IconShieldCheck,
  IconReceipt,
} from '@tabler/icons-react-native';
import { BottomSheet } from '@/components/common/BottomSheet';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColors, spacing } from '@/theme';
import {
  fetchApiKeys,
  createApiKey,
  deleteApiKey,
  fetchApiCredits,
  fetchApiUsage,
  maskSecret,
  ApiKeyItem,
  ApiCreditsData,
  ApiUsageData,
} from '@/services/apiKeyService';

const CREDIT_PRESETS = [50, 100, 200];
const MIN_API_CREDIT_PURCHASE = 50;

export const ApiKeySection: React.FC = () => {
  const colors = useThemeColors();
  const { currentUser } = useAuth();
  const userEmail = currentUser?.email || '';

  // API Keys state
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [revealedKeyIds, setRevealedKeyIds] = useState<Record<string, boolean>>({});
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // New key creation state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedEnv, setSelectedEnv] = useState<'live' | 'test'>('live');
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [recentCreatedKey, setRecentCreatedKey] = useState<{ key: string; name: string } | null>(null);

  // Credits state
  const [apiCredits, setApiCredits] = useState<ApiCreditsData>({ balance: 0, transactions: [] });
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [purchaseAmount, setPurchaseAmount] = useState('50');
  const [isInitiatingPayment, setIsInitiatingPayment] = useState(false);

  // Analytics state
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [activeMetric, setActiveMetric] = useState<'requests' | 'tokens' | 'cost'>('requests');
  const [analytics, setAnalytics] = useState<ApiUsageData>({
    totals: { requests: 0, tokens: 0, cost: 0 },
    charts: { daily: [], weekly: [], monthly: [] },
  });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Computed values
  const normalizedPurchaseAmount = useMemo(() => {
    const val = Number(purchaseAmount);
    return Number.isFinite(val) ? Math.round(val) : 0;
  }, [purchaseAmount]);

  const activeKeyCount = useMemo(
    () => keys.filter((k) => k.status === 'active').length,
    [keys]
  );

  const currentSeries = useMemo(
    () => analytics.charts[period] || [],
    [analytics, period]
  );

  // Data Loading
  const loadData = useCallback(async () => {
    if (!userEmail) return;
    setKeysLoading(true);
    setCreditsLoading(true);
    setAnalyticsLoading(true);

    try {
      const idToken = await currentUser?.getIdToken?.();
      const [fetchedKeys, fetchedCredits, fetchedUsage] = await Promise.all([
        fetchApiKeys(userEmail, idToken),
        fetchApiCredits(userEmail, idToken),
        fetchApiUsage(idToken),
      ]);
      setKeys(fetchedKeys);
      setApiCredits(fetchedCredits);
      setAnalytics(fetchedUsage);
    } catch (err) {
      console.warn('[ApiKeySection] Load error:', err);
    } finally {
      setKeysLoading(false);
      setCreditsLoading(false);
      setAnalyticsLoading(false);
    }
  }, [userEmail, currentUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Copy helper
  const handleCopyKey = async (value: string, id: string) => {
    if (!value) return;
    try {
      await Clipboard.setStringAsync(value);
      setCopiedKeyId(id);
      setTimeout(() => setCopiedKeyId(null), 2000);
    } catch (err) {
      console.warn('Copy key failed:', err);
    }
  };

  const toggleReveal = (keyId: string) => {
    setRevealedKeyIds((prev) => ({
      ...prev,
      [keyId]: !prev[keyId],
    }));
  };

  // Create Key
  const handleCreate = async () => {
    const trimmed = newKeyName.trim() || 'Mobile App Key';
    setIsCreatingKey(true);
    try {
      const idToken = await currentUser?.getIdToken?.();
      const { key, item } = await createApiKey(userEmail, trimmed, selectedEnv, idToken);
      setRecentCreatedKey({ key, name: item.name });
      setKeys((prev) => [item, ...prev]);
      setNewKeyName('');
      setIsCreateModalOpen(false);
      Alert.alert('Key Created', 'Make sure to copy your new API key now. It is displayed above.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to create API key.');
    } finally {
      setIsCreatingKey(false);
    }
  };

  // Delete Key
  const handleDelete = (item: ApiKeyItem) => {
    Alert.alert(
      'Revoke API Key',
      `Delete "${item.name}"? Applications using this key will immediately lose access.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const idToken = await currentUser?.getIdToken?.();
              await deleteApiKey(userEmail, item.key_id, idToken);
              setKeys((prev) => prev.filter((k) => k.key_id !== item.key_id));
              if (recentCreatedKey?.name === item.name) {
                setRecentCreatedKey(null);
              }
            } catch (err) {
              Alert.alert('Error', 'Failed to delete key.');
            }
          },
        },
      ]
    );
  };

  // Redirect to Website for API Credit Purchase
  const handleBuyCredits = async () => {
    const websiteUrl = `https://chatboxai.co.in/settings?tab=api-keys&email=${encodeURIComponent(userEmail)}`;
    Alert.alert(
      'Purchase API Credits',
      'API Credit purchases are processed through the official website (chatboxai.co.in) via Razorpay.\n\nOpen chatboxai.co.in in your browser to purchase credits securely?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Website',
          onPress: async () => {
            try {
              await Linking.openURL(websiteUrl);
            } catch {
              Alert.alert('Error', 'Unable to open browser. Please visit https://chatboxai.co.in in your browser.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* ─── GROUP 1: API KEYS SECTION ────────────────────────────────────── */}
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={[styles.sectionHeading, { color: colors.ink3 }]}>API Keys</Text>
          <Text style={[styles.sectionSubheading, { color: colors.ink2 }]}>
            Create, view, copy, and revoke keys for programmatic API access
          </Text>
        </View>

        <View style={styles.headerBtnRow}>
          <Pressable
            onPress={loadData}
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconBtn,
              { backgroundColor: colors.surface2, borderColor: colors.line, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            {keysLoading ? (
              <ActivityIndicator size="small" color={colors.ink} />
            ) : (
              <IconRefresh size={15} color={colors.ink} strokeWidth={1.8} />
            )}
          </Pressable>

          <Pressable
            onPress={() => setIsCreateModalOpen(true)}
            style={({ pressed }) => [
              styles.createBtn,
              { backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <IconPlus size={14} color="#ffffff" strokeWidth={2.2} />
            <Text style={styles.createBtnText}>Create Key</Text>
          </Pressable>
        </View>
      </View>

      {/* RECENTLY CREATED KEY NOTICE */}
      {recentCreatedKey && (
        <View style={[styles.newKeyNotice, { backgroundColor: 'rgba(74, 222, 128, 0.08)', borderColor: 'rgba(74, 222, 128, 0.25)' }]}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <View style={[styles.statusDot, { backgroundColor: '#4ade80' }]} />
              <Text style={[styles.newKeyTitle, { color: '#4ade80' }]}>
                New Key: {recentCreatedKey.name}
              </Text>
            </View>
            <Text style={[styles.newKeySecret, { color: colors.ink }]} numberOfLines={1}>
              {recentCreatedKey.key}
            </Text>
            <Text style={[styles.newKeyHint, { color: colors.ink3 }]}>
              Copy now — store it safely in your app's environment variables.
            </Text>
          </View>
          <Pressable
            onPress={() => handleCopyKey(recentCreatedKey.key, 'recent')}
            style={[styles.copyPill, { backgroundColor: colors.surface, borderColor: colors.line }]}
          >
            {copiedKeyId === 'recent' ? (
              <IconCheck size={14} color="#4ade80" strokeWidth={2.4} />
            ) : (
              <IconCopy size={14} color={colors.ink} strokeWidth={2} />
            )}
          </Pressable>
        </View>
      )}

      {/* KEYS LIST CONTAINER */}
      <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.line, marginTop: 8 }]}>
        {keysLoading && keys.length === 0 ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.emptySubText, { color: colors.ink3, marginTop: 8 }]}>Loading API keys...</Text>
          </View>
        ) : keys.length === 0 ? (
          <View style={styles.emptyContainer}>
            <IconKey size={32} color={colors.ink3} strokeWidth={1.5} />
            <Text style={[styles.emptyTitle, { color: colors.ink, marginTop: 10 }]}>No API keys created</Text>
            <Text style={[styles.emptySubText, { color: colors.ink3, marginTop: 4 }]}>
              Create a secret key to authenticate your applications with ChatBox AI.
            </Text>
          </View>
        ) : (
          keys.map((item, index) => {
            const isRevealed = Boolean(revealedKeyIds[item.key_id]);
            const displaySecret = item.api_key
              ? isRevealed
                ? item.api_key
                : maskSecret(item.api_key)
              : '••••••••••••••••••••••••';

            return (
              <React.Fragment key={item.key_id}>
                {index > 0 && <View style={[styles.divider, { backgroundColor: colors.line }]} />}
                <View style={styles.keyRow}>
                  {/* Top Key Info */}
                  <View style={styles.keyHeaderRow}>
                    <View style={styles.keyTitleGroup}>
                      <View style={[styles.iconBox, { backgroundColor: colors.surface2 }]}>
                        <IconKey size={16} color={colors.ink} strokeWidth={1.8} />
                      </View>
                      <Text style={[styles.keyName, { color: colors.ink }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </View>

                    {/* Badges */}
                    <View style={styles.badgeRow}>
                      <View
                        style={[
                          styles.badge,
                          {
                            backgroundColor: item.status === 'active' ? 'rgba(245, 158, 11, 0.12)' : colors.surface2,
                            borderColor: item.status === 'active' ? 'rgba(245, 158, 11, 0.25)' : colors.line,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            { color: item.status === 'active' ? '#f59e0b' : colors.ink3 },
                          ]}
                        >
                          {item.status.toUpperCase()}
                        </Text>
                      </View>

                      <View style={[styles.badge, { backgroundColor: colors.surface2, borderColor: colors.line }]}>
                        <Text style={[styles.badgeText, { color: colors.ink2 }]}>
                          {item.environment.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Metadata Chips */}
                  <View style={styles.metaChipsRow}>
                    <View style={[styles.metaChip, { backgroundColor: colors.surface2, borderColor: colors.line }]}>
                      <Text style={[styles.metaChipLabel, { color: colors.ink3 }]}>Created</Text>
                      <Text style={[styles.metaChipValue, { color: colors.ink2 }]}>
                        {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    </View>

                    <View style={[styles.metaChip, { backgroundColor: colors.surface2, borderColor: colors.line }]}>
                      <Text style={[styles.metaChipLabel, { color: colors.ink3 }]}>Last used</Text>
                      <Text style={[styles.metaChipValue, { color: colors.ink2 }]}>
                        {item.last_used_at
                          ? new Date(item.last_used_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                          : 'Never'}
                      </Text>
                    </View>

                    <View style={[styles.metaChip, { backgroundColor: colors.surface2, borderColor: colors.line }]}>
                      <Text style={[styles.metaChipLabel, { color: colors.ink3 }]}>ID ending</Text>
                      <Text style={[styles.metaChipValue, { color: colors.ink2 }]}>
                        {item.last_digits || '••••'}
                      </Text>
                    </View>
                  </View>

                  {/* Secret Display & Action Bar */}
                  <View style={[styles.secretBox, { backgroundColor: colors.surface2, borderColor: colors.line }]}>
                    <Text style={[styles.secretText, { color: colors.ink }]} numberOfLines={1}>
                      {displaySecret}
                    </Text>

                    <View style={styles.actionBtnGroup}>
                      <Pressable
                        onPress={() => toggleReveal(item.key_id)}
                        hitSlop={6}
                        style={({ pressed }) => [
                          styles.actionBtn,
                          { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.7 : 1 },
                        ]}
                        accessibilityLabel="Toggle reveal secret"
                      >
                        {isRevealed ? (
                          <IconEyeOff size={14} color={colors.ink} strokeWidth={1.8} />
                        ) : (
                          <IconEye size={14} color={colors.ink} strokeWidth={1.8} />
                        )}
                      </Pressable>

                      <Pressable
                        onPress={() => handleCopyKey(item.api_key, item.key_id)}
                        hitSlop={6}
                        style={({ pressed }) => [
                          styles.actionBtn,
                          { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.7 : 1 },
                        ]}
                        accessibilityLabel="Copy API key"
                      >
                        {copiedKeyId === item.key_id ? (
                          <IconCheck size={14} color="#4ade80" strokeWidth={2.4} />
                        ) : (
                          <IconCopy size={14} color={colors.ink} strokeWidth={1.8} />
                        )}
                      </Pressable>

                      <Pressable
                        onPress={() => handleDelete(item)}
                        hitSlop={6}
                        style={({ pressed }) => [
                          styles.actionBtn,
                          { backgroundColor: colors.surface, borderColor: 'rgba(239, 68, 68, 0.25)', opacity: pressed ? 0.7 : 1 },
                        ]}
                        accessibilityLabel="Delete API key"
                      >
                        <IconTrash size={14} color="#ef4444" strokeWidth={1.8} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              </React.Fragment>
            );
          })
        )}
      </View>

      {/* ─── GROUP 2: API CREDITS & WALLET ─────────────────────────────────── */}
      <View style={[styles.sectionHeaderRow, { marginTop: 28 }]}>
        <View>
          <Text style={[styles.sectionHeading, { color: colors.ink3 }]}>API Credits</Text>
          <Text style={[styles.sectionSubheading, { color: colors.ink2 }]}>
            Developer compute balance for programmatic model and API queries
          </Text>
        </View>

        <Pressable
          onPress={loadData}
          hitSlop={8}
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: colors.surface2, borderColor: colors.line, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          {creditsLoading ? (
            <ActivityIndicator size="small" color={colors.ink} />
          ) : (
            <IconRefresh size={15} color={colors.ink} strokeWidth={1.8} />
          )}
        </Pressable>
      </View>

      <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.line, marginTop: 8 }]}>
        {/* Balance Hero Display */}
        <View style={styles.walletHeroRow}>
          <View style={[styles.walletIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.25)' }]}>
            <IconWallet size={24} color="#f59e0b" strokeWidth={1.8} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.walletBalanceLabel, { color: colors.ink3 }]}>Current Available Balance</Text>
            <Text style={[styles.walletBalanceAmount, { color: colors.ink }]}>
              ₹{apiCredits.balance.toFixed(2)}
            </Text>
          </View>
        </View>

        <Text style={[styles.walletNotice, { color: colors.ink3 }]}>
          Credit purchases convert directly into usable API balance. API requests stop once this balance reaches zero.
        </Text>

        {/* 3 Metric Stat Chips */}
        <View style={styles.statGrid}>
          <View style={[styles.statBox, { backgroundColor: colors.surface2, borderColor: colors.line }]}>
            <Text style={[styles.statBoxLabel, { color: colors.ink3 }]}>Available</Text>
            <Text style={[styles.statBoxValue, { color: colors.ink }]}>₹{apiCredits.balance.toFixed(2)}</Text>
          </View>

          <View style={[styles.statBox, { backgroundColor: colors.surface2, borderColor: colors.line }]}>
            <Text style={[styles.statBoxLabel, { color: colors.ink3 }]}>Total Keys</Text>
            <Text style={[styles.statBoxValue, { color: colors.ink }]}>{keys.length}</Text>
          </View>

          <View style={[styles.statBox, { backgroundColor: colors.surface2, borderColor: colors.line }]}>
            <Text style={[styles.statBoxLabel, { color: colors.ink3 }]}>Active Keys</Text>
            <Text style={[styles.statBoxValue, { color: colors.ink }]}>{activeKeyCount}</Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.line, marginVertical: 16 }]} />

        {/* Buy Credits Section */}
        <View style={styles.buyCreditsHeaderRow}>
          <View>
            <Text style={[styles.buyCreditsTitle, { color: colors.ink }]}>Buy Credits</Text>
            <Text style={[styles.buyCreditsSubtitle, { color: colors.ink3 }]}>
              Choose a preset INR amount or enter custom amount (Min. ₹50)
            </Text>
          </View>
          <View style={[styles.razorpayBadge, { backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.25)' }]}>
            <IconShieldCheck size={12} color="#3b82f6" strokeWidth={2} />
            <Text style={[styles.razorpayBadgeText, { color: '#3b82f6' }]}>chatboxai.co.in</Text>
          </View>
        </View>

        {/* Preset Amount Buttons */}
        <View style={styles.presetRow}>
          {CREDIT_PRESETS.map((amt) => {
            const isSelected = normalizedPurchaseAmount === amt;
            return (
              <Pressable
                key={amt}
                onPress={() => setPurchaseAmount(String(amt))}
                style={({ pressed }) => [
                  styles.presetBtn,
                  {
                    backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.15)' : colors.surface2,
                    borderColor: isSelected ? '#f59e0b' : colors.line,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.presetBtnText,
                    { color: isSelected ? '#f59e0b' : colors.ink, fontWeight: isSelected ? '700' : '500' },
                  ]}
                >
                  ₹{amt}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Custom Input & Checkout Trigger */}
        <View style={styles.customAmountRow}>
          <View style={[styles.customInputContainer, { backgroundColor: colors.surface2, borderColor: colors.line }]}>
            <Text style={[styles.rupeePrefix, { color: colors.ink3 }]}>₹</Text>
            <TextInput
              value={purchaseAmount}
              onChangeText={setPurchaseAmount}
              keyboardType="number-pad"
              placeholder="Amount"
              placeholderTextColor={colors.ink3}
              style={[styles.customInput, { color: colors.ink }]}
            />
          </View>

          <Pressable
            onPress={handleBuyCredits}
            style={({ pressed }) => [
              styles.payBtn,
              {
                backgroundColor: '#f59e0b',
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <IconCoins size={16} color="#ffffff" strokeWidth={2} />
            <Text style={styles.payBtnText}>Buy on Website</Text>
          </Pressable>
        </View>
      </View>

      {/* ─── GROUP 3: RECENT TRANSACTION ACTIVITY ──────────────────────────── */}
      <View style={[styles.sectionHeaderRow, { marginTop: 28 }]}>
        <View>
          <Text style={[styles.sectionHeading, { color: colors.ink3 }]}>Recent Activity</Text>
          <Text style={[styles.sectionSubheading, { color: colors.ink2 }]}>
            Latest purchases and programmatic usage deductions
          </Text>
        </View>
        <IconActivity size={18} color={colors.ink3} strokeWidth={1.8} />
      </View>

      <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.line, marginTop: 8 }]}>
        {apiCredits.transactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <IconReceipt size={28} color={colors.ink3} strokeWidth={1.5} />
            <Text style={[styles.emptyTitle, { color: colors.ink, marginTop: 10 }]}>No transactions yet</Text>
            <Text style={[styles.emptySubText, { color: colors.ink3, marginTop: 4 }]}>
              Credit purchases and API deductions will appear here in chronological order.
            </Text>
          </View>
        ) : (
          apiCredits.transactions.map((tx, idx) => {
            const isPurchase = tx.transaction_type === 'purchase';
            return (
              <React.Fragment key={tx.id || idx}>
                {idx > 0 && <View style={[styles.divider, { backgroundColor: colors.line }]} />}
                <View style={styles.txRow}>
                  <View style={[styles.txIconBox, { backgroundColor: isPurchase ? 'rgba(74, 222, 128, 0.12)' : colors.surface2 }]}>
                    <IconCoins size={16} color={isPurchase ? '#4ade80' : colors.ink3} strokeWidth={1.8} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.txTitle, { color: colors.ink }]}>
                      {isPurchase ? 'Credit Purchase' : (tx.endpoint || 'API Usage Deduction')}
                    </Text>
                    <Text style={[styles.txDate, { color: colors.ink3 }]}>
                      {new Date(tx.created_at).toLocaleString()}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.txAmount, { color: isPurchase ? '#4ade80' : colors.ink }]}>
                      {isPurchase ? '+' : '-'}₹{Math.abs(tx.amount).toFixed(2)}
                    </Text>
                    <Text style={[styles.txBalanceAfter, { color: colors.ink3 }]}>
                      Bal: ₹{tx.balance_after.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </React.Fragment>
            );
          })
        )}
      </View>

      {/* ─── GROUP 4: USAGE ANALYTICS ──────────────────────────────────────── */}
      <View style={[styles.sectionHeaderRow, { marginTop: 28 }]}>
        <View>
          <Text style={[styles.sectionHeading, { color: colors.ink3 }]}>Usage Analytics</Text>
          <Text style={[styles.sectionSubheading, { color: colors.ink2 }]}>
            Programmatic requests, tokens, and compute cost
          </Text>
        </View>
        <IconChartBar size={18} color={colors.ink3} strokeWidth={1.8} />
      </View>

      <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.line, marginTop: 8 }]}>
        {/* Metric Selector Tabs */}
        <View style={styles.metricTabsRow}>
          {(['requests', 'tokens', 'cost'] as const).map((m) => {
            const isSelected = activeMetric === m;
            const totalVal =
              m === 'cost'
                ? `₹${analytics.totals.cost.toFixed(2)}`
                : analytics.totals[m].toLocaleString();

            return (
              <Pressable
                key={m}
                onPress={() => setActiveMetric(m)}
                style={[
                  styles.metricTab,
                  {
                    backgroundColor: isSelected ? colors.surface2 : 'transparent',
                    borderColor: isSelected ? colors.line : 'transparent',
                  },
                ]}
              >
                <Text style={[styles.metricTabLabel, { color: colors.ink3 }]}>
                  {m.toUpperCase()}
                </Text>
                <Text style={[styles.metricTabValue, { color: colors.ink }]}>
                  {totalVal}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Period Selector Tabs */}
        <View style={styles.periodTabsRow}>
          {(['daily', 'weekly', 'monthly'] as const).map((p) => {
            const isSelected = period === p;
            return (
              <Pressable
                key={p}
                onPress={() => setPeriod(p)}
                style={[
                  styles.periodTab,
                  {
                    backgroundColor: isSelected ? colors.accent : colors.surface2,
                    borderColor: isSelected ? colors.accent : colors.line,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.periodTabText,
                    { color: isSelected ? '#ffffff' : colors.ink2, fontWeight: isSelected ? '600' : '400' },
                  ]}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Visual Chart Bars */}
        {analyticsLoading ? (
          <View style={styles.chartLoadingBox}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.emptySubText, { color: colors.ink3, marginTop: 8 }]}>Loading analytics...</Text>
          </View>
        ) : currentSeries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptySubText, { color: colors.ink3 }]}>No usage data recorded for this period.</Text>
          </View>
        ) : (
          <View style={styles.chartContainer}>
            {currentSeries.slice(-7).map((pt, idx) => {
              const maxVal = Math.max(...currentSeries.map((s) => s[activeMetric] || 1), 1);
              const heightPct = Math.min(Math.max(((pt[activeMetric] || 0) / maxVal) * 100, 8), 100);

              return (
                <View key={pt.key || idx} style={styles.chartBarCol}>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${heightPct}%`,
                          backgroundColor: activeMetric === 'cost' ? '#f59e0b' : colors.accent,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barLabel, { color: colors.ink3 }]} numberOfLines={1}>
                    {pt.key ? pt.key.slice(-5) : `${idx + 1}`}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* ─── GROUP 5: BALANCE RULES & DOCUMENTATION ────────────────────────── */}
      <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.line, marginTop: 20 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <IconBolt size={18} color="#f59e0b" strokeWidth={1.8} />
          <Text style={[styles.rulesTitle, { color: colors.ink }]}>Balance Rules</Text>
        </View>
        <Text style={[styles.rulesText, { color: colors.ink2 }]}>
          • ₹50 purchase = ₹50 developer API compute credits{'\n'}
          • Direct 1:1 conversion across all custom recharge tiers{'\n'}
          • Programmatic requests stop automatically when balance reaches zero{'\n'}
          • Credits remain active indefinitely with zero expiry
        </Text>
      </View>

      {/* Documentation Quickstart */}
      <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.line, marginTop: 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <IconBook size={18} color={colors.accent} strokeWidth={1.8} />
          <Text style={[styles.rulesTitle, { color: colors.ink }]}>API Quickstart</Text>
        </View>
        <Text style={[styles.rulesText, { color: colors.ink2, marginBottom: 10 }]}>
          Base URL: <Text style={{ color: colors.ink, fontWeight: '600' }}>https://chatboxai.co.in/api/v1</Text>
        </Text>

        <View style={[styles.codeSnippetBox, { backgroundColor: colors.surface2, borderColor: colors.line }]}>
          <Text style={[styles.codeSnippetText, { color: colors.ink2 }]}>
            curl -X POST https://chatboxai.co.in/api/v1/chat/completions \{'\n'}
            {'  '}-H "Authorization: Bearer cbx_live_..." \{'\n'}
            {'  '}-H "Content-Type: application/json" \{'\n'}
            {'  '}-d '{'{"model": "gpt-4o", "messages": [{"role": "user", "content": "Hello"}]}'}'
          </Text>
        </View>
      </View>

      {/* ─── BOTTOM SHEET: CREATE API KEY ──────────────────────────────────── */}
      <BottomSheet
        visible={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setNewKeyName('');
        }}
        title="Create API Key"
      >
        <View style={{ paddingVertical: spacing.xs }}>
          <Text style={[styles.sheetDesc, { color: colors.ink2 }]}>
            Enter a key name and select the target environment.
          </Text>

          <Text style={[styles.inputLabel, { color: colors.ink3, marginTop: 12 }]}>Key Name</Text>
          <TextInput
            value={newKeyName}
            onChangeText={setNewKeyName}
            placeholder="e.g. Mobile App Dev, Backend Service"
            placeholderTextColor={colors.ink3}
            style={[styles.sheetInput, { backgroundColor: colors.surface2, borderColor: colors.line, color: colors.ink }]}
            autoCapitalize="words"
          />

          <Text style={[styles.inputLabel, { color: colors.ink3, marginTop: 14 }]}>Environment</Text>
          <View style={styles.envRow}>
            {(['live', 'test'] as const).map((env) => {
              const isSelected = selectedEnv === env;
              return (
                <Pressable
                  key={env}
                  onPress={() => setSelectedEnv(env)}
                  style={[
                    styles.envPill,
                    {
                      backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.15)' : colors.surface2,
                      borderColor: isSelected ? '#f59e0b' : colors.line,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.envPillText,
                      { color: isSelected ? '#f59e0b' : colors.ink, fontWeight: isSelected ? '700' : '500' },
                    ]}
                  >
                    {env === 'live' ? 'Live (Production)' : 'Test (Sandbox)'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={handleCreate}
            disabled={isCreatingKey}
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                backgroundColor: colors.accent,
                opacity: isCreatingKey ? 0.6 : pressed ? 0.8 : 1,
              },
            ]}
          >
            {isCreatingKey ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.primaryBtnText}>Generate Key</Text>
            )}
          </Pressable>
        </View>
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingBottom: spacing.xl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sectionSubheading: {
    fontSize: 12,
    marginTop: 2,
    maxWidth: 240,
  },
  headerBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  createBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  groupCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.md,
    overflow: 'hidden',
  },
  newKeyNotice: {
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  newKeyTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  newKeySecret: {
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: '700',
    marginTop: 2,
  },
  newKeyHint: {
    fontSize: 11,
    marginTop: 4,
  },
  copyPill: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptySubText: {
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 280,
  },
  keyRow: {
    paddingVertical: 2,
  },
  keyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  keyTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyName: {
    fontSize: 14,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  metaChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  metaChip: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  metaChipLabel: {
    fontSize: 10,
  },
  metaChipValue: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  secretBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
  },
  secretText: {
    fontFamily: 'monospace',
    fontSize: 12,
    flex: 1,
    marginRight: 8,
  },
  actionBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletBalanceLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  walletBalanceAmount: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  walletNotice: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  statGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  statBox: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  statBoxLabel: {
    fontSize: 10,
  },
  statBoxValue: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  buyCreditsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  buyCreditsTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  buyCreditsSubtitle: {
    fontSize: 11,
    marginTop: 2,
    maxWidth: 200,
  },
  razorpayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  razorpayBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#f59e0b',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetBtnText: {
    fontSize: 14,
  },
  customAmountRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  customInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
  },
  rupeePrefix: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 6,
  },
  customInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 0,
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  payBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  txIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  txDate: {
    fontSize: 10,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
  txBalanceAfter: {
    fontSize: 10,
    marginTop: 2,
  },
  metricTabsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  metricTab: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  metricTabLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  metricTabValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 3,
  },
  periodTabsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  periodTabText: {
    fontSize: 12,
  },
  chartLoadingBox: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    paddingTop: 10,
    paddingHorizontal: 6,
  },
  chartBarCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    marginHorizontal: 3,
  },
  barTrack: {
    width: 14,
    height: 90,
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
  },
  barLabel: {
    fontSize: 9,
    marginTop: 6,
  },
  rulesTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  rulesText: {
    fontSize: 12,
    lineHeight: 18,
  },
  codeSnippetBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  codeSnippetText: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
  sheetDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sheetInput: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    marginTop: 6,
  },
  envRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 20,
  },
  envPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  envPillText: {
    fontSize: 12,
  },
  primaryBtn: {
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
