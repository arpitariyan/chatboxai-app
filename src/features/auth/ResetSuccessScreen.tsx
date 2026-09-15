import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AuthSuccessState } from '@/components/auth';

interface ResetSuccessScreenProps {
  email?: string;
  onNavigateSignIn: () => void;
  onResendEmail?: () => void;
}

export const ResetSuccessScreen: React.FC<ResetSuccessScreenProps> = ({
  email = 'user@chatboxai.com',
  onNavigateSignIn,
  onResendEmail,
}) => {
  return (
    <View style={styles.container}>
      <AuthSuccessState
        email={email}
        onBackToSignIn={onNavigateSignIn}
        onResendEmail={onResendEmail}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});
