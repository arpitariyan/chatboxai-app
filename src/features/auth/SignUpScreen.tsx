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
import { spacing } from '@/theme';

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
          <View style={styles.iconCircle}>
            <IconMail size={28} color="#ffffff" />
          </View>
        </View>

        <AuthHeader
          title="Verify your email"
          subtitle={`Enter the 6-digit confirmation code sent to\n${email.trim()}`}
          onBack={() => {
            setOtpStep(false);
            setOtp('');
            setOtpError(null);
            setDevOtp(null);
          }}
        />

        {otpError ? (
          <View style={styles.errorBanner}>
            <IconAlertCircle size={16} color="#f87171" style={{ marginRight: 6 }} />
            <Text style={styles.errorBannerText}>{otpError}</Text>
          </View>
        ) : null}

        {devOtp ? (
          <View style={styles.devOtpBadge}>
            <IconCode size={14} color="#38bdf8" style={{ marginRight: 6 }} />
            <Text style={styles.devOtpText}>Dev Code: {devOtp}</Text>
          </View>
        ) : null}

        {/* 6-digit Code Input */}
        <View style={styles.otpInputContainer}>
          <TextInput
            style={[
              styles.otpInput,
              { borderColor: otpError ? '#ef4444' : '#ffffff' },
            ]}
            value={otp}
            onChangeText={(text) => {
              setOtp(text.replace(/[^0-9]/g, ''));
              if (otpError) setOtpError(null);
            }}
            placeholder="000000"
            placeholderTextColor="#7F7F7F"
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            editable={!isVerifying}
            selectionColor="#ffffff"
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
          <Text style={styles.resendPrompt}>Didn't receive the code? </Text>
          {resendCooldown > 0 ? (
            <Text style={styles.resendCooldownText}>
              Resend in {resendCooldown}s
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResendOtp} disabled={isResending}>
              <Text style={styles.resendButtonText}>
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
          <IconArrowLeft size={16} color="#7F7F7F" style={{ marginRight: 6 }} />
          <Text style={styles.cancelButtonText}>Change email address</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render Step 1: Registration Form ───────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Figma Signature Title: Sign up with underline */}
      <AuthHeader
        title="Sign up"
        subtitle="Create your account to start building with ChatBox AI"
      />

      {/* Global Error Banner */}
      {activeError ? (
        <View style={styles.errorBanner}>
          <IconAlertCircle size={16} color="#f87171" style={{ marginRight: 6 }} />
          <Text style={styles.errorBannerText}>{activeError}</Text>
        </View>
      ) : null}

      {/* Display Name Input — Figma Underline Style */}
      <AuthInput
        label="Full name"
        placeholder="John Doe"
        value={name}
        onChangeText={(text) => {
          setName(text);
          if (validationError) setValidationError(null);
        }}
        disabled={disabled || isLoading}
        autoComplete="name"
      />

      {/* Email Input — Figma Underline Style */}
      <AuthInput
        label="Email"
        placeholder="Enter Your Email"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (validationError) setValidationError(null);
        }}
        disabled={disabled || isLoading}
        autoComplete="email"
      />

      {/* Password Input — Figma Underline Style with Eye Toggle */}
      <PasswordInput
        label="Password"
        placeholder="Enter Your Password"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          if (validationError) setValidationError(null);
        }}
        disabled={disabled || isLoading}
        autoComplete="password-new"
      />

      {/* Primary Submit CTA: High-contrast pure white button with bold black text */}
      <AuthButton
        title={isLoading ? 'Sending verification code...' : 'Sign up'}
        onPress={handleInitiateSignUp}
        loading={isLoading}
        disabled={disabled || isLoading}
      />

      {/* Terms & Legal Disclaimer */}
      <Text style={styles.legalText}>
        By signing up, you agree to ChatBox AI's{' '}
        <Text
          style={styles.legalLink}
          onPress={() => Linking.openURL('https://chatboxai.co.in/terms-conditions')}
        >
          Terms of Service
        </Text>
        {' '}and{' '}
        <Text
          style={styles.legalLink}
          onPress={() => Linking.openURL('https://chatboxai.co.in/privacy-policy')}
        >
          Privacy Policy
        </Text>
        .
      </Text>

      {/* Divider */}
      <AuthDivider />

      {/* Social Provider Buttons */}
      <SocialAuthButtons
        onProviderPress={handleSocialPress}
        loadingProvider={loadingProvider}
        disabled={disabled || isLoading}
      />

      {/* Secondary Navigation */}
      <AuthFooterLink
        promptText="Already have an Account ?"
        linkText="Sign in"
        onPress={onNavigateSignIn}
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
    borderColor: '#252525',
    backgroundColor: '#18181b',
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
  devOtpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
    marginBottom: spacing.md,
    alignSelf: 'center',
  },
  devOtpText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#38bdf8',
  },
  otpInputContainer: {
    marginBottom: spacing.lg,
  },
  otpInput: {
    height: 56,
    borderBottomWidth: 2,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 10,
    color: '#ffffff',
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.md,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  resendPrompt: {
    fontSize: 13,
    color: '#7F7F7F',
  },
  resendCooldownText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#7F7F7F',
  },
  resendButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.xs,
  },
  cancelButtonText: {
    fontSize: 13,
    color: '#7F7F7F',
  },
  legalText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.md,
    color: '#7F7F7F',
    paddingHorizontal: spacing.xs,
  },
  legalLink: {
    color: '#ffffff',
    textDecorationLine: 'underline',
  },
});
