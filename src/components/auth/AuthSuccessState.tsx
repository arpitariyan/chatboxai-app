import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { IconCheck } from '@tabler/icons-react-native';
import { spacing } from '@/theme';
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
  return (
    <View style={styles.container}>
      {/* Success Check Icon */}
      <View style={styles.iconCircle}>
        <IconCheck size={28} color="#000000" strokeWidth={3} />
      </View>

      {/* Success Title */}
      <Text style={styles.title}>Check your email</Text>

      {/* Confirmation Message */}
      <Text style={styles.subtitle}>
        We sent a verification / reset link to{'\n'}
        <Text style={styles.emailHighlight}>{email}</Text>
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
          <Text style={styles.resendText}>
            Didn't receive the email?{' '}
            <Text style={styles.resendLink}>Click to resend</Text>
          </Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#7F7F7F',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
    marginBottom: spacing.lg,
  },
  emailHighlight: {
    color: '#ffffff',
    fontWeight: '600',
  },
  buttonWrapper: {
    width: '100%',
  },
  resendContainer: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  resendText: {
    fontSize: 13,
    color: '#7F7F7F',
  },
  resendLink: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
