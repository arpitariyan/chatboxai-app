import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AuthContainer } from '@/features/auth';
import { AppShell } from '@/features/chat';
import { getColors } from '@/theme';

// Ignore non-fatal API key fallback and Expo Go media library warnings from showing up in the LogBox UI
LogBox.ignoreLogs([
  'Due to changes in Androids permission requirements, Expo Go can no longer provide full access to the media library',
  '[groq] API key failed',
  '[openrouter] API key failed',
  '[google] API key failed',
  '[replicate] API key failed',
  '[nvidia] API key failed',
  '[ChatboxAI] Auto fallback'
]);

function MainAppContent() {
  const colors = getColors('dark', 'violet');
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      {currentUser ? <AppShell key={currentUser.uid || currentUser.email} /> : <AuthContainer />}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <MainAppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
