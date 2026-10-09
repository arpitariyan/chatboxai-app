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
  IconPuzzle,
  IconWorld,
  IconCode,
  IconFileSpreadsheet,
  IconApiApp,
  IconSparkles,
} from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius, typography } from '@/theme';

interface PluginsScreenProps {
  onBack: () => void;
}

export const PluginsScreen: React.FC<PluginsScreenProps> = React.memo(({ onBack }) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const previewPlugins = [
    {
      id: 'web-browsing',
      icon: IconWorld,
      title: 'Live Web Browsing & Search',
      desc: 'Connect to live search engines, fetch real-time news, weather, and reference web pages directly in conversation.',
      badge: 'Integrated',
    },
    {
      id: 'code-sandbox',
      icon: IconCode,
      title: 'Python Code Sandbox',
      desc: 'Execute Python scripts, perform math & data analysis, and render visual plots in a secure runtime.',
      badge: 'Planned',
    },
    {
      id: 'doc-parser',
      icon: IconFileSpreadsheet,
      title: 'Advanced Doc & Sheet Extractor',
      desc: 'Analyze massive multi-sheet Excel files, complex PDF tables, and developer repositories.',
      badge: 'Planned',
    },
    {
      id: 'api-webhooks',
      icon: IconApiApp,
      title: 'Custom API & Webhook Actions',
      desc: 'Trigger external REST endpoints, zap automations, and sync with your custom internal backend services.',
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
            <Text style={[styles.headerTitle, { color: colors.ink }]}>Plugins</Text>
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
                backgroundColor: colors.isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)',
                borderColor: colors.isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.2)',
              },
            ]}
          >
            <IconPuzzle size={36} color={colors.accent || '#3b82f6'} strokeWidth={1.8} />
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
            <IconSparkles size={12} color={colors.accent || '#3b82f6'} style={{ marginRight: 5 }} />
            <Text style={[styles.badgeText, { color: colors.accent || '#3b82f6' }]}>
              COMING SOON
            </Text>
          </View>

          <Text style={[styles.heroTitle, { color: colors.ink }]}>
            Plugins & Extensions
          </Text>

          <Text style={[styles.heroSubtitle, { color: colors.ink2 }]}>
            Extend ChatBox AI with powerful custom tools, external services, live browsing, and computational environments.
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
          {previewPlugins.map((plugin) => {
            const IconComponent = plugin.icon;
            return (
              <View
                key={plugin.id}
                style={[
                  styles.pluginCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.line,
                  },
                ]}
              >
                <View style={styles.pluginCardHeader}>
                  <View
                    style={[
                      styles.pluginIconBox,
                      {
                        backgroundColor: colors.surface2,
                        borderColor: colors.line,
                      },
                    ]}
                  >
                    <IconComponent size={20} color={colors.ink} strokeWidth={1.8} />
                  </View>

                  <View style={styles.pluginTitleCol}>
                    <Text style={[styles.pluginTitle, { color: colors.ink }]}>
                      {plugin.title}
                    </Text>
                    <View
                      style={[
                        styles.pluginBadge,
                        {
                          backgroundColor: colors.surface2,
                          borderColor: colors.line,
                        },
                      ]}
                    >
                      <Text style={[styles.pluginBadgeText, { color: colors.ink3 }]}>
                        {plugin.badge}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={[styles.pluginDesc, { color: colors.ink2 }]}>
                  {plugin.desc}
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
            The Plugin Marketplace is actively being prepared for an upcoming update. You will be able to toggle and configure plugins directly per conversation.
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
  pluginCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    borderCurve: radius.borderCurve,
  },
  pluginCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  pluginIconBox: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm + 2,
  },
  pluginTitleCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pluginTitle: {
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: -0.2,
    flex: 1,
    marginRight: 8,
  },
  pluginBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  pluginBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  pluginDesc: {
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
