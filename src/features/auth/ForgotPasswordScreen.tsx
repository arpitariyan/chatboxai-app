import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react-native';
import {
  AuthHeader,
  AuthInput,
  PasswordInput,
  AuthButton,
  AuthFooterLink,
} from '@/components/auth';
import { useAuth } from '@/contexts/AuthContext';
import { spacing } from '@/theme';

interface ForgotPasswordScreenProps {
  onNavigateSignIn: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  onNavigateSignIn,
  loading: externalLoading = false,
  disabled = false,
}) => {
  const { requestPasswordResetOtp, confirmPasswordResetOtp } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  const [localLoading, setLocalLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const isLoading = externalLoading || localLoading;

  // Step 1: Send OTP to Email
  const handleSendOtp = async () => {
    setError(null);
    setDevOtp(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLocalLoading(true);
    try {
      const res = await requestPasswordResetOtp(email.trim());
      if (res?.devOtp) {
        setDevOtp(res.devOtp);
      }
      setStep(2);
    } catch (err: any) {
      setError(err?.message || 'Failed to send reset code. Please try again.');
    } finally {
      setLocalLoading(false);
    }
  };

  // Step 2: Verify OTP & Reset Password
  const handleResetPassword = async () => {
    setError(null);

    const cleanOtp = otp.replace(/\D/g, '').slice(0, 6);
    if (!cleanOtp || cleanOtp.length !== 6) {
      setError('Please enter the full 6-digit reset code');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please check and try again.');
      return;
    }

    setLocalLoading(true);
    try {
      await confirmPasswordResetOtp(email.trim(), cleanOtp, newPassword);
      setStep(3);
    } catch (err: any) {
      setError(err?.message || 'Failed to reset password. Please check your OTP.');
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Dynamic Header */}
      <AuthHeader
        title={step === 3 ? 'Password reset complete' : 'Forgot Password'}
        subtitle={
          step === 1
            ? 'Enter your email to receive a 6-digit recovery code'
            : step === 2
              ? `We sent a 6-digit code to ${email}`
              : 'You can now sign in with your new password'
        }
        onBack={step === 2 ? () => setStep(1) : undefined}
      />

      {/* Global Error Banner */}
      {error ? (
        <View style={styles.errorBanner}>
          <IconAlertCircle size={16} color="#f87171" style={{ marginRight: 6 }} />
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      ) : null}

      {/* STEP 1: Enter Email */}
      {step === 1 && (
        <>
          <AuthInput
            label="Email"
            placeholder="Enter Your Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (error) setError(null);
            }}
            disabled={disabled || isLoading}
            autoComplete="email"
          />

          <AuthButton
            title={isLoading ? 'Sending code...' : 'Send reset code'}
            onPress={handleSendOtp}
            loading={isLoading}
            disabled={disabled || !email.trim()}
          />
        </>
      )}

      {/* STEP 2: Enter 6-digit OTP Code & New Password */}
      {step === 2 && (
        <>
          {devOtp ? (
            <View style={styles.devBanner}>
              <Text style={styles.devBannerText}>
                [Dev Mode] Your OTP code is: <Text style={{ fontWeight: '700' }}>{devOtp}</Text>
              </Text>
            </View>
          ) : null}

          <AuthInput
            label="6-Digit Reset Code"
            placeholder="000000"
            value={otp}
            onChangeText={(text) => {
              const numeric = text.replace(/\D/g, '').slice(0, 6);
              setOtp(numeric);
              if (error) setError(null);
            }}
            keyboardType="number-pad"
            disabled={disabled || isLoading}
            maxLength={6}
          />

          <PasswordInput
            label="New Password"
            placeholder="**********"
            value={newPassword}
            onChangeText={(text) => {
              setNewPassword(text);
              if (error) setError(null);
            }}
            disabled={disabled || isLoading}
          />

          <PasswordInput
            label="Confirm New Password"
            placeholder="**********"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (error) setError(null);
            }}
            disabled={disabled || isLoading}
          />

          <AuthButton
            title={isLoading ? 'Resetting password...' : 'Reset password'}
            onPress={handleResetPassword}
            loading={isLoading}
            disabled={disabled || otp.length !== 6 || !newPassword || !confirmPassword}
          />

          <View style={{ marginTop: spacing.sm }}>
            <AuthFooterLink
              promptText="Didn't get the code?"
              linkText="Resend code"
              onPress={handleSendOtp}
              align="center"
            />
          </View>
        </>
      )}

      {/* STEP 3: Reset Success Confirmation */}
      {step === 3 && (
        <View style={styles.successContainer}>
          <View style={styles.successBadge}>
            <IconCheck size={28} color="#000000" strokeWidth={3} />
          </View>
          <Text style={styles.successText}>
            Your password has been successfully reset!
          </Text>
          <AuthButton
            title="Sign in now"
            onPress={onNavigateSignIn}
          />
        </View>
      )}

      {/* Back to Sign In Link */}
      {step < 3 && (
        <AuthFooterLink
          promptText="Remember your password ?"
          linkText="Sign in"
          onPress={onNavigateSignIn}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
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
  devBanner: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#854d0e',
    backgroundColor: '#36240d',
    marginBottom: spacing.md,
  },
  devBannerText: {
    fontSize: 12,
    color: '#fef08a',
    textAlign: 'center',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  successBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  successText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
});
