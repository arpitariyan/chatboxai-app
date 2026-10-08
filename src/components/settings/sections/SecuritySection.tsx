/**
 * src/components/settings/sections/SecuritySection.tsx
 *
 * Security Settings Section for ChatBox AI Mobile APK.
 * Follows the unified Home screen + Menu/Bottom Sheet design language:
 * - Grouped Surface cards with hairline dividers
 * - Password Reset flow embedded in official BottomSheet
 * - MFA management with BottomSheet OTP verification
 * - Device and Session Specs
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import {
  IconLock,
  IconShieldCheck,
  IconShieldOff,
  IconMail,
  IconDeviceMobile,
  IconCheck,
  IconChevronRight,
  IconRefresh,
} from '@tabler/icons-react-native';
import { BottomSheet } from '@/components/common/BottomSheet';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColors, spacing, radius, typography } from '@/theme';
import { updateUserProfile } from '@/services/userService';

export const SecuritySection: React.FC = () => {
  const colors = useThemeColors();
  const { currentUser, userProfile, requestPasswordResetOtp, confirmPasswordResetOtp, refreshProfile } = useAuth();

  // Password Reset OTP Flow (1: Idle/Send, 2: OTP+NewPassword, 3: Success)
  const [passwordStep, setPasswordStep] = useState<1 | 2 | 3>(1);
  const [showPasswordSheet, setShowPasswordSheet] = useState(false);
  const [passwordOtp, setPasswordOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordDevOtp, setPasswordDevOtp] = useState<string | null>(null);

  // MFA Flow
  const [isMfaEnabled, setIsMfaEnabled] = useState(!!userProfile?.mfa_enabled);
  const [showMfaSheet, setShowMfaSheet] = useState(false);
  const [mfaEmail, setMfaEmail] = useState(currentUser?.email || '');
  const [mfaOtp, setMfaOtp] = useState('');
  const [mfaOtpSent, setMfaOtpSent] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaDevOtp, setMfaDevOtp] = useState<string | null>(null);

  // Password reset handlers
  const handleOpenPasswordSheet = () => {
    setPasswordStep(1);
    setPasswordOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordDevOtp(null);
    setShowPasswordSheet(true);
  };

  const handleSendPasswordOtp = async () => {
    if (!currentUser?.email) {
      Alert.alert('Error', 'No authenticated email found.');
      return;
    }
    setPasswordLoading(true);
    setPasswordDevOtp(null);
    try {
      const res = await requestPasswordResetOtp(currentUser.email);
      if (res.devOtp) setPasswordDevOtp(res.devOtp);
      setPasswordStep(2);
      Alert.alert('Code Sent', 'Please check your email for the 6-digit verification code.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to send verification code.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (passwordOtp.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit code.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Too Short', 'Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    setPasswordLoading(true);
    try {
      const success = await confirmPasswordResetOtp(currentUser?.email || '', passwordOtp, newPassword);
      if (success) {
        setPasswordStep(3);
      } else {
        Alert.alert('Verification Failed', 'Invalid or expired code.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  // MFA handlers
  const handleToggleMfa = () => {
    if (isMfaEnabled) {
      Alert.alert('Disable 2FA', 'Are you sure you want to disable Two-Factor Authentication?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            if (userProfile?.$id) {
              await updateUserProfile(userProfile.$id, { mfa_enabled: false });
              await refreshProfile();
            }
            setIsMfaEnabled(false);
          },
        },
      ]);
    } else {
      setMfaOtp('');
      setMfaOtpSent(false);
      setMfaDevOtp(null);
      setShowMfaSheet(true);
    }
  };

  const handleSendMfaOtp = async () => {
    if (!mfaEmail || !mfaEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    setMfaLoading(true);
    setMfaDevOtp(null);
    try {
      const res = await requestPasswordResetOtp(mfaEmail);
      if (res.devOtp) setMfaDevOtp(res.devOtp);
      setMfaOtpSent(true);
      Alert.alert('Code Sent', 'Verification code sent to ' + mfaEmail);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to send MFA code.');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleVerifyMfa = async () => {
    if (mfaOtp.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit code.');
      return;
    }

    setMfaLoading(true);
    try {
      if (userProfile?.$id) {
        await updateUserProfile(userProfile.$id, { mfa_enabled: true });
        await refreshProfile();
      }
      setIsMfaEnabled(true);
      setShowMfaSheet(false);
      Alert.alert('MFA Enabled', 'Two-Factor Authentication is now active on your account.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to enable MFA.');
    } finally {
      setMfaLoading(false);
    }
  };

  const providerId = currentUser?.providerData?.[0]?.providerId || 'password';
  const providerLabel = providerId === 'google.com' ? 'Google Account' : 'Email & Password';

  return (
    <View style={styles.container}>
      {/* ─── GROUP 1: AUTHENTICATION & ACCESS ──────────────────────────────── */}
      <Text style={[styles.sectionHeading, { color: colors.ink3 }]}>
        Authentication & Access
      </Text>

      <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        {/* Sign-in Method Row */}
        <View style={styles.actionRow}>
          <View style={[styles.iconBox, { backgroundColor: colors.surface2 }]}>
            <IconMail size={18} color={colors.ink} strokeWidth={1.8} />
          </View>
          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.ink }]}>Sign-In Provider</Text>
            <Text style={[styles.rowSubtitle, { color: colors.ink3 }]}>
              {providerLabel}
            </Text>
          </View>
          <View style={[styles.statusTag, { backgroundColor: 'rgba(74, 222, 128, 0.12)', borderColor: 'rgba(74, 222, 128, 0.25)' }]}>
            <Text style={[styles.statusTagText, { color: '#4ade80' }]}>Verified</Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.line }]} />

        {/* Change Password Row */}
        <Pressable
          onPress={handleOpenPasswordSheet}
          style={({ pressed }) => [
            styles.actionRow,
            pressed && { backgroundColor: colors.hover },
          ]}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surface2 }]}>
            <IconLock size={18} color={colors.ink} strokeWidth={1.8} />
          </View>
          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.ink }]}>Change Password</Text>
            <Text style={[styles.rowSubtitle, { color: colors.ink3 }]}>
              Update your account password via email OTP verification
            </Text>
          </View>
          <IconChevronRight size={16} color={colors.ink3} strokeWidth={1.8} />
        </Pressable>

        <View style={[styles.divider, { backgroundColor: colors.line }]} />

        {/* Two-Factor Authentication Row */}
        <View style={styles.actionRow}>
          <View style={[styles.iconBox, { backgroundColor: isMfaEnabled ? 'rgba(74, 222, 128, 0.12)' : colors.surface2 }]}>
            {isMfaEnabled ? (
              <IconShieldCheck size={18} color="#4ade80" strokeWidth={1.8} />
            ) : (
              <IconShieldOff size={18} color={colors.ink3} strokeWidth={1.8} />
            )}
          </View>
          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.ink }]}>Two-Factor Authentication</Text>
            <Text style={[styles.rowSubtitle, { color: colors.ink3 }]}>
              {isMfaEnabled ? 'Protected with email OTP verification' : 'Add an extra layer of protection to your account'}
            </Text>
          </View>
          <Switch
            value={isMfaEnabled}
            onValueChange={handleToggleMfa}
            trackColor={{ false: colors.line2, true: colors.accent }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      {/* ─── GROUP 2: DEVICE & ACTIVE SESSION ───────────────────────────────── */}
      <Text style={[styles.sectionHeading, { color: colors.ink3 }]}>
        Device & Active Session
      </Text>

      <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        {/* Device Row */}
        <View style={styles.actionRow}>
          <View style={[styles.iconBox, { backgroundColor: colors.surface2 }]}>
            <IconDeviceMobile size={18} color={colors.ink} strokeWidth={1.8} />
          </View>
          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.ink }]}>Current Device</Text>
            <Text style={[styles.rowSubtitle, { color: colors.ink3 }]}>
              {Platform.OS === 'android' ? 'Android Device' : Platform.OS === 'ios' ? 'Apple iPhone' : 'Native Device'}
            </Text>
          </View>
          <View style={[styles.statusTag, { backgroundColor: 'rgba(74, 222, 128, 0.12)', borderColor: 'rgba(74, 222, 128, 0.25)' }]}>
            <Text style={[styles.statusTagText, { color: '#4ade80' }]}>Active Now</Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.line }]} />

        {/* Runtime Platform */}
        <View style={styles.actionRow}>
          <View style={[styles.iconBox, { backgroundColor: colors.surface2 }]}>
            <IconRefresh size={18} color={colors.ink} strokeWidth={1.8} />
          </View>
          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.ink }]}>Session Runtime</Text>
            <Text style={[styles.rowSubtitle, { color: colors.ink3 }]}>
              ChatBox AI Mobile v1.0.0 (Production APK)
            </Text>
          </View>
        </View>
      </View>

      {/* ─── BOTTOM SHEET: CHANGE PASSWORD ─────────────────────────────────── */}
      <BottomSheet
        visible={showPasswordSheet}
        onClose={() => setShowPasswordSheet(false)}
        title="Change Password"
      >
        <View style={{ paddingVertical: spacing.xs }}>
          {passwordStep === 1 && (
            <View>
              <Text style={[styles.sheetDesc, { color: colors.ink2 }]}>
                We will send a 6-digit verification code to your registered email address ({currentUser?.email || 'your email'}).
              </Text>

              <Pressable
                onPress={handleSendPasswordOtp}
                disabled={passwordLoading}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  {
                    backgroundColor: colors.accent,
                    opacity: passwordLoading ? 0.6 : pressed ? 0.8 : 1,
                  },
                ]}
              >
                {passwordLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Send Verification Code</Text>
                )}
              </Pressable>
            </View>
          )}

          {passwordStep === 2 && (
            <View>
              <Text style={[styles.sheetDesc, { color: colors.ink2 }]}>
                Enter the 6-digit code sent to your email, followed by your new password:
              </Text>

              {passwordDevOtp && (
                <View style={[styles.devNotice, { backgroundColor: colors.surface2, borderColor: colors.accent }]}>
                  <Text style={[styles.devNoticeText, { color: colors.accent }]}>
                    Dev Code: {passwordDevOtp}
                  </Text>
                </View>
              )}

              <TextInput
                value={passwordOtp}
                onChangeText={setPasswordOtp}
                placeholder="6-Digit OTP"
                placeholderTextColor={colors.ink3}
                keyboardType="number-pad"
                maxLength={6}
                style={[styles.sheetInput, { backgroundColor: colors.surface2, borderColor: colors.line, color: colors.ink }]}
              />

              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="New Password (min 6 chars)"
                placeholderTextColor={colors.ink3}
                secureTextEntry
                style={[styles.sheetInput, { backgroundColor: colors.surface2, borderColor: colors.line, color: colors.ink }]}
              />

              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm New Password"
                placeholderTextColor={colors.ink3}
                secureTextEntry
                style={[styles.sheetInput, { backgroundColor: colors.surface2, borderColor: colors.line, color: colors.ink }]}
              />

              <Pressable
                onPress={handleUpdatePassword}
                disabled={passwordLoading}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  {
                    backgroundColor: colors.accent,
                    opacity: passwordLoading ? 0.6 : pressed ? 0.8 : 1,
                  },
                ]}
              >
                {passwordLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Update Password</Text>
                )}
              </Pressable>
            </View>
          )}

          {passwordStep === 3 && (
            <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
              <View style={[styles.successCircle, { backgroundColor: 'rgba(74, 222, 128, 0.15)' }]}>
                <IconCheck size={28} color="#4ade80" strokeWidth={2.5} />
              </View>
              <Text style={[styles.successTitle, { color: colors.ink }]}>Password Updated</Text>
              <Text style={[styles.successSubtitle, { color: colors.ink2 }]}>
                Your account password has been changed successfully.
              </Text>

              <Pressable
                onPress={() => setShowPasswordSheet(false)}
                style={[styles.primaryBtn, { backgroundColor: colors.accent, width: '100%', marginTop: 16 }]}
              >
                <Text style={styles.primaryBtnText}>Done</Text>
              </Pressable>
            </View>
          )}
        </View>
      </BottomSheet>

      {/* ─── BOTTOM SHEET: TWO-FACTOR AUTHENTICATION ───────────────────────── */}
      <BottomSheet
        visible={showMfaSheet}
        onClose={() => setShowMfaSheet(false)}
        title="Enable 2-Step Verification"
      >
        <View style={{ paddingVertical: spacing.xs }}>
          <Text style={[styles.sheetDesc, { color: colors.ink2 }]}>
            Protect your ChatBox AI account by requiring an email verification code when signing in on a new device.
          </Text>

          {!mfaOtpSent ? (
            <View>
              <TextInput
                value={mfaEmail}
                onChangeText={setMfaEmail}
                placeholder="Verification Email"
                placeholderTextColor={colors.ink3}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[styles.sheetInput, { backgroundColor: colors.surface2, borderColor: colors.line, color: colors.ink }]}
              />

              <Pressable
                onPress={handleSendMfaOtp}
                disabled={mfaLoading}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  {
                    backgroundColor: colors.accent,
                    opacity: mfaLoading ? 0.6 : pressed ? 0.8 : 1,
                  },
                ]}
              >
                {mfaLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Send MFA Code</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View>
              {mfaDevOtp && (
                <View style={[styles.devNotice, { backgroundColor: colors.surface2, borderColor: colors.accent }]}>
                  <Text style={[styles.devNoticeText, { color: colors.accent }]}>
                    Dev Code: {mfaDevOtp}
                  </Text>
                </View>
              )}

              <TextInput
                value={mfaOtp}
                onChangeText={setMfaOtp}
                placeholder="6-Digit OTP"
                placeholderTextColor={colors.ink3}
                keyboardType="number-pad"
                maxLength={6}
                style={[styles.sheetInput, { backgroundColor: colors.surface2, borderColor: colors.line, color: colors.ink }]}
              />

              <Pressable
                onPress={handleVerifyMfa}
                disabled={mfaLoading}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  {
                    backgroundColor: colors.accent,
                    opacity: mfaLoading ? 0.6 : pressed ? 0.8 : 1,
                  },
                ]}
              >
                {mfaLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Verify & Enable 2FA</Text>
                )}
              </Pressable>
            </View>
          )}
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
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sheetDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  sheetInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 10,
  },
  primaryBtn: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  devNotice: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  devNoticeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  successCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  successSubtitle: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
});
