import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { IconBolt, IconSettings, IconChevronRight, IconLogout } from '@tabler/icons-react-native';
import { BottomSheet } from '@/components/common/BottomSheet';
import { SignOutModal } from '@/components/common/SignOutModal';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColors, spacing, radius, typography } from '@/theme';

interface UserProfileSheetProps {
  visible: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

export const UserProfileSheet: React.FC<UserProfileSheetProps> = ({
  visible,
  onClose,
  onOpenSettings,
}) => {
  const colors = useThemeColors();
  const { currentUser, userProfile, logout } = useAuth();
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const displayName = currentUser?.displayName || userProfile?.name || 'ChatBox AI User';
  const email = currentUser?.email || 'guest@example.com';
  const initials = (displayName || email).charAt(0).toUpperCase();

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Account & Profile">
      <View style={styles.container}>
        {/* User Avatar & Info Card */}
        <View style={[styles.profileHeaderCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={[styles.avatarCircle, { backgroundColor: colors.accent }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <View style={styles.infoGroup}>
            <Text style={[styles.nameText, { color: colors.ink }]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={[styles.emailText, { color: colors.ink2 }]} numberOfLines={1}>
              {email}
            </Text>

            <View style={styles.tagRow}>
              <View style={[styles.planBadge, { backgroundColor: colors.accent }]}>
                <Text style={styles.planBadgeText}>
                  {(userProfile?.plan || 'FREE').toUpperCase()}
                </Text>
              </View>
              <View style={styles.creditsRow}>
                <IconBolt size={12} color="#eab308" style={{ marginRight: 3 }} />
                <Text style={[styles.creditsText, { color: colors.ink2 }]}>
                  {(userProfile?.credits ?? 5000).toLocaleString()} Credits
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Settings Action */}
        <Pressable
          onPress={() => {
            onClose();
            onOpenSettings();
          }}
          style={({ pressed }) => [
            styles.actionRow,
            {
              backgroundColor: colors.surface,
              borderColor: colors.line,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <IconSettings size={18} color={colors.ink} />
          <Text style={[styles.actionText, { color: colors.ink }]}>
            Settings & Preferences
          </Text>
          <IconChevronRight size={16} color={colors.ink3} />
        </Pressable>

        {/* Sign Out Action Button */}
        <Pressable
          onPress={() => setShowSignOutModal(true)}
          style={({ pressed }) => [
            styles.logoutBtn,
            {
              backgroundColor: colors.surface,
              borderColor: colors.line,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <IconLogout size={18} color={colors.destructive} style={{ marginRight: 4 }} />
          <Text style={[styles.logoutText, { color: colors.destructive }]}>
            Sign Out of ChatBox AI
          </Text>
        </Pressable>
      </View>

      <SignOutModal
        visible={showSignOutModal}
        isLoading={isSigningOut}
        onClose={() => setShowSignOutModal(false)}
        onConfirm={async () => {
          setIsSigningOut(true);
          try {
            await logout();
            setShowSignOutModal(false);
            onClose();
          } catch (err) {
            console.warn('[UserProfileSheet] Logout error:', err);
            setShowSignOutModal(false);
          } finally {
            setIsSigningOut(false);
          }
        }}
      />
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  profileHeaderCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderCurve: radius.borderCurve,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: typography.fontWeight.bold,
  },
  infoGroup: {
    flex: 1,
    marginLeft: spacing.md,
  },
  nameText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: -0.2,
  },
  emailText: {
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  planBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  planBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  creditsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creditsText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.medium,
  },
  actionRow: {
    height: 50,
    borderRadius: radius.control,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    borderCurve: radius.borderCurve,
  },
  actionIcon: {
    fontSize: 18,
  },
  actionText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  chevron: {
    fontSize: 18,
  },
  logoutBtn: {
    height: 50,
    borderRadius: radius.control,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    marginTop: spacing.xs,
    borderCurve: radius.borderCurve,
  },
  logoutIcon: {
    fontSize: 18,
    color: '#f87171',
  },
  logoutText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
});
