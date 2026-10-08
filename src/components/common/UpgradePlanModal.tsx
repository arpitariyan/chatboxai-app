/**
 * src/components/common/UpgradePlanModal.tsx
 *
 * Professional Plan Upgrade Modal for ChatBox AI APK.
 * Matches design and pricing rules from website:
 * - Free: 5,000 daily credits, basic models only, 10 images/day, 5 deep research/week
 * - Pro: ₹499/mo (₹4,990/yr) -> 30,000 paid credits, all Pro models unlocked, unlimited images, 15 research/week
 * - Max: ₹1,999/mo (₹19,990/yr) -> 150,000 paid credits, all frontier models unlocked, unlimited images, 25 research/week
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconX,
  IconCheck,
  IconCrown,
  IconBolt,
  IconSparkles,
  IconShieldCheck,
  IconPhoto,
  IconSearch,
  IconExternalLink,
  IconRefresh,
} from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius, typography } from '@/theme';
import { useAuth } from '@/contexts/AuthContext';
import { SUBSCRIPTION_PLANS, PlanKey, normalizePlan } from '@/config/subscriptionPlans';

interface UpgradePlanModalProps {
  visible: boolean;
  onClose: () => void;
  targetFeatureName?: string;
  recommendedPlan?: 'pro' | 'max';
  onSuccess?: () => void;
}

export const UpgradePlanModal: React.FC<UpgradePlanModalProps> = ({
  visible,
  onClose,
  targetFeatureName,
  recommendedPlan = 'pro',
  onSuccess,
}) => {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { currentUser, userProfile, refreshProfile } = useAuth();

  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'max'>(recommendedPlan);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isAwaitingWebsitePayment, setIsAwaitingWebsitePayment] = useState<boolean>(false);

  useEffect(() => {
    if (!visible) {
      setIsAwaitingWebsitePayment(false);
      setIsVerifying(false);
    }
  }, [visible]);

  // When user returns to the app and userProfile is refreshed by AppState or manual sync,
  // automatically detect if the target plan was activated and celebrate!
  useEffect(() => {
    if (visible && isAwaitingWebsitePayment && userProfile?.plan) {
      const curPlan = normalizePlan(userProfile.plan);
      if (curPlan === selectedPlan || (selectedPlan === 'pro' && curPlan === 'max')) {
        setIsAwaitingWebsitePayment(false);
        Alert.alert(
          'Subscription Activated! 🎉',
          `Welcome to ChatBox AI ${curPlan.toUpperCase()}! Your premium models and credits are now unlocked.`,
          [
            {
              text: 'Awesome',
              onPress: () => {
                onClose();
                onSuccess?.();
              },
            },
          ]
        );
      }
    }
  }, [userProfile?.plan, visible, isAwaitingWebsitePayment, selectedPlan, onClose, onSuccess]);

  const handleStartUpgrade = async (planToUpgrade: 'pro' | 'max') => {
    if (!currentUser?.email) {
      Alert.alert('Sign In Required', 'Please sign in to upgrade your subscription plan.');
      return;
    }

    setIsRedirecting(true);
    try {
      const targetUrl = `https://chatboxai.co.in/pricing?plan=${planToUpgrade}&cycle=${billingCycle}&email=${encodeURIComponent(currentUser.email)}`;
      await Linking.openURL(targetUrl);
      setIsAwaitingWebsitePayment(true);
    } catch (err: any) {
      Alert.alert('Unable to Open Browser', err?.message || 'Please open https://chatboxai.co.in in your browser.');
    } finally {
      setIsRedirecting(false);
    }
  };

  const handleCheckSyncStatus = async () => {
    setIsVerifying(true);
    try {
      const updated = await refreshProfile();
      const currentPlan = normalizePlan(updated?.plan || userProfile?.plan);

      if (currentPlan === selectedPlan || (selectedPlan === 'pro' && currentPlan === 'max')) {
        setIsAwaitingWebsitePayment(false);
        Alert.alert(
          'Subscription Activated! 🎉',
          `Welcome to ChatBox AI ${currentPlan.toUpperCase()}! Your premium models and credits are now unlocked.`,
          [
            {
              text: 'Awesome',
              onPress: () => {
                onClose();
                onSuccess?.();
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Verification in Progress',
          'Your updated plan was not detected yet. If you just completed checkout on chatboxai.co.in, please allow a moment for the website to confirm, then tap again.',
          [{ text: 'OK' }]
        );
      }
    } catch (err: any) {
      Alert.alert('Sync Notice', 'Could not refresh account at this moment. Please check your internet connection.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.isDark ? '#131316' : colors.surface,
                borderColor: colors.line,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.line }]}>
              <View style={styles.headerIconWrapper}>
                <IconCrown size={22} color="#f59e0b" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.headerTitle, { color: colors.ink }]}>
                  {targetFeatureName ? `Unlock ${targetFeatureName}` : 'Upgrade Your Plan'}
                </Text>
                <Text style={[styles.headerSubtitle, { color: colors.ink3 }]}>
                  Get high-speed compute, premium models & unlimited tools
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.closeBtn,
                  { backgroundColor: colors.isDark ? '#1f1f23' : colors.surface2 },
                  pressed && { opacity: 0.6 },
                ]}
                onPress={onClose}
              >
                <IconX size={20} color={colors.ink3} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              {/* Billing Cycle Toggle */}
              <View style={[styles.cycleToggleContainer, { backgroundColor: colors.isDark ? '#1c1c20' : colors.surface2 }]}>
                <Pressable
                  style={[
                    styles.cycleTab,
                    billingCycle === 'monthly' && [styles.cycleTabActive, { backgroundColor: colors.isDark ? '#2b2b32' : colors.surface }],
                  ]}
                  onPress={() => setBillingCycle('monthly')}
                >
                  <Text
                    style={[
                      styles.cycleTabText,
                      { color: billingCycle === 'monthly' ? colors.ink : colors.ink3 },
                      billingCycle === 'monthly' && styles.cycleTabTextActive,
                    ]}
                  >
                    Monthly
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.cycleTab,
                    billingCycle === 'annual' && [styles.cycleTabActive, { backgroundColor: colors.isDark ? '#2b2b32' : colors.surface }],
                  ]}
                  onPress={() => setBillingCycle('annual')}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text
                      style={[
                        styles.cycleTabText,
                        { color: billingCycle === 'annual' ? colors.ink : colors.ink3 },
                        billingCycle === 'annual' && styles.cycleTabTextActive,
                      ]}
                    >
                      Annual
                    </Text>
                    <View style={styles.savingsBadge}>
                      <Text style={styles.savingsBadgeText}>SAVE 17%</Text>
                    </View>
                  </View>
                </Pressable>
              </View>

              {/* Pro Plan Card */}
              <Pressable
                style={[
                  styles.planCard,
                  {
                    backgroundColor: selectedPlan === 'pro'
                      ? (colors.isDark ? '#161922' : '#eff6ff')
                      : (colors.isDark ? '#18181c' : colors.surface2),
                    borderColor: selectedPlan === 'pro' ? '#3b82f6' : colors.line,
                  },
                ]}
                onPress={() => setSelectedPlan('pro')}
              >
                <View style={styles.planCardTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.planIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                      <IconBolt size={18} color="#3b82f6" />
                    </View>
                    <View style={{ marginLeft: 10 }}>
                      <Text style={[styles.planName, { color: colors.ink }]}>Pro Plan</Text>
                      <Text style={[styles.planDesc, { color: colors.ink3 }]}>Best for daily power users & developers</Text>
                    </View>
                  </View>
                  {selectedPlan === 'pro' && (
                    <View style={styles.activeCheck}>
                      <IconCheck size={14} color="#ffffff" />
                    </View>
                  )}
                </View>

                <View style={styles.pricingRow}>
                  <Text style={[styles.priceSymbol, { color: colors.ink }]}>₹</Text>
                  <Text style={[styles.priceAmount, { color: colors.ink }]}>
                    {billingCycle === 'annual' ? '4,990' : '499'}
                  </Text>
                  <Text style={[styles.pricePeriod, { color: colors.ink3 }]}>
                    /{billingCycle === 'annual' ? 'year' : 'month'}
                  </Text>
                </View>

                <View style={[styles.featureList, { borderTopColor: colors.line }]}>
                  <View style={styles.featureItem}>
                    <IconCheck size={15} color="#10b981" />
                    <Text style={[styles.featureText, { color: colors.ink2 }]}>
                      <Text style={[styles.boldText, { color: colors.ink }]}>30,000</Text> Paid Credits/month (all models)
                    </Text>
                  </View>
                  <View style={styles.featureItem}>
                    <IconCheck size={15} color="#10b981" />
                    <Text style={[styles.featureText, { color: colors.ink2 }]}>
                      <Text style={[styles.boldText, { color: colors.ink }]}>5,000</Text> Daily Free Credits included
                    </Text>
                  </View>
                  <View style={styles.featureItem}>
                    <IconPhoto size={15} color="#10b981" />
                    <Text style={[styles.featureText, { color: colors.ink2 }]}>
                      <Text style={[styles.boldText, { color: colors.ink }]}>Unlimited</Text> AI Image Generation
                    </Text>
                  </View>
                  <View style={styles.featureItem}>
                    <IconSearch size={15} color="#10b981" />
                    <Text style={[styles.featureText, { color: colors.ink2 }]}>
                      <Text style={[styles.boldText, { color: colors.ink }]}>15</Text> Deep Research uses / week
                    </Text>
                  </View>
                  <View style={styles.featureItem}>
                    <IconSparkles size={15} color="#10b981" />
                    <Text style={[styles.featureText, { color: colors.ink2 }]}>Claude 3.7, Claude 4.5, GPT-5 unlocked</Text>
                  </View>
                </View>
              </Pressable>

              {/* Max Plan Card */}
              <Pressable
                style={[
                  styles.planCard,
                  {
                    backgroundColor: selectedPlan === 'max'
                      ? (colors.isDark ? '#1a1624' : '#faf5ff')
                      : (colors.isDark ? '#18181c' : colors.surface2),
                    borderColor: selectedPlan === 'max' ? '#8b5cf6' : colors.line,
                  },
                ]}
                onPress={() => setSelectedPlan('max')}
              >
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeText}>MAX POWER</Text>
                </View>

                <View style={styles.planCardTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.planIcon, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                      <IconCrown size={18} color="#a855f7" />
                    </View>
                    <View style={{ marginLeft: 10 }}>
                      <Text style={[styles.planName, { color: colors.ink }]}>Max Plan</Text>
                      <Text style={[styles.planDesc, { color: colors.ink3 }]}>Flagship frontier reasoning & max compute</Text>
                    </View>
                  </View>
                  {selectedPlan === 'max' && (
                    <View style={[styles.activeCheck, { backgroundColor: '#8b5cf6' }]}>
                      <IconCheck size={14} color="#ffffff" />
                    </View>
                  )}
                </View>

                <View style={styles.pricingRow}>
                  <Text style={[styles.priceSymbol, { color: colors.ink }]}>₹</Text>
                  <Text style={[styles.priceAmount, { color: colors.ink }]}>
                    {billingCycle === 'annual' ? '19,990' : '1,999'}
                  </Text>
                  <Text style={[styles.pricePeriod, { color: colors.ink3 }]}>
                    /{billingCycle === 'annual' ? 'year' : 'month'}
                  </Text>
                </View>

                <View style={[styles.featureList, { borderTopColor: colors.line }]}>
                  <View style={styles.featureItem}>
                    <IconCheck size={15} color="#8b5cf6" />
                    <Text style={[styles.featureText, { color: colors.ink2 }]}>
                      <Text style={[styles.boldText, { color: colors.ink }]}>150,000</Text> Paid Credits/month
                    </Text>
                  </View>
                  <View style={styles.featureItem}>
                    <IconCheck size={15} color="#8b5cf6" />
                    <Text style={[styles.featureText, { color: colors.ink2 }]}>
                      Claude Opus 4.7 & GPT-5.6 Sol unlocked
                    </Text>
                  </View>
                  <View style={styles.featureItem}>
                    <IconPhoto size={15} color="#8b5cf6" />
                    <Text style={[styles.featureText, { color: colors.ink2 }]}>
                      <Text style={[styles.boldText, { color: colors.ink }]}>Unlimited</Text> Image Gen (Fast Priority)
                    </Text>
                  </View>
                  <View style={styles.featureItem}>
                    <IconSearch size={15} color="#8b5cf6" />
                    <Text style={[styles.featureText, { color: colors.ink2 }]}>
                      <Text style={[styles.boldText, { color: colors.ink }]}>25</Text> Deep Research uses / week
                    </Text>
                  </View>
                  <View style={styles.featureItem}>
                    <IconShieldCheck size={15} color="#8b5cf6" />
                    <Text style={[styles.featureText, { color: colors.ink2 }]}>Highest speed tier & zero throttling</Text>
                  </View>
                </View>
              </Pressable>

              {/* Action Button & Verification UX */}
              {isAwaitingWebsitePayment ? (
                <View style={styles.awaitingSection}>
                  <View
                    style={[
                      styles.awaitingCard,
                      {
                        backgroundColor: colors.surface2,
                        borderColor: selectedPlan === 'max' ? '#8b5cf6' : '#3b82f6',
                      },
                    ]}
                  >
                    <View style={styles.awaitingHeader}>
                      <IconExternalLink size={18} color={selectedPlan === 'max' ? '#8b5cf6' : '#3b82f6'} />
                      <Text style={[styles.awaitingTitle, { color: colors.ink }]}>
                        Checkout opened on chatboxai.co.in
                      </Text>
                    </View>
                    <Text style={[styles.awaitingDesc, { color: colors.ink2 }]}>
                      Complete your purchase securely with Razorpay on the website. Once finished, return here and tap the button below to verify and unlock your plan.
                    </Text>
                  </View>

                  {/* Primary Verify Button */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.ctaButton,
                      { backgroundColor: '#10b981' },
                      pressed && { opacity: 0.85 },
                      isVerifying && { opacity: 0.7 },
                    ]}
                    disabled={isVerifying}
                    onPress={handleCheckSyncStatus}
                  >
                    {isVerifying ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                        <IconRefresh size={18} color="#ffffff" style={{ marginRight: 6 }} />
                        <Text style={styles.ctaButtonText}>Verify & Sync Subscription</Text>
                      </View>
                    )}
                  </Pressable>

                  {/* Secondary Re-open Button */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.secondaryCtaButton,
                      { borderColor: colors.line, backgroundColor: colors.surface },
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => handleStartUpgrade(selectedPlan)}
                  >
                    <Text style={[styles.secondaryCtaText, { color: colors.ink2 }]}>
                      Reopen Website Checkout
                    </Text>
                  </Pressable>
                </View>
              ) : (
                /* Primary Upgrade CTA Button */
                <Pressable
                  style={({ pressed }) => [
                    styles.ctaButton,
                    selectedPlan === 'max' && { backgroundColor: '#8b5cf6' },
                    pressed && { opacity: 0.85 },
                    isRedirecting && { opacity: 0.7 },
                  ]}
                  disabled={isRedirecting}
                  onPress={() => handleStartUpgrade(selectedPlan)}
                >
                  {isRedirecting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={styles.ctaButtonText}>
                        Upgrade to {selectedPlan === 'max' ? 'Max' : 'Pro'} — ₹
                        {selectedPlan === 'max'
                          ? billingCycle === 'annual'
                            ? '19,990/yr'
                            : '1,999/mo'
                          : billingCycle === 'annual'
                          ? '4,990/yr'
                          : '499/mo'}
                      </Text>
                      <IconExternalLink size={16} color="#ffffff" style={{ marginLeft: 6 }} />
                    </View>
                  )}
                </Pressable>
              )}

              {/* Guarantee info */}
              <View style={styles.securityRow}>
                <IconShieldCheck size={14} color={colors.ink3} />
                <Text style={[styles.securityText, { color: colors.ink3 }]}>
                  Secure checkout on chatboxai.co.in • Instant sync with mobile APK
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#202024',
  },
  headerIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#1f1f23',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  cycleToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#1c1c20',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  cycleTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  cycleTabActive: {
    backgroundColor: '#2b2b32',
  },
  cycleTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9ca3af',
  },
  cycleTabTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  savingsBadge: {
    marginLeft: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  savingsBadgeText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '700',
  },
  planCard: {
    backgroundColor: '#18181c',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#26262d',
    padding: 16,
    marginBottom: 14,
    position: 'relative',
  },
  planCardSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#161922',
  },
  planCardSelectedMax: {
    borderColor: '#8b5cf6',
    backgroundColor: '#1a1624',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  popularBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  planCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  planDesc: {
    fontSize: 12,
    color: '#8b8b93',
    marginTop: 1,
  },
  activeCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pricingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 12,
    marginBottom: 12,
  },
  priceSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  priceAmount: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    marginLeft: 2,
  },
  pricePeriod: {
    fontSize: 12,
    color: '#9ca3af',
    marginLeft: 4,
  },
  featureList: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#232328',
    paddingTop: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 12.5,
    color: '#d1d5db',
    marginLeft: 8,
    flex: 1,
  },
  boldText: {
    fontWeight: '700',
    color: '#ffffff',
  },
  ctaButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  ctaButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  securityText: {
    fontSize: 11,
    color: '#6b7280',
    marginLeft: 5,
  },
  awaitingSection: {
    marginBottom: 8,
  },
  awaitingCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  awaitingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  awaitingTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  awaitingDesc: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  secondaryCtaButton: {
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  secondaryCtaText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
