import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  AuthHeader,
  SocialAuthButtons,
  AuthDivider,
  AuthInput,
  PasswordInput,
  AuthButton,
  AuthFooterLink,
} from '@/components/auth';
import { useThemeColors, spacing, typography } from '@/theme';

interface SignUpScreenProps {
  onNavigateSignIn: () => void;
  onSubmitSignUp?: (email: string) => void;
  loading?: boolean;
  disabled?: boolean;
  simulateError?: boolean;
}

export const SignUpScreen: React.FC<SignUpScreenProps> = ({
  onNavigateSignIn,
  onSubmitSignUp,
  loading = false,
  disabled = false,
  simulateError = false,
}) => {
  const colors = useThemeColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'github' | 'microsoft' | null>(null);

  const handleSignUp = () => {
    onSubmitSignUp?.(email);
  };

  const handleSocialPress = (provider: 'google' | 'github' | 'microsoft') => {
    setLoadingProvider(provider);
    setTimeout(() => {
      setLoadingProvider(null);
    }, 1500);
  };

  const emailError = simulateError ? 'An account with this email already exists' : undefined;
  const passwordError = simulateError
    ? 'Password must be at least 8 characters long with numbers & symbols'
    : undefined;

  return (
    <View style={styles.container}>
      {/* Brand & Page Header */}
      <AuthHeader
        title="Create your account"
        subtitle="Start building & chatting with ChatBox AI"
      />

      {/* Social Provider Buttons */}
      <SocialAuthButtons
        onProviderPress={handleSocialPress}
        loadingProvider={loadingProvider}
        disabled={disabled || loading}
      />

      {/* Or Separator */}
      <AuthDivider />

      {/* Email Input */}
      <AuthInput
        label="Email address"
        placeholder="name@example.com"
        value={email}
        onChangeText={setEmail}
        error={emailError}
        disabled={disabled || loading}
      />

      {/* Password Input */}
      <PasswordInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={passwordError}
        disabled={disabled || loading}
      />

      {/* Primary Submit CTA */}
      <AuthButton
        title="Create account"
        onPress={handleSignUp}
        loading={loading}
        disabled={disabled}
      />

      {/* Terms & Legal Disclaimer */}
      <Text style={[styles.legalText, { color: colors.ink3 }]}>
        By signing up, you agree to ChatBox AI's{' '}
        <Text style={{ color: colors.ink2, textDecorationLine: 'underline' }}>Terms of Service</Text>{' '}
        and{' '}
        <Text style={{ color: colors.ink2, textDecorationLine: 'underline' }}>Privacy Policy</Text>.
      </Text>

      {/* Secondary Navigation */}
      <AuthFooterLink
        promptText="Already have an account?"
        linkText="Sign in"
        onPress={onNavigateSignIn}
        align="center"
        style={styles.signInLink}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  legalText: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    lineHeight: typography.fontSize.xs * typography.lineHeight.normal,
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  signInLink: {
    marginTop: spacing.sm,
  },
});
