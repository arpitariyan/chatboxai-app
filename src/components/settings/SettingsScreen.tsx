/**
 * src/components/settings/SettingsScreen.tsx
 *
 * Dedicated Full-Screen Mobile Settings Experience for ChatBox AI APK.
 * Follows the unified visual design language of the Home Screen + Menus + Bottom Sheets:
 * - Surfaces: colors.background, colors.surface, colors.surface2
 * - Borders: clean layout with lines above and below the tab bar removed
 * - Icon styling: 20px / 18px strokeWidth 1.8 circular header button & category pills
 * - Typography: Inter/System with strict hierarchy
 * - Full-screen edge-to-edge layout with safe-area insets
 * - Unconstrained native scrolling with nestedScrollEnabled on Android
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconArrowLeft,
  IconAdjustmentsHorizontal,
  IconUser,
  IconShieldLock,
  IconBrain,
  IconKey,
  IconHelpCircle,
} from '@tabler/icons-react-native';
import { useThemeColors, spacing } from '@/theme';
import { GeneralSection } from './sections/GeneralSection';
import { AccountSection } from './sections/AccountSection';
import { SecuritySection } from './sections/SecuritySection';
import { MemorySection } from './sections/MemorySection';
import { ApiKeySection } from './sections/ApiKeySection';
import { HelpSection } from './sections/HelpSection';
import { useTranslation } from '@/i18n';

export type SettingsTabId = 'general' | 'account' | 'security' | 'memory' | 'api-keys' | 'help';

interface TabItem {
  id: SettingsTabId;
  label: string;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
}

interface SettingsScreenProps {
  onBack: () => void;
  initialTab?: SettingsTabId;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onBack,
  initialTab = 'general',
}) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);

  const tabs: TabItem[] = [
    { id: 'general', label: t('tabGeneral', 'General'), icon: IconAdjustmentsHorizontal },
    { id: 'account', label: t('tabAccount', 'Account'), icon: IconUser },
    { id: 'security', label: t('tabSecurity', 'Security'), icon: IconShieldLock },
    { id: 'memory', label: t('tabMemory', 'Memory'), icon: IconBrain },
    { id: 'api-keys', label: t('tabApiKeys', 'API Keys'), icon: IconKey },
    { id: 'help', label: t('tabHelp', 'Help'), icon: IconHelpCircle },
  ];

  const screenBody = (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header — border line above tab bar removed cleanly */}
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
            <Text style={[styles.headerTitle, { color: colors.ink }]}>{t('settings', 'Settings')}</Text>
          </View>

          <View style={styles.rightSpacer} />
        </View>
      </View>

      {/* Tab pill bar — border lines above and below removed cleanly */}
      <View style={styles.tabBarContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarScroll}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
          overScrollMode="never"
        >
          {tabs.map((tab, idx) => {
            const isActive = activeTab === tab.id;
            const IconComponent = tab.icon;
            const isLast = idx === tabs.length - 1;

            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={({ pressed }) => [
                  styles.tabPill,
                  {
                    backgroundColor: isActive ? colors.surface : colors.surface2,
                    borderColor: isActive ? colors.accent : colors.line,
                    borderWidth: isActive ? 1.5 : 1,
                    marginRight: isLast ? 0 : 8,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <IconComponent
                  size={16}
                  color={isActive ? colors.accent : colors.ink2}
                  strokeWidth={isActive ? 2 : 1.8}
                />
                <Text
                  style={[
                    styles.tabPillText,
                    {
                      color: isActive ? colors.ink : colors.ink2,
                      fontWeight: isActive ? '600' : '500',
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Section content — single outer ScrollView handles all scrolling smoothly */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 64 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        nestedScrollEnabled={true}
        overScrollMode="always"
        bounces={true}
      >
        {activeTab === 'general' && <GeneralSection />}
        {activeTab === 'account' && <AccountSection />}
        {activeTab === 'security' && <SecuritySection />}
        {activeTab === 'memory' && <MemorySection />}
        {activeTab === 'api-keys' && <ApiKeySection />}
        {activeTab === 'help' && <HelpSection />}
      </ScrollView>
    </View>
  );

  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior="padding"
      >
        {screenBody}
      </KeyboardAvoidingView>
    );
  }

  return screenBody;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  headerContainer: {
    width: '100%',
    paddingBottom: 4,
  },
  headerRow: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  rightSpacer: {
    width: 40,
    height: 40,
  },
  tabBarContainer: {
    paddingVertical: 8,
  },
  tabBarScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingRight: spacing.xl,
  },
  tabPill: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  tabPillText: {
    fontSize: 13,
    letterSpacing: -0.1,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
});
