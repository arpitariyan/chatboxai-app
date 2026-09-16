import React from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconArrowLeft,
  IconUser,
  IconAward,
  IconBolt,
  IconPalette,
  IconMoon,
  IconTypography,
  IconMicrophone,
  IconVolume,
  IconFileDescription,
  IconLock,
  IconInfoCircle,
} from '@tabler/icons-react-native';
import { ListRow } from '@/components/common/ListRow';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColors, spacing, radius, typography } from '@/theme';

interface SettingsScreenProps {
  onBack: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack }) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { currentUser, userProfile, logout } = useAuth();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View
        style={[
          styles.headerRow,
          {
            borderBottomColor: colors.line,
            paddingTop: Math.max(insets.top, 12),
          },
        ]}
      >
        <Pressable onPress={onBack} hitSlop={8} style={styles.backBtn}>
          <IconArrowLeft size={20} color={colors.ink} style={{ marginRight: 4 }} />
          <Text style={[styles.backText, { color: colors.ink }]}>Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.ink }]}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Section */}
        <Text style={[styles.sectionHeader, { color: colors.ink3 }]}>ACCOUNT</Text>
        <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <ListRow
            icon={<IconUser size={18} color={colors.ink} />}
            title="Email"
            value={currentUser?.email || 'Guest'}
            showChevron={false}
          />
          <ListRow
            icon={<IconAward size={18} color="#eab308" />}
            title="Plan"
            value={(userProfile?.plan || 'FREE').toUpperCase()}
            showChevron={false}
          />
          <ListRow
            icon={<IconBolt size={18} color={colors.accent} />}
            title="Available Credits"
            value={(userProfile?.credits ?? 5000).toLocaleString()}
            showChevron={false}
          />
        </View>

        {/* Appearance & Preferences */}
        <Text style={[styles.sectionHeader, { color: colors.ink3 }]}>
          PREFERENCES & THEME
        </Text>
        <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <ListRow
            icon={<IconPalette size={18} color={colors.ink} />}
            title="Accent Theme"
            value="Violet"
            onPress={() => {}}
          />
          <ListRow
            icon={<IconMoon size={18} color={colors.ink} />}
            title="Dark Mode"
            isSwitch
            switchValue={true}
            onSwitchChange={() => {}}
          />
          <ListRow
            icon={<IconTypography size={18} color={colors.ink} />}
            title="Chat Font"
            value="Geist Sans"
            onPress={() => {}}
          />
        </View>

        {/* Voice & Audio Section */}
        <Text style={[styles.sectionHeader, { color: colors.ink3 }]}>
          VOICE & AUDIO
        </Text>
        <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <ListRow
            icon={<IconMicrophone size={18} color={colors.ink} />}
            title="Voice Mode"
            value="Enabled"
            showChevron={false}
          />
          <ListRow
            icon={<IconVolume size={18} color={colors.ink} />}
            title="Auto-speak Responses"
            isSwitch
            switchValue={false}
            onSwitchChange={() => {}}
          />
        </View>

        {/* Privacy & Legal */}
        <Text style={[styles.sectionHeader, { color: colors.ink3 }]}>
          ABOUT & LEGAL
        </Text>
        <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <ListRow
            icon={<IconFileDescription size={18} color={colors.ink} />}
            title="Terms of Service"
            onPress={() => Linking.openURL('https://chatboxai.co.in/terms-conditions')}
          />
          <ListRow
            icon={<IconLock size={18} color={colors.ink} />}
            title="Privacy Policy"
            onPress={() => Linking.openURL('https://chatboxai.co.in/privacy-policy')}
          />
          <ListRow
            icon={<IconInfoCircle size={18} color={colors.ink} />}
            title="App Version"
            value="1.0.0 (Expo SDK 57)"
            showChevron={false}
          />
        </View>

        {/* Sign Out CTA */}
        <Pressable
          onPress={logout}
          style={({ pressed }) => [
            styles.logoutBtn,
            {
              backgroundColor: colors.surface,
              borderColor: colors.line,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Text style={[styles.logoutText, { color: colors.destructive }]}>
            Sign Out of ChatBox AI
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  headerRow: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  title: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: -0.2,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 1.1,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  groupCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    borderCurve: radius.borderCurve,
  },
  logoutBtn: {
    height: 48,
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    borderCurve: radius.borderCurve,
  },
  logoutText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
});
