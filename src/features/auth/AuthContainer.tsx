import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthCard, AuthButton, AuthHeader } from '@/components/auth';
import { SignInScreen } from './SignInScreen';
import { SignUpScreen } from './SignUpScreen';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { ResetSuccessScreen } from './ResetSuccessScreen';
import { useAuth } from '@/contexts/AuthContext';
import { spacing } from '@/theme';

const heroImg = require('../../../assets/images/auth-hero.jpg');
const logoImg = require('../../../assets/images/logo.png');

type AuthView = 'signin' | 'signup' | 'forgot' | 'success';

interface AuthContainerProps {
  initialView?: AuthView;
}

export const AuthContainer: React.FC<AuthContainerProps> = ({
  initialView = 'signin',
}) => {
  const insets = useSafeAreaInsets();
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
      <View style={[styles.root, styles.loadingCenter]}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Top Hero Banner — matching Figma top image with smooth black fade */}
        <View style={styles.heroWrapper}>
          <Image source={heroImg} style={styles.heroImage} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0.85)', '#000000']}
            locations={[0, 0.45, 0.75, 1.0]}
            style={styles.heroFade}
            pointerEvents="none"
          />
          {/* Brand Logo floating over the hero top area */}
          <View style={[styles.brandContainer, { paddingTop: Math.max(insets.top, 16) }]}>
            <Image source={logoImg} style={styles.brandLogo} resizeMode="contain" />
          </View>
        </View>

        {/* Form Body Card */}
        <View style={styles.formContainer}>
          <AuthCard>
            {currentUser ? (
              /* Authenticated User Dashboard Summary Card */
              <View style={styles.dashboardContainer}>
                <AuthHeader
                  title="Welcome back"
                  subtitle="Your account is active and connected"
                />

                <View style={styles.profileCard}>
                  <View style={styles.profileHeaderRow}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarText}>
                        {(currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.profileInfo}>
                      <Text style={styles.nameText} numberOfLines={1}>
                        {currentUser.displayName || userProfile?.name || 'ChatBox AI User'}
                      </Text>
                      <Text style={styles.emailText} numberOfLines={1}>
                        {currentUser.email}
                      </Text>
                    </View>
                  </View>

                  {/* Database Metrics Grid */}
                  <View style={styles.metricsGrid}>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Plan</Text>
                      <Text style={[styles.metricValue, { color: '#ffffff' }]}>
                        {(userProfile?.plan || 'FREE').toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Credits</Text>
                      <Text style={styles.metricValue}>
                        {(userProfile?.credits ?? 5000).toLocaleString()}
                      </Text>
                    </View>

                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Appwrite Sync</Text>
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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    backgroundColor: '#000000', // True pitch black from Figma bg-black
  },
  loadingCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
  },
  heroWrapper: {
    width: '100%',
    height: 230,
    position: 'relative',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 230,
  },
  heroFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
  },
  brandContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  brandLogo: {
    width: 140,
    height: 44,
  },
  formContainer: {
    width: '100%',
    paddingHorizontal: spacing.md,
    marginTop: -spacing.md,
  },
  dashboardContainer: {
    width: '100%',
  },
  profileCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#252525',
    backgroundColor: '#18181b',
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
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '700',
  },
  profileInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  nameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  emailText: {
    fontSize: 13,
    color: '#7F7F7F',
    marginTop: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#252525',
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 11,
    color: '#7F7F7F',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
