/**
 * src/components/settings/sections/AccountSection.tsx
 *
 * Account Settings Section for ChatBox AI Mobile APK.
 * Credit logic mirrors the website exactly:
 *   - dailyFreeCredits  = userProfile.credits      (resets 5,000/day for ALL plans)
 *   - monthlyPaidCredits = userProfile.paid_credits  (only Pro/Max; preserved after expiry)
 *   - paidResetAllocation = 30,000 (Pro) | 150,000 (Max) | 0 (Free)
 * Paid credits are shown if plan is paid OR if paid_credits > 0 (preserved balance).
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { updateProfile } from 'firebase/auth';
import {
  IconUser,
  IconMail,
  IconId,
  IconCopy,
  IconCheck,
  IconCrown,
  IconBolt,
  IconSparkles,
  IconTrash,
  IconLogout,
  IconChevronRight,
  IconRefresh,
  IconExternalLink,
} from '@tabler/icons-react-native';
import { BottomSheet } from '@/components/common/BottomSheet';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColors, spacing } from '@/theme';
import { updateUserProfile } from '@/services/userService';

// ── Subscription plan constants (mirrors website's subscriptionPlans.js) ──────
const PLAN_CONFIG = {
  free:  { displayName: 'Free Plan',  monthlyPrice: 0,    annualPrice: 0,     paidCredits: 0,      dailyCredits: 5000 },
  pro:   { displayName: 'Pro Plan',   monthlyPrice: 499,  annualPrice: 4990,  paidCredits: 30000,  dailyCredits: 5000 },
  max:   { displayName: 'Max Plan',   monthlyPrice: 1999, annualPrice: 19990, paidCredits: 150000, dailyCredits: 5000 },
} as const;

type PlanKey = keyof typeof PLAN_CONFIG;

function normalizePlan(plan?: string | null): PlanKey {
  const p = String(plan || 'free').toLowerCase();
  return (p in PLAN_CONFIG ? p : 'free') as PlanKey;
}

function getPlanConfig(plan?: string | null) {
  return PLAN_CONFIG[normalizePlan(plan)];
}

// ── Progress bar helper ────────────────────────────────────────────────────────
function CreditBar({
  used,
  total,
  color,
  colors,
}: {
  used: number;
  total: number;
  color: string;
  colors: any;
}) {
  const pct = total > 0 ? Math.min(1, (total - used) / total) : 0;
  return (
    <View style={[creditBarStyles.track, { backgroundColor: colors.surface2 }]}>
      <View style={[creditBarStyles.fill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: color }]} />
    </View>
  );
}

const creditBarStyles = StyleSheet.create({
  track: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 6 },
  fill:  { height: 4, borderRadius: 2 },
});

// ── Main component ─────────────────────────────────────────────────────────────
export const AccountSection: React.FC = () => {
  const colors = useThemeColors();
  const { currentUser, userProfile, logout, refreshProfile } = useAuth();

  // Profile edit
  const [displayName, setDisplayName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    const initialName = userProfile?.name || currentUser?.displayName || '';
    setDisplayName(initialName);
  }, [userProfile?.name, currentUser?.displayName]);

  const handleCopy = async (value: string, fieldName: string) => {
    if (!value) return;
    try {
      await Clipboard.setStringAsync(value);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  };

  const handleSaveDisplayName = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) { Alert.alert('Invalid Name', 'Display Name cannot be empty.'); return; }
    if (trimmed.length > 120) { Alert.alert('Too Long', 'Display Name must be 120 characters or less.'); return; }

    setIsSavingName(true);
    try {
      if (currentUser) {
        try { await updateProfile(currentUser, { displayName: trimmed }); await currentUser.reload(); }
        catch (fbErr) { console.warn('[AccountSection] Firebase updateProfile error:', fbErr); }
      }
      if (userProfile?.$id) { await updateUserProfile(userProfile.$id, { name: trimmed }); }
      await refreshProfile();
      Alert.alert('Success', 'Display name updated.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update Display Name.');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleRefreshProfile = async () => {
    setIsRefreshing(true);
    try { await refreshProfile(); }
    catch (e) { console.warn('[AccountSection] refresh failed', e); }
    finally { setIsRefreshing(false); }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText !== 'DELETE') {
      Alert.alert('Confirmation Required', 'Please type "DELETE" exactly to confirm.');
      return;
    }
    setIsDeletingAccount(true);
    try {
      setShowDeleteModal(false);
      setDeleteConfirmationText('');
      await logout();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to sign out.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // ── Subscription checkout state & handlers ──────────────────────────────────
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [isSubscribing, setIsSubscribing] = useState<string | null>(null);
  const [isSyncingPlan, setIsSyncingPlan] = useState<boolean>(false);

  const handleSubscribe = async (planType: 'pro' | 'max') => {
    const email = currentUser?.email || '';
    if (!email) {
      Alert.alert('Sign In Required', 'Please sign in to upgrade your subscription plan.');
      return;
    }

    setIsSubscribing(planType);
    const checkoutUrl = `https://chatboxai.co.in/pricing?plan=${planType}&cycle=${billingCycle}&email=${encodeURIComponent(email)}`;
    try {
      await Linking.openURL(checkoutUrl);
      setShowPlansModal(false);
      Alert.alert(
        'Complete on Website',
        `We've opened the ${planType.toUpperCase()} plan checkout on chatboxai.co.in in your browser.\n\nComplete your payment securely with Razorpay on the website. Once completed, return to the app and your updated subscription will automatically synchronize!`,
        [
          { text: 'Got it' },
          {
            text: 'Sync Plan Now',
            onPress: async () => {
              setIsSyncingPlan(true);
              try {
                await refreshProfile();
              } finally {
                setIsSyncingPlan(false);
              }
            },
          },
        ]
      );
    } catch {
      Alert.alert('Unable to Open Browser', 'Please visit https://chatboxai.co.in/pricing to upgrade your plan.');
    } finally {
      setIsSubscribing(null);
    }
  };

  // ── Derived credit data (mirrors website AccountSettings.jsx) ──────────────
  const resolvedPlan = normalizePlan(userProfile?.plan);
  const planConfig   = getPlanConfig(resolvedPlan);
  const isPro        = resolvedPlan === 'pro';
  const isMax        = resolvedPlan === 'max';
  const isPaidPlan   = isPro || isMax;

  // Two separate credit wallets — same field names as Appwrite users collection
  const dailyFreeCredits   = userProfile?.credits ?? 0;       // Resets 5,000/day for all plans
  const monthlyPaidCredits = userProfile?.paid_credits ?? 0;  // Pro: 30k, Max: 150k; preserved after expiry
  const paidResetAllocation = planConfig.paidCredits;         // 0 for free, 30000 pro, 150000 max
  const FREE_DAILY_ALLOCATION = 5000;

  // Show paid wallet row if user is on a paid plan OR still has a leftover paid balance
  const showPaidCredits = isPaidPlan || monthlyPaidCredits > 0;

  // Display values
  const userDisplayName = displayName || userProfile?.name || currentUser?.displayName || 'ChatBox AI User';
  const userEmail       = currentUser?.email || 'guest@example.com';
  const userUid         = currentUser?.uid || 'local-guest';
  const initials        = userDisplayName.charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      {/* ── USER PROFILE BANNER ────────────────────────────────────────────── */}
      <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <View style={[styles.avatarCircle, { backgroundColor: colors.accent }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        <View style={styles.profileInfoCol}>
          <Text style={[styles.profileName, { color: colors.ink }]} numberOfLines={1}>
            {userDisplayName}
          </Text>
          <Text style={[styles.profileEmail, { color: colors.ink2 }]} numberOfLines={1}>
            {userEmail}
          </Text>

          <View style={styles.tagRow}>
            <View style={[
              styles.planBadge,
              {
                backgroundColor: isPaidPlan ? 'rgba(139, 92, 246, 0.15)' : 'rgba(100, 116, 139, 0.12)',
                borderColor: isPaidPlan ? 'rgba(139, 92, 246, 0.3)' : colors.line,
              },
            ]}>
              <Text style={[styles.planBadgeText, { color: isPaidPlan ? colors.accent : colors.ink2 }]}>
                {planConfig.displayName.replace(' Plan', '').toUpperCase()}
              </Text>
            </View>

            <Pressable
              onPress={handleRefreshProfile}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
              accessibilityLabel="Refresh account data"
            >
              {isRefreshing
                ? <ActivityIndicator size={14} color={colors.ink3} />
                : <IconRefresh size={14} color={colors.ink3} strokeWidth={1.8} />
              }
            </Pressable>
          </View>
        </View>
      </View>

      {/* ── GROUP 1: ACCOUNT DETAILS ──────────────────────────────────────── */}
      <Text style={[styles.sectionHeading, { color: colors.ink3 }]}>Account Details</Text>

      <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        {/* Display Name */}
        <View style={styles.settingBlock}>
          <View style={styles.rowHeader}>
            <View style={[styles.iconBox, { backgroundColor: colors.surface2 }]}>
              <IconUser size={18} color={colors.ink} strokeWidth={1.8} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>Display Name</Text>
              <Text style={[styles.rowSubtitle, { color: colors.ink3 }]}>Visible across your account and chats</Text>
            </View>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Enter your name"
              placeholderTextColor={colors.ink3}
              style={[
                styles.nameInput,
                { backgroundColor: colors.surface2, borderColor: colors.line, color: colors.ink },
              ]}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleSaveDisplayName}
            />
            <Pressable
              onPress={handleSaveDisplayName}
              disabled={isSavingName}
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: colors.accent, opacity: isSavingName ? 0.6 : pressed ? 0.8 : 1 },
              ]}
            >
              {isSavingName
                ? <ActivityIndicator size="small" color="#ffffff" />
                : <Text style={styles.saveBtnText}>Save</Text>
              }
            </Pressable>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.line }]} />

        {/* Email */}
        <Pressable
          onPress={() => handleCopy(userEmail, 'email')}
          style={({ pressed }) => [styles.actionRow, pressed && { backgroundColor: colors.hover }]}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surface2 }]}>
            <IconMail size={18} color={colors.ink} strokeWidth={1.8} />
          </View>
          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.ink }]}>Email Address</Text>
            <Text style={[styles.rowSubtitle, { color: colors.ink3 }]} numberOfLines={1}>{userEmail}</Text>
          </View>
          <View style={styles.copyBadge}>
            {copiedField === 'email'
              ? <IconCheck size={16} color={colors.accent} strokeWidth={2.2} />
              : <IconCopy size={16} color={colors.ink3} strokeWidth={1.8} />
            }
          </View>
        </Pressable>

        <View style={[styles.divider, { backgroundColor: colors.line }]} />

        {/* UID */}
        <Pressable
          onPress={() => handleCopy(userUid, 'uid')}
          style={({ pressed }) => [styles.actionRow, pressed && { backgroundColor: colors.hover }]}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surface2 }]}>
            <IconId size={18} color={colors.ink} strokeWidth={1.8} />
          </View>
          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.ink }]}>User ID</Text>
            <Text style={[styles.rowSubtitle, { color: colors.ink3 }]} numberOfLines={1}>{userUid}</Text>
          </View>
          <View style={styles.copyBadge}>
            {copiedField === 'uid'
              ? <IconCheck size={16} color={colors.accent} strokeWidth={2.2} />
              : <IconCopy size={16} color={colors.ink3} strokeWidth={1.8} />
            }
          </View>
        </Pressable>
      </View>

      {/* ── GROUP 2: SUBSCRIPTION & CREDITS ──────────────────────────────── */}
      <Text style={[styles.sectionHeading, { color: colors.ink3 }]}>Subscription & Usage</Text>

      <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        {/* Active plan row */}
        <Pressable
          onPress={() => setShowPlansModal(true)}
          style={({ pressed }) => [styles.actionRow, pressed && { backgroundColor: colors.hover }]}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surface2 }]}>
            {isMax
              ? <IconSparkles size={18} color="#06b6d4" strokeWidth={1.8} />
              : isPro
                ? <IconCrown size={18} color="#f59e0b" strokeWidth={1.8} />
                : <IconBolt size={18} color={colors.ink} strokeWidth={1.8} />
            }
          </View>
          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.ink }]}>{planConfig.displayName}</Text>
            <Text style={[styles.rowSubtitle, { color: colors.ink3 }]}>
              {isMax
                ? 'Unlimited reasoning & priority compute'
                : isPro
                  ? 'Advanced models & higher limits'
                  : 'Free tier with 5,000 daily credits'
              }
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={[styles.planActionText, { color: colors.accent }]}>Plans</Text>
            <IconChevronRight size={16} color={colors.ink3} strokeWidth={1.8} />
          </View>
        </Pressable>

        <View style={[styles.divider, { backgroundColor: colors.line }]} />

        {/* ── Daily Free Credits (ALL plans get this) ── */}
        <View style={styles.creditRow}>
          <View style={[styles.iconBox, { backgroundColor: colors.surface2 }]}>
            <IconBolt size={18} color="#eab308" strokeWidth={1.8} />
          </View>
          <View style={styles.rowTextCol}>
            <View style={styles.creditLabelRow}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>
                {dailyFreeCredits.toLocaleString()}
              </Text>
              <Text style={[styles.creditOfLabel, { color: colors.ink3 }]}>
                {' '}/ {FREE_DAILY_ALLOCATION.toLocaleString()} free-model credits
              </Text>
            </View>
            <Text style={[styles.rowSubtitle, { color: colors.ink3 }]}>
              Resets to {FREE_DAILY_ALLOCATION.toLocaleString()} daily at midnight UTC
            </Text>
            <CreditBar
              used={FREE_DAILY_ALLOCATION - dailyFreeCredits}
              total={FREE_DAILY_ALLOCATION}
              color="#eab308"
              colors={colors}
            />
          </View>
        </View>

        {/* ── Monthly Paid Credits (Pro/Max only, OR preserved expired balance) ── */}
        {showPaidCredits && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.line }]} />
            <View style={styles.creditRow}>
              <View style={[styles.iconBox, { backgroundColor: colors.surface2 }]}>
                {isMax
                  ? <IconSparkles size={18} color="#06b6d4" strokeWidth={1.8} />
                  : <IconCrown size={18} color="#f59e0b" strokeWidth={1.8} />
                }
              </View>
              <View style={styles.rowTextCol}>
                <View style={styles.creditLabelRow}>
                  <Text style={[styles.rowTitle, { color: colors.ink }]}>
                    {monthlyPaidCredits.toLocaleString()}
                  </Text>
                  <Text style={[styles.creditOfLabel, { color: colors.ink3 }]}>
                    {paidResetAllocation > 0
                      ? ` / ${paidResetAllocation.toLocaleString()} paid-model credits`
                      : ' paid-model credits remaining'
                    }
                  </Text>
                </View>
                <Text style={[styles.rowSubtitle, { color: colors.ink3 }]}>
                  {isPaidPlan
                    ? `Resets to ${paidResetAllocation.toLocaleString()} each billing cycle`
                    : 'Preserved from previous subscription — available until balance reaches zero'
                  }
                </Text>
                {paidResetAllocation > 0 && (
                  <CreditBar
                    used={paidResetAllocation - monthlyPaidCredits}
                    total={paidResetAllocation}
                    color={isMax ? '#06b6d4' : '#f59e0b'}
                    colors={colors}
                  />
                )}
              </View>
            </View>
          </>
        )}
      </View>

      {/* ── GROUP 3: DANGER ZONE ─────────────────────────────────────────── */}
      <Text style={[styles.sectionHeading, { color: '#ef4444' }]}>Danger Zone</Text>

      <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: 'rgba(239, 68, 68, 0.25)' }]}>
        {/* Sign Out */}
        <Pressable
          onPress={() => {
            Alert.alert('Sign Out', 'Are you sure you want to sign out of ChatBox AI?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: logout },
            ]);
          }}
          style={({ pressed }) => [styles.actionRow, pressed && { backgroundColor: 'rgba(239, 68, 68, 0.08)' }]}
        >
          <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
            <IconLogout size={18} color="#ef4444" strokeWidth={1.8} />
          </View>
          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: '#ef4444' }]}>Sign Out</Text>
            <Text style={[styles.rowSubtitle, { color: colors.ink3 }]}>Log out of this device session</Text>
          </View>
          <IconChevronRight size={16} color={colors.ink3} strokeWidth={1.8} />
        </Pressable>

        <View style={[styles.divider, { backgroundColor: colors.line }]} />

        {/* Delete Account */}
        <Pressable
          onPress={() => setShowDeleteModal(true)}
          style={({ pressed }) => [styles.actionRow, pressed && { backgroundColor: 'rgba(239, 68, 68, 0.08)' }]}
        >
          <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
            <IconTrash size={18} color="#ef4444" strokeWidth={1.8} />
          </View>
          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: '#ef4444' }]}>Delete Account</Text>
            <Text style={[styles.rowSubtitle, { color: colors.ink3 }]}>Permanently erase account, history, and data</Text>
          </View>
          <IconChevronRight size={16} color={colors.ink3} strokeWidth={1.8} />
        </Pressable>
      </View>

      {/* ── BOTTOM SHEET: PLANS & PRICING ─────────────────────────────────── */}
      <BottomSheet
        visible={showPlansModal}
        onClose={() => setShowPlansModal(false)}
        title="Subscription Plans"
      >
        <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
          {/* Billing Cycle Toggle */}
          <View style={[styles.billingCycleRow, { backgroundColor: colors.surface2, borderColor: colors.line }]}>
            <Pressable
              onPress={() => setBillingCycle('monthly')}
              style={[
                styles.billingCyclePill,
                billingCycle === 'monthly' && { backgroundColor: colors.surface, borderColor: colors.line },
              ]}
            >
              <Text style={[styles.billingCycleText, { color: billingCycle === 'monthly' ? colors.ink : colors.ink3, fontWeight: billingCycle === 'monthly' ? '700' : '500' }]}>
                Monthly
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setBillingCycle('annual')}
              style={[
                styles.billingCyclePill,
                billingCycle === 'annual' && { backgroundColor: colors.surface, borderColor: colors.line },
              ]}
            >
              <Text style={[styles.billingCycleText, { color: billingCycle === 'annual' ? colors.accent : colors.ink3, fontWeight: billingCycle === 'annual' ? '700' : '500' }]}>
                Annual (Save 17%)
              </Text>
            </Pressable>
          </View>

          {/* Free Tier */}
          <View style={[styles.planTierCard, { backgroundColor: colors.surface2, borderColor: colors.line, marginTop: 12 }]}>
            <View style={styles.planTierHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <IconBolt size={15} color={colors.ink2} />
                <Text style={[styles.planTierName, { color: colors.ink }]}>Free Plan</Text>
                {resolvedPlan === 'free' && (
                  <View style={[styles.currentPlanChip, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                    <Text style={[styles.currentPlanChipText, { color: colors.ink3 }]}>Current</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.planTierPrice, { color: colors.ink }]}>₹0</Text>
            </View>
            <Text style={[styles.planTierDesc, { color: colors.ink3 }]}>
              5,000 daily free-model credits · Standard speed · 10 images/day
            </Text>
          </View>

          {/* Pro Tier */}
          <View style={[styles.planTierCard, {
            backgroundColor: colors.surface2,
            borderColor: isPro ? colors.accent : colors.line,
            marginTop: 10,
          }]}>
            <View style={styles.planTierHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <IconCrown size={15} color="#f59e0b" />
                <Text style={[styles.planTierName, { color: colors.ink }]}>Pro Plan</Text>
                {isPro && (
                  <View style={[styles.currentPlanChip, { backgroundColor: 'rgba(139,92,246,0.1)', borderColor: colors.accent }]}>
                    <Text style={[styles.currentPlanChipText, { color: colors.accent }]}>Active</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.planTierPrice, { color: colors.accent }]}>
                {billingCycle === 'annual' ? '₹4,990/yr' : '₹499/mo'}
              </Text>
            </View>
            <Text style={[styles.planTierDesc, { color: colors.ink3 }]}>
              30,000 paid-model credits · Advanced models (DeepSeek, Claude) · Unlimited images
            </Text>

            {!isPro && (
              <Pressable
                onPress={() => handleSubscribe('pro')}
                disabled={isSubscribing === 'pro'}
                style={({ pressed }) => [
                  styles.planUpgradeBtn,
                  { backgroundColor: colors.accent, opacity: isSubscribing === 'pro' ? 0.6 : pressed ? 0.8 : 1 },
                ]}
              >
                {isSubscribing === 'pro' ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.planUpgradeBtnText}>
                    Upgrade to Pro ({billingCycle === 'annual' ? '₹4,990/yr' : '₹499/mo'})
                  </Text>
                )}
              </Pressable>
            )}
          </View>

          {/* Max Tier */}
          <View style={[styles.planTierCard, {
            backgroundColor: colors.surface2,
            borderColor: isMax ? '#06b6d4' : colors.line,
            marginTop: 10,
            marginBottom: 8,
          }]}>
            <View style={styles.planTierHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <IconSparkles size={15} color="#06b6d4" />
                <Text style={[styles.planTierName, { color: colors.ink }]}>Max Plan</Text>
                {isMax && (
                  <View style={[styles.currentPlanChip, { backgroundColor: 'rgba(6,182,212,0.1)', borderColor: '#06b6d4' }]}>
                    <Text style={[styles.currentPlanChipText, { color: '#06b6d4' }]}>Active</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.planTierPrice, { color: '#06b6d4' }]}>
                {billingCycle === 'annual' ? '₹19,990/yr' : '₹1,999/mo'}
              </Text>
            </View>
            <Text style={[styles.planTierDesc, { color: colors.ink3 }]}>
              150,000 paid-model credits · Highest priority · Full API access · Early beta features
            </Text>

            {!isMax && (
              <Pressable
                onPress={() => handleSubscribe('max')}
                disabled={isSubscribing === 'max'}
                style={({ pressed }) => [
                  styles.planUpgradeBtn,
                  { backgroundColor: '#06b6d4', opacity: isSubscribing === 'max' ? 0.6 : pressed ? 0.8 : 1 },
                ]}
              >
                {isSubscribing === 'max' ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.planUpgradeBtnText}>
                    Upgrade to Max ({billingCycle === 'annual' ? '₹19,990/yr' : '₹1,999/mo'})
                  </Text>
                )}
              </Pressable>
            )}
            {/* Sync Plan Status Button */}
            <Pressable
              onPress={async () => {
                setIsSyncingPlan(true);
                try {
                  const updated = await refreshProfile();
                  Alert.alert('Plan Synchronized', `Your account is active on the ${(updated?.plan || userProfile?.plan || 'free').toUpperCase()} Plan.`);
                } finally {
                  setIsSyncingPlan(false);
                }
              }}
              disabled={isSyncingPlan}
              style={({ pressed }) => [
                styles.syncPlanBtn,
                { borderColor: colors.line, backgroundColor: colors.surface },
                pressed && { opacity: 0.75 },
              ]}
            >
              {isSyncingPlan ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <IconRefresh size={15} color={colors.accent} />
                  <Text style={[styles.syncPlanBtnText, { color: colors.accent }]}>
                    Sync Subscription Status
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </BottomSheet>

      {/* ── BOTTOM SHEET: DELETE ACCOUNT ──────────────────────────────────── */}
      <BottomSheet
        visible={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteConfirmationText(''); }}
        title="Delete Account"
      >
        <View style={{ paddingVertical: spacing.xs }}>
          <Text style={[styles.deleteWarningText, { color: colors.ink }]}>
            This action is permanent and cannot be undone. All your chat history, memory preferences, and API keys will be immediately deleted.
          </Text>

          <Text style={[styles.deletePromptText, { color: colors.ink2 }]}>
            Type <Text style={{ color: '#ef4444', fontWeight: '700' }}>DELETE</Text> to confirm:
          </Text>

          <TextInput
            value={deleteConfirmationText}
            onChangeText={setDeleteConfirmationText}
            placeholder="DELETE"
            placeholderTextColor={colors.ink3}
            autoCapitalize="characters"
            style={[
              styles.deleteInput,
              {
                backgroundColor: colors.surface2,
                borderColor: deleteConfirmationText === 'DELETE' ? '#ef4444' : colors.line,
                color: colors.ink,
              },
            ]}
          />

          <Pressable
            onPress={handleDeleteAccount}
            disabled={deleteConfirmationText !== 'DELETE' || isDeletingAccount}
            style={({ pressed }) => [
              styles.deleteConfirmBtn,
              {
                backgroundColor: '#ef4444',
                opacity: deleteConfirmationText !== 'DELETE' || isDeletingAccount ? 0.4 : pressed ? 0.8 : 1,
              },
            ]}
          >
            {isDeletingAccount
              ? <ActivityIndicator size="small" color="#ffffff" />
              : <Text style={styles.deleteConfirmBtnText}>Permanently Delete Account</Text>
            }
          </Pressable>
        </View>
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingBottom: spacing.lg,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  profileInfoCol: { flex: 1, marginLeft: 14 },
  profileName: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  profileEmail: { fontSize: 13, marginTop: 2 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  planBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  planBadgeText: { fontSize: 11, fontWeight: '600' },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  groupCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  settingBlock: { padding: spacing.md },
  actionRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  creditRow: { flexDirection: 'row', alignItems: 'flex-start', padding: spacing.md },
  rowHeader: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rowTextCol: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '500', letterSpacing: -0.2 },
  rowSubtitle: { fontSize: 12.5, marginTop: 2, lineHeight: 16 },
  creditLabelRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  creditOfLabel: { fontSize: 12.5 },
  divider: { height: 1, marginLeft: 56 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  nameInput: { flex: 1, height: 42, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 14 },
  saveBtn: { height: 42, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  copyBadge: { padding: 6 },
  planActionText: { fontSize: 13, fontWeight: '500' },
  planTierCard: { borderRadius: 12, borderWidth: 1, padding: spacing.md },
  planTierHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  planTierName: { fontSize: 15, fontWeight: '600' },
  planTierPrice: { fontSize: 14, fontWeight: '700' },
  planTierDesc: { fontSize: 12.5, lineHeight: 17 },
  currentPlanChip: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, borderWidth: 1 },
  currentPlanChipText: { fontSize: 10, fontWeight: '600' },
  deleteWarningText: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  deletePromptText: { fontSize: 13, marginBottom: 8 },
  deleteInput: { height: 44, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 14, marginBottom: 14 },
  deleteConfirmBtn: { height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  deleteConfirmBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  billingCycleRow: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
  },
  billingCyclePill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  billingCycleText: {
    fontSize: 12,
  },
  planUpgradeBtn: {
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  planUpgradeBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  syncPlanBtn: {
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  syncPlanBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
