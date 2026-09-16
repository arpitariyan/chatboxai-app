import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Linking, TouchableOpacity, TextInput } from 'react-native';
import { IconMail, IconAlertCircle, IconCode, IconArrowLeft } from '@tabler/icons-react-native';
import {
  AuthHeader,
  SocialAuthButtons,
  AuthDivider,
  AuthInput,
  PasswordInput,
  AuthButton,
  AuthFooterLink,
} from '@/components/auth';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColors, spacing, typography, radius } from '@/theme';

interface SignUpScreenProps {
  onNavigateSignIn: () => void;
  onSubmitSignUp?: (email: string, password: string, displayName?: string) => void;
  onSocialPress?: (provider: 'google' | 'github' | 'microsoft') => void;
  loading?: boolean;
  disabled?: boolean;
  errorMessage?: string | null;
}

export const SignUpScreen: React.FC<SignUpScreenProps> = ({
  onNavigateSignIn,
  onSubmitSignUp,
  onSocialPress,
  loading: externalLoading = false,
  disabled = false,
  errorMessage = null,
}) => {
  const colors = useThemeColors();
  const { requestSignUpOtp, confirmSignUpOtp, authError, setAuthError } = useAuth();

  // Step 1: Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'github' | 'microsoft' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 2: OTP state
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Step 1: Initiate Sign-Up and send confirmation OTP
  const handleInitiateSignUp = async () => {
    setValidationError(null);
    setAuthError(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setValidationError('Please enter your full name');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setValidationError('Please enter a valid email address');
      return;
    }
    if (!password || password.length < 6) {
      setValidationError('Password must be at least 6 characters long');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await requestSignUpOtp(cleanEmail);
      if (result.devOtp) {
        setDevOtp(result.devOtp);
      }
      setOtpStep(true);
      setResendCooldown(60);
      setOtp('');
      setOtpError(null);
    } catch (err: any) {
      setValidationError(err?.message || 'Failed to send confirmation code');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Verify 6-digit OTP and complete signup/login
  const handleVerifyOtp = async () => {
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setOtpError('Please enter the full 6-digit confirmation code');
      return;
    }

    setIsVerifying(true);
    setOtpError(null);

    try {
      await confirmSignUpOtp(email.trim().toLowerCase(), cleanOtp, password, name.trim());
      // Account created & verified; AuthContext updates currentUser, auto-navigating to home
    } catch (err: any) {
      setOtpError(err?.message || 'Invalid or expired confirmation code');
    } finally {
      setIsVerifying(false);
    }
  };

  // Resend confirmation code
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResending) return;

    setIsResending(true);
    setOtpError(null);

    try {
      const result = await requestSignUpOtp(email.trim().toLowerCase());
      if (result.devOtp) {
        setDevOtp(result.devOtp);
      }
      setResendCooldown(60);
    } catch (err: any) {
      setOtpError(err?.message || 'Failed to resend confirmation code');
    } finally {
      setIsResending(false);
    }
  };

  // Social login handler
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

  const activeError = validationError || authError || errorMessage;
  const isLoading = isSubmitting || externalLoading;

  // ── Render Step 2: Confirmation Code Verification ──────────────────────────
  if (otpStep) {
    return (
      <View style={styles.container}>
        <View style={styles.iconCircleContainer}>
          <View style={[styles.iconCircle, { backgroundColor: '#18181b', borderColor: '#27272a' }]}>
            <IconMail size={28} color="#ffffff" />
          </View>
        </View>

        <AuthHeader
          title="Verify your email"
          subtitle={`Enter the 6-digit confirmation code sent to\n${email.trim()}`}
        />

        {otpError ? (
          <View style={[styles.errorBanner, { backgroundColor: '#2d1214', borderColor: '#7f1d1d' }]}>
            <IconAlertCircle size={16} color="#f87171" style={{ marginRight: 6 }} />
            <Text style={[styles.errorBannerText, { color: '#f87171' }]}>
              {otpError}
            </Text>
          </View>
        ) : null}

        {devOtp ? (
          <View style={[styles.devOtpBadge, { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
            <IconCode size={14} color="#38bdf8" style={{ marginRight: 6 }} />
            <Text style={[styles.devOtpText, { color: '#38bdf8' }]}>
              Dev Code: {devOtp}
            </Text>
          </View>
        ) : null}

        {/* 6-digit Code Input */}
        <View style={styles.otpInputContainer}>
          <TextInput
            style={[
              styles.otpInput,
              {
                backgroundColor: colors.surface,
                borderColor: otpError ? '#ef4444' : colors.border,
                color: colors.ink,
              },
            ]}
            value={otp}
            onChangeText={(text) => {
              setOtp(text.replace(/[^0-9]/g, ''));
              if (otpError) setOtpError(null);
            }}
            placeholder="000000"
            placeholderTextColor={colors.ink3}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            editable={!isVerifying}
          />
        </View>

        {/* Verify CTA */}
        <AuthButton
          title={isVerifying ? 'Verifying code...' : 'Verify & Continue'}
          onPress={handleVerifyOtp}
          loading={isVerifying}
          disabled={otp.length !== 6 || isVerifying}
        />

        {/* Resend Cooldown Action */}
        <View style={styles.resendRow}>
          <Text style={[styles.resendPrompt, { color: colors.ink2 }]}>
            Didn't receive the code?{' '}
          </Text>
          {resendCooldown > 0 ? (
            <Text style={[styles.resendCooldownText, { color: colors.ink3 }]}>
              Resend in {resendCooldown}s
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResendOtp} disabled={isResending}>
              <Text style={[styles.resendButtonText, { color: colors.accent }]}>
                {isResending ? 'Sending...' : 'Resend code'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Back / Change Email */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => {
            setOtpStep(false);
            setOtp('');
            setOtpError(null);
            setDevOtp(null);
          }}
          disabled={isVerifying}
        >
          <IconArrowLeft size={16} color={colors.ink2} style={{ marginRight: 6 }} />
          <Text style={[styles.cancelButtonText, { color: colors.ink2 }]}>
            Change email address
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render Step 1: Registration Form ───────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Brand & Page Header */}
      <AuthHeader
        title="Create your account"
        subtitle="Start building & chatting with ChatBox AI"
      />

      {/* Global Error Banner */}
      {activeError ? (
        <View style={[styles.errorBanner, { backgroundColor: '#2d1214', borderColor: '#7f1d1d' }]}>
          <IconAlertCircle size={16} color="#f87171" style={{ marginRight: 6 }} />
          <Text style={[styles.errorBannerText, { color: '#f87171' }]}>
            {activeError}
          </Text>
        </View>
      ) : null}

      {/* Social Provider Buttons */}
      <SocialAuthButtons
        onProviderPress={handleSocialPress}
        loadingProvider={loadingProvider}
        disabled={disabled || isLoading}
      />

      {/* Or Separator */}
      <AuthDivider />

      {/* Display Name Input */}
      <AuthInput
        label="Full name"
        placeholder="John Doe"
        value={name}
        onChangeText={(text) => {
          setName(text);
          if (validationError) setValidationError(null);
        }}
        disabled={disabled || isLoading}
      />

      {/* Email Input */}
      <AuthInput
        label="Email address"
        placeholder="name@example.com"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (validationError) setValidationError(null);
        }}
        disabled={disabled || isLoading}
      />

      {/* Password Input */}
      <PasswordInput
        label="Password"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          if (validationError) setValidationError(null);
        }}
        disabled={disabled || isLoading}
      />

      {/* Primary Submit CTA */}
      <AuthButton
        title={isLoading ? 'Sending verification code...' : 'Create account'}
        onPress={handleInitiateSignUp}
        loading={isLoading}
        disabled={disabled || isLoading}
      />

      {/* Terms & Legal Disclaimer */}
      <Text style={[styles.legalText, { color: colors.ink3 }]}>
        By signing up, you agree to ChatBox AI's{' '}
        <Text
          style={{ color: '#ffffff', textDecorationLine: 'underline' }}
          onPress={() => Linking.openURL('https://chatboxai.co.in/terms-conditions')}
        >
          Terms of Service
        </Text>
        {' '}and{' '}
        <Text
          style={{ color: '#ffffff', textDecorationLine: 'underline' }}
          onPress={() => Linking.openURL('https://chatboxai.co.in/privacy-policy')}
        >
          Privacy Policy
        </Text>
        .
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
  iconCircleContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  devOtpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: spacing.md,
    alignSelf: 'center',
  },
  devOtpText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium as any,
  },
  otpInputContainer: {
    marginBottom: spacing.lg,
  },
  otpInput: {
    height: 56,
    borderWidth: 1,
    borderRadius: radius.md,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 10,
    paddingHorizontal: spacing.md,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  resendPrompt: {
    fontSize: typography.fontSize.sm,
  },
  resendCooldownText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as any,
  },
  resendButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold as any,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.xs,
  },
  cancelButtonText: {
    fontSize: typography.fontSize.sm,
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
