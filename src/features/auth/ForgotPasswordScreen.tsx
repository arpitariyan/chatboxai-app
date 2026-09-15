import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AuthHeader,
  AuthInput,
  AuthButton,
  AuthFooterLink,
} from '@/components/auth';
import { spacing } from '@/theme';

interface ForgotPasswordScreenProps {
  onNavigateSignIn: () => void;
  onSubmitSendResetLink?: (email: string) => void;
  loading?: boolean;
  disabled?: boolean;
  simulateError?: boolean;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  onNavigateSignIn,
  onSubmitSendResetLink,
  loading = false,
  disabled = false,
  simulateError = false,
}) => {
  const [email, setEmail] = useState('user@chatboxai.com');

  const handleSendLink = () => {
    onSubmitSendResetLink?.(email);
  };

  const emailError = simulateError
    ? 'We could not find an account associated with this email address'
    : undefined;

  return (
    <View style={styles.container}>
      {/* Brand & Page Header */}
      <AuthHeader
        title="Reset your password"
        subtitle="Enter your email address and we'll send you a password reset link."
      />

      {/* Email Input */}
      <AuthInput
        label="Email address"
        placeholder="name@example.com"
        value={email}
        onChangeText={setEmail}
        error={emailError}
        disabled={disabled || loading}
      />

      {/* Primary Submit CTA */}
      <AuthButton
        title="Send reset link"
        onPress={handleSendLink}
        loading={loading}
        disabled={disabled}
      />

      {/* Secondary Navigation */}
      <AuthFooterLink
        linkText="Back to sign in"
        onPress={onNavigateSignIn}
        align="center"
        style={styles.backLink}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  backLink: {
    marginTop: spacing.lg,
  },
});
