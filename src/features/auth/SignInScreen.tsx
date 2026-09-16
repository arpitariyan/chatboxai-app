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

interface SignInScreenProps {
  onNavigateSignUp: () => void;
  onNavigateForgotPassword: () => void;
  onSubmitSignIn?: (email: string, password: string) => void;
  onSocialPress?: (provider: 'google' | 'github' | 'microsoft') => void;
  loading?: boolean;
  disabled?: boolean;
  errorMessage?: string | null;
}

export const SignInScreen: React.FC<SignInScreenProps> = ({
  onNavigateSignUp,
  onNavigateForgotPassword,
  onSubmitSignIn,
  onSocialPress,
  loading = false,
  disabled = false,
  errorMessage = null,
}) => {
  const colors = useThemeColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'github' | 'microsoft' | null>(null);

  const handleSignIn = () => {
    setValidationError(null);
    if (!email.trim()) {
      setValidationError('Please enter your email address');
      return;
    }
    if (!password) {
      setValidationError('Please enter your password');
      return;
    }
    onSubmitSignIn?.(email.trim(), password);
  };

  const handleSocialPress = async (provider: 'google' | 'github' | 'microsoft') => {
    setLoadingProvider(provider);
    try {
      if (onSocialPress) {
        await onSocialPress(provider);
      }
    } finally {
      setLoadingProvider(null);
    }
  };

  const activeError = validationError || errorMessage;

  return (
    <View style={styles.container}>
      {/* Brand & Page Header */}
      <AuthHeader
        title="Welcome back"
        subtitle="Sign in to your ChatBox AI account to continue"
      />

      {/* Global Error Banner */}
      {activeError ? (
        <View style={[styles.errorBanner, { backgroundColor: '#2d1214', borderColor: '#7f1d1d' }]}>
          <Text style={[styles.errorBannerText, { color: '#f87171' }]}>
            {activeError}
          </Text>
        </View>
      ) : null}

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
        onChangeText={(text) => {
          setEmail(text);
          if (validationError) setValidationError(null);
        }}
        disabled={disabled || loading}
      />

      {/* Password Input */}
      <PasswordInput
        label="Password"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          if (validationError) setValidationError(null);
        }}
        disabled={disabled || loading}
      />

      {/* Forgot Password Link */}
      <AuthFooterLink
        linkText="Forgot password?"
        onPress={onNavigateForgotPassword}
        align="right"
        style={styles.forgotLink}
      />

      {/* Primary Submit CTA */}
      <AuthButton
        title="Sign in"
        onPress={handleSignIn}
        loading={loading}
        disabled={disabled}
      />

      {/* Secondary Navigation */}
      <AuthFooterLink
        promptText="Don't have an account?"
        linkText="Sign up"
        onPress={onNavigateSignUp}
        align="center"
        style={styles.signUpLink}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  errorBanner: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    fontWeight: typography.fontWeight.medium as any,
  },
  forgotLink: {
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
  },
  signUpLink: {
    marginTop: spacing.md,
  },
});
