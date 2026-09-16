import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { AuthCard, AuthButton, AuthHeader } from '@/components/auth';
import { SignInScreen } from './SignInScreen';
import { SignUpScreen } from './SignUpScreen';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { ResetSuccessScreen } from './ResetSuccessScreen';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColors, spacing, typography, radius } from '@/theme';

type AuthView = 'signin' | 'signup' | 'forgot' | 'success';

interface AuthContainerProps {
  initialView?: AuthView;
}

export const AuthContainer: React.FC<AuthContainerProps> = ({
  initialView = 'signin',
}) => {
  const colors = useThemeColors();
  const {
    currentUser,
    userProfile,
    loading: authLoading,
    authError,
    setAuthError,
    signIn,
    signUp,
    signInWithSocial,
    logout,
  } = useAuth();

  const [currentView, setCurrentView] = useState<AuthView>(initialView);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [resetEmail, setResetEmail] = useState<string>('');

  // Handle Sign In Submit
  const handleSignInSubmit = async (email: string, password: string) => {
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch {
      // Error handled by AuthContext state
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Sign Up Submit
  const handleSignUpSubmit = async (email: string, password: string, displayName?: string) => {
    setSubmitting(true);
    try {
      await signUp(email, password, displayName);
    } catch {
      // Error handled by AuthContext state
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Social Authentication (Google, GitHub, Microsoft)
  const handleSocialAuth = async (provider: 'google' | 'github' | 'microsoft') => {
    setSubmitting(true);
    try {
      await signInWithSocial(provider);
    } catch {
      // Error handled by AuthContext state
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AuthCard>
          {currentUser ? (
            /* Authenticated User Dashboard Summary Card */
            <View style={styles.dashboardContainer}>
              <AuthHeader
                title="Welcome to ChatBox AI"
                subtitle="Your account is active and connected"
              />

              <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.profileHeaderRow}>
                  <View style={[styles.avatarCircle, { backgroundColor: colors.accent }]}>
                    <Text style={styles.avatarText}>
                      {(currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.profileInfo}>
                    <Text style={[styles.nameText, { color: colors.ink }]} numberOfLines={1}>
                      {currentUser.displayName || userProfile?.name || 'ChatBox AI User'}
                    </Text>
                    <Text style={[styles.emailText, { color: colors.ink2 }]} numberOfLines={1}>
                      {currentUser.email}
                    </Text>
                  </View>
                </View>

                {/* Database Metrics Grid */}
                <View style={[styles.metricsGrid, { borderColor: colors.border }]}>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: colors.ink2 }]}>Plan</Text>
                    <Text style={[styles.metricValue, { color: colors.accent }]}>
                      {(userProfile?.plan || 'FREE').toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: colors.ink2 }]}>Credits</Text>
                    <Text style={[styles.metricValue, { color: colors.ink }]}>
                      {(userProfile?.credits ?? 5000).toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: colors.ink2 }]}>Appwrite Sync</Text>
                    <Text style={[styles.metricValue, { color: userProfile ? '#4ade80' : '#f87171' }]}>
                      {userProfile ? 'CONNECTED' : 'OFFLINE'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Logout CTA */}
              <View style={{ marginTop: spacing.md }}>
                <AuthButton
                  title="Sign out"
                  onPress={logout}
                />
              </View>
            </View>
          ) : (
            /* Unauthenticated Auth Views */
            <>
              {currentView === 'signin' && (
                <SignInScreen
                  onNavigateSignUp={() => {
                    setAuthError(null);
                    setCurrentView('signup');
                  }}
                  onNavigateForgotPassword={() => {
                    setAuthError(null);
                    setCurrentView('forgot');
                  }}
                  onSubmitSignIn={handleSignInSubmit}
                  onSocialPress={handleSocialAuth}
                  loading={submitting}
                  errorMessage={authError}
                />
              )}

              {currentView === 'signup' && (
                <SignUpScreen
                  onNavigateSignIn={() => {
                    setAuthError(null);
                    setCurrentView('signin');
                  }}
                  onSubmitSignUp={handleSignUpSubmit}
                  onSocialPress={handleSocialAuth}
                  loading={submitting}
                  errorMessage={authError}
                />
              )}

              {currentView === 'forgot' && (
                <ForgotPasswordScreen
                  onNavigateSignIn={() => {
                    setAuthError(null);
                    setCurrentView('signin');
                  }}
                  loading={submitting}
                />
              )}

              {currentView === 'success' && (
                <ResetSuccessScreen
                  email={resetEmail || 'your email'}
                  onNavigateSignIn={() => {
                    setAuthError(null);
                    setCurrentView('signin');
                  }}
                />
              )}
            </>
          )}
        </AuthCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
  },
  dashboardContainer: {
    width: '100%',
  },
  profileCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold as any,
  },
  profileInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  nameText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold as any,
  },
  emailText: {
    fontSize: typography.fontSize.sm,
    marginTop: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: typography.fontSize.xs,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold as any,
  },
});
