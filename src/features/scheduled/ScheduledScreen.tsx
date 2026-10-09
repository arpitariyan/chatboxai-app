import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconArrowLeft,
  IconClock,
  IconSun,
  IconCalendarEvent,
  IconBellRinging,
  IconBolt,
  IconSparkles,
} from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius, typography } from '@/theme';

interface ScheduledScreenProps {
  onBack: () => void;
}

export const ScheduledScreen: React.FC<ScheduledScreenProps> = React.memo(({ onBack }) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const previewScheduledFeatures = [
    {
      id: 'daily-briefing',
      icon: IconSun,
      title: 'Daily Morning AI Briefings',
      desc: 'Wake up to a synthesized digest of global market highlights, your calendar agenda, and top news delivered automatically.',
      badge: 'Planned',
    },
    {
      id: 'recurring-research',
      icon: IconCalendarEvent,
      title: 'Recurring Deep Research',
      desc: 'Schedule weekly competitor tracking, sector analysis, or literature reviews executed in the background without manual prompting.',
      badge: 'Planned',
    },
    {
      id: 'smart-reminders',
      icon: IconBellRinging,
      title: 'Smart Contextual Reminders',
      desc: 'Set AI-prompted follow-ups that draft emails, generate weekly code check-ins, or review task backlogs at chosen intervals.',
      badge: 'Planned',
    },
    {
      id: 'background-routines',
      icon: IconBolt,
      title: 'Autonomous Background Tasks',
      desc: 'Run multi-stage reasoning routines on an hourly or daily schedule with output saved directly to your Library.',
      badge: 'Planned',
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Top Header with Back Button ── */}
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

          <View style={styles.titleContainer} pointerEvents="none">
            <Text style={[styles.headerTitle, { color: colors.ink }]}>Scheduled</Text>
          </View>

          {/* Symmetrical balance spacer */}
          <View style={{ width: 38 }} />
        </View>
      </View>

      {/* ── Main Scroll Content ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Banner */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.line,
            },
          ]}
        >
          <View
            style={[
              styles.heroIconCircle,
              {
                backgroundColor: colors.isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)',
                borderColor: colors.isDark ? 'rgba(245, 158, 11, 0.25)' : 'rgba(245, 158, 11, 0.2)',
              },
            ]}
          >
            <IconClock size={36} color="#f59e0b" strokeWidth={1.8} />
          </View>

          <View
            style={[
              styles.badgePill,
              {
                backgroundColor: colors.surface2,
                borderColor: colors.line,
              },
            ]}
          >
            <IconSparkles size={12} color="#f59e0b" style={{ marginRight: 5 }} />
            <Text style={[styles.badgeText, { color: '#f59e0b' }]}>
              COMING SOON
            </Text>
          </View>

          <Text style={[styles.heroTitle, { color: colors.ink }]}>
            Scheduled Tasks & Actions
          </Text>

          <Text style={[styles.heroSubtitle, { color: colors.ink2 }]}>
            Automate recurring conversations, set scheduled research prompts, and receive proactive morning updates powered by ChatBox AI.
          </Text>
        </View>

        {/* Section Heading */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.ink3 }]}>
            UPCOMING CAPABILITIES
          </Text>
        </View>

        {/* Feature Cards List */}
        <View style={styles.cardsList}>
          {previewScheduledFeatures.map((feature) => {
            const IconComponent = feature.icon;
            return (
              <View
                key={feature.id}
                style={[
                  styles.featureCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.line,
                  },
                ]}
              >
                <View style={styles.featureCardHeader}>
                  <View
                    style={[
                      styles.featureIconBox,
                      {
                        backgroundColor: colors.surface2,
                        borderColor: colors.line,
                      },
                    ]}
                  >
                    <IconComponent size={20} color={colors.ink} strokeWidth={1.8} />
                  </View>

                  <View style={styles.featureTitleCol}>
                    <Text style={[styles.featureTitle, { color: colors.ink }]}>
                      {feature.title}
                    </Text>
                    <View
                      style={[
                        styles.featureBadge,
                        {
                          backgroundColor: colors.surface2,
                          borderColor: colors.line,
                        },
                      ]}
                    >
                      <Text style={[styles.featureBadgeText, { color: colors.ink3 }]}>
                        {feature.badge}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={[styles.featureDesc, { color: colors.ink2 }]}>
                  {feature.desc}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Info Notice Box */}
        <View
          style={[
            styles.noticeCard,
            {
              backgroundColor: colors.surface2,
              borderColor: colors.line,
            },
          ]}
        >
          <Text style={[styles.noticeText, { color: colors.ink3 }]}>
            Automated schedule workflows are being tuned for battery efficiency and background reliability. You will be able to create, pause, and review schedules anytime from this screen.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    width: '100%',
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  heroCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderCurve: radius.borderCurve,
  },
  heroIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  heroSubtitle: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 300,
  },
  sectionHeader: {
    marginBottom: spacing.xs + 2,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.8,
  },
  cardsList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  featureCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    borderCurve: radius.borderCurve,
  },
  featureCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  featureIconBox: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm + 2,
  },
  featureTitleCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featureTitle: {
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: -0.2,
    flex: 1,
    marginRight: 8,
  },
  featureBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  featureBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  featureDesc: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 2,
  },
  noticeCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    borderCurve: radius.borderCurve,
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
});
