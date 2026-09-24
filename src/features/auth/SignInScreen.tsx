import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import {
  AuthHeader,
  SocialAuthButtons,
  AuthDivider,
  AuthInput,
  PasswordInput,
  AuthButton,
  AuthFooterLink,
  AuthCheckbox,
} from '@/components/auth';
import { spacing } from '@/theme';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
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
      {/* Figma Signature Title: Sign in with underline */}
      <AuthHeader
        title="Sign in"
        subtitle="Welcome back! Please enter your details."
      />

      {/* Global Error Banner */}
      {activeError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{activeError}</Text>
        </View>
      ) : null}

      {/* Email Input — Figma Underline Style with Mail icon & vertical divider */}
      <AuthInput
        label="Email"
        placeholder="Enter Your Email"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (validationError) setValidationError(null);
        }}
        disabled={disabled || loading}
        autoComplete="email"
      />

      {/* Password Input — Figma Underline Style with Lock icon, divider & eye toggle */}
      <PasswordInput
        label="Password"
        placeholder="Enter Your Password"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          if (validationError) setValidationError(null);
        }}
        disabled={disabled || loading}
        autoComplete="password"
      />

      {/* Options Row: Remember Me (Left) + Forgot Password? (Right) */}
      <View style={styles.optionsRow}>
        <AuthCheckbox
          checked={rememberMe}
          onChange={setRememberMe}
          label="Remember Me"
          disabled={disabled || loading}
        />

        <Pressable
          onPress={onNavigateForgotPassword}
          hitSlop={8}
          style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Forgot Password?"
        >
          <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
        </Pressable>
      </View>

      {/* Primary Submit CTA: High-contrast pure white button with bold black text */}
      <AuthButton
        title="Sign in"
        onPress={handleSignIn}
        loading={loading}
        disabled={disabled}
      />

      {/* Divider */}
      <AuthDivider />

      {/* Social Provider Buttons */}
      <SocialAuthButtons
        onProviderPress={handleSocialPress}
        loadingProvider={loadingProvider}
        disabled={disabled || loading}
      />

      {/* Secondary Navigation */}
      <AuthFooterLink
        promptText="Don’t have an Account ?"
        linkText="Sign up"
        onPress={onNavigateSignUp}
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
    borderColor: '#7f1d1d',
    backgroundColor: '#2d1214',
    marginBottom: spacing.lg,
  },
  errorBannerText: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
    color: '#f87171',
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  forgotPasswordText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});
