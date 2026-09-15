import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AuthHeader,
  SocialAuthButtons,
  AuthDivider,
  AuthInput,
  PasswordInput,
  AuthButton,
  AuthFooterLink,
} from '@/components/auth';
import { spacing } from '@/theme';

interface SignInScreenProps {
  onNavigateSignUp: () => void;
  onNavigateForgotPassword: () => void;
  onSubmitSignIn?: (email: string) => void;
  loading?: boolean;
  disabled?: boolean;
  simulateError?: boolean;
}

export const SignInScreen: React.FC<SignInScreenProps> = ({
  onNavigateSignUp,
  onNavigateForgotPassword,
  onSubmitSignIn,
  loading = false,
  disabled = false,
  simulateError = false,
}) => {
  const [email, setEmail] = useState('user@chatboxai.com');
  const [password, setPassword] = useState('Password123!');
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'github' | 'microsoft' | null>(null);

  const handleSignIn = () => {
    onSubmitSignIn?.(email);
  };

  const handleSocialPress = (provider: 'google' | 'github' | 'microsoft') => {
    setLoadingProvider(provider);
    setTimeout(() => {
      setLoadingProvider(null);
    }, 1500);
  };

  const emailError = simulateError ? 'Invalid email address or account not found' : undefined;
  const passwordError = simulateError ? 'Incorrect password. Please try again.' : undefined;

  return (
    <View style={styles.container}>
      {/* Brand & Page Header */}
      <AuthHeader
        title="Welcome back"
        subtitle="Sign in to your ChatBox AI account to continue"
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
  forgotLink: {
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
  },
  signUpLink: {
    marginTop: spacing.md,
  },
});
