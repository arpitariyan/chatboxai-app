import React, { useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { AuthCard } from '@/components/auth';
import { SignInScreen } from './SignInScreen';
import { SignUpScreen } from './SignUpScreen';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { ResetSuccessScreen } from './ResetSuccessScreen';
import { useThemeColors, spacing } from '@/theme';

type AuthView = 'signin' | 'signup' | 'forgot' | 'success';

interface AuthContainerProps {
  initialView?: AuthView;
}

export const AuthContainer: React.FC<AuthContainerProps> = ({
  initialView = 'signin',
}) => {
  const colors = useThemeColors();

  // Active Auth Screen State
  const [currentView, setCurrentView] = useState<AuthView>(initialView);

  // Form State
  const [isLoading, setIsLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('user@chatboxai.com');

  const handleSignInSubmit = (email: string) => {
    setUserEmail(email);
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 1500);
  };

  const handleSignUpSubmit = (email: string) => {
    setUserEmail(email);
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setCurrentView('signin');
    }, 1500);
  };

  const handleForgotPasswordSubmit = (email: string) => {
    setUserEmail(email);
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setCurrentView('success');
    }, 1500);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Main Authentication Card */}
        <AuthCard>
          {currentView === 'signin' && (
            <SignInScreen
              onNavigateSignUp={() => setCurrentView('signup')}
              onNavigateForgotPassword={() => setCurrentView('forgot')}
              onSubmitSignIn={handleSignInSubmit}
              loading={isLoading}
            />
          )}

          {currentView === 'signup' && (
            <SignUpScreen
              onNavigateSignIn={() => setCurrentView('signin')}
              onSubmitSignUp={handleSignUpSubmit}
              loading={isLoading}
            />
          )}

          {currentView === 'forgot' && (
            <ForgotPasswordScreen
              onNavigateSignIn={() => setCurrentView('signin')}
              onSubmitSendResetLink={handleForgotPasswordSubmit}
              loading={isLoading}
            />
          )}

          {currentView === 'success' && (
            <ResetSuccessScreen
              email={userEmail}
              onNavigateSignIn={() => setCurrentView('signin')}
              onResendEmail={() => {
                setIsLoading(true);
                setTimeout(() => setIsLoading(false), 1200);
              }}
            />
          )}
        </AuthCard>
      </ScrollView>
    </View>
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
});
