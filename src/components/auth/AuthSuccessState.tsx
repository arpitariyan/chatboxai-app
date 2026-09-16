import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { IconCheck } from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius, typography } from '@/theme';
import { AuthButton } from './AuthButton';

interface AuthSuccessStateProps {
  email?: string;
  onBackToSignIn: () => void;
  onResendEmail?: () => void;
}

export const AuthSuccessState: React.FC<AuthSuccessStateProps> = ({
  email = 'your email address',
  onBackToSignIn,
  onResendEmail,
}) => {
  const colors = useThemeColors();

  return (
    <View style={styles.container}>
      {/* Subtle Success Visual Badge */}
      <View style={[styles.iconBox, { backgroundColor: colors.inset, borderColor: colors.line }]}>
        <View style={[styles.checkCircle, { backgroundColor: colors.primary }]}>
          <IconCheck size={16} color={colors.primaryForeground} strokeWidth={2.5} />
        </View>
      </View>

      {/* Success Title */}
      <Text style={[styles.title, { color: colors.ink }]}>Check your email</Text>

      {/* Confirmation Message */}
      <Text style={[styles.subtitle, { color: colors.ink2 }]}>
        We sent a password reset link to{'\n'}
        <Text style={[styles.emailHighlight, { color: colors.ink }]}>{email}</Text>
      </Text>

      {/* Primary Action: Back to Sign In */}
      <View style={styles.buttonWrapper}>
        <AuthButton title="Back to sign in" onPress={onBackToSignIn} />
      </View>

      {/* Resend Link */}
      {onResendEmail && (
        <Pressable
          onPress={onResendEmail}
          hitSlop={8}
          style={({ pressed }) => [styles.resendContainer, { opacity: pressed ? 0.65 : 1 }]}
        >
          <Text style={[styles.resendText, { color: colors.ink3 }]}>
            Didn't receive the email?{' '}
            <Text style={{ color: colors.ink, fontWeight: typography.fontWeight.semibold }}>
              Click to resend
            </Text>
          </Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderCurve: radius.borderCurve,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    fontSize: 13,
    fontWeight: typography.fontWeight.bold,
  },
  title: {
    fontSize: 22,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.normal,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  emailHighlight: {
    fontWeight: typography.fontWeight.semibold,
  },
  buttonWrapper: {
    width: '100%',
    marginBottom: spacing.xs,
  },
  resendContainer: {
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },
  resendText: {
    fontSize: 12,
    textAlign: 'center',
  },
});
