/**
 * src/components/chat/DeepResearchLimitSheet.tsx
 *
 * Bottom sheet displayed when a user reaches their weekly Deep Research limit.
 * Provides quota breakdown, Sunday UTC reset countdown, and upgrade option.
 */

import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { IconFlask, IconCalendarTime, IconArrowUpRight } from '@tabler/icons-react-native';
import { BottomSheet } from '@/components/common/BottomSheet';
import { useResearchStore } from '@/stores/useResearchStore';
import { useThemeColors, spacing, radius, typography } from '@/theme';

interface DeepResearchLimitSheetProps {
  onUpgradePress?: () => void;
}

export const DeepResearchLimitSheet: React.FC<DeepResearchLimitSheetProps> = ({
  onUpgradePress,
}) => {
  const colors = useThemeColors();
  const { isLimitSheetVisible, closeLimitSheet, quota } = useResearchStore();

  const planName = (quota?.plan || 'free').toUpperCase();
  const weeklyLimit = quota?.weeklyLimit ?? 5;
  const weeklyCount = quota?.weeklyCount ?? weeklyLimit;

  // Calculate formatted reset day
  let resetText = 'Resets automatically every Sunday at 00:00 UTC';
  if (quota?.resetsAt) {
    try {
      const resetDate = new Date(quota.resetsAt);
      resetText = `Resets on Sunday, ${resetDate.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })} (00:00 UTC)`;
    } catch (_) {}
  }

  return (
    <BottomSheet
      visible={isLimitSheetVisible}
      onClose={closeLimitSheet}
      title="Deep Research Limit"
    >
      <View style={styles.container}>
        {/* Header Icon + Banner */}
        <View style={styles.headerBox}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
            <IconFlask size={26} color="#f59e0b" />
          </View>
          <Text style={[styles.title, { color: colors.ink }]}>
            Weekly Allowance Reached
          </Text>
          <Text style={[styles.subtitle, { color: colors.ink2 }]}>
            You have used all {weeklyLimit} Deep Research queries included in your {planName} plan for this week.
          </Text>
        </View>

        {/* Quota Progress Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.inset, borderColor: colors.line },
          ]}
        >
          <View style={styles.cardRow}>
            <Text style={[styles.cardLabel, { color: colors.ink2 }]}>Current Plan</Text>
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>{planName} PLAN</Text>
            </View>
          </View>

          <View style={styles.cardRow}>
            <Text style={[styles.cardLabel, { color: colors.ink2 }]}>Usage this week</Text>
            <Text style={[styles.cardValue, { color: colors.ink }]}>
              {weeklyCount} / {weeklyLimit} used
            </Text>
          </View>

          {/* Full progress bar */}
          <View style={[styles.progressBarTrack, { backgroundColor: colors.line }]}>
            <View style={styles.progressBarFill} />
          </View>

          <View style={styles.resetRow}>
            <IconCalendarTime size={15} color={colors.ink2} />
            <Text style={[styles.resetText, { color: colors.ink2 }]}>
              {resetText}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonStack}>
          {planName !== 'MAX' && (
            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={() => {
                closeLimitSheet();
                onUpgradePress?.();
              }}
            >
              <Text style={styles.primaryBtnText}>Upgrade Plan for Higher Limits</Text>
              <IconArrowUpRight size={18} color="#ffffff" />
            </Pressable>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.secondaryBtn,
              { backgroundColor: colors.surface, borderColor: colors.line },
              { opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={closeLimitSheet}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.ink }]}>
              Continue with Standard Web Search
            </Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  headerBox: {
    alignItems: 'center',
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs + 4,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
  },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  cardValue: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  planBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  planBadgeText: {
    color: '#60a5fa',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 2,
  },
  progressBarFill: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f59e0b',
    borderRadius: 3,
  },
  resetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  resetText: {
    fontSize: 11,
  },
  buttonStack: {
    gap: spacing.xs + 2,
    marginTop: spacing.xs,
  },
  primaryBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3b82f6',
    borderRadius: radius.md,
    paddingVertical: 13,
    minHeight: 48,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  secondaryBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    minHeight: 48,
  },
  secondaryBtnText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
});
