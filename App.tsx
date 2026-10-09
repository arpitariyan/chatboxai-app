import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AuthContainer } from '@/features/auth';
import { AppShell } from '@/features/chat';
import { StartupVideoScreen } from '@/components/common/StartupVideoScreen';

// Ignore non-fatal API key fallback and Expo Go media library warnings from showing up in the LogBox UI
LogBox.ignoreLogs([
  'Due to changes in Androids permission requirements, Expo Go can no longer provide full access to the media library',
  '[groq] API key failed',
  '[openrouter] API key failed',
  '[google] API key failed',
  '[replicate] API key failed',
  '[nvidia] API key failed',
  '[ChatboxAI] Auto fallback',
  'On iOS `VideoPlayer.replace` loads the asset data synchronously',
  'Method getInfoAsync imported from',
]);

import { useColorScheme } from 'react-native';
import { useThemeColors } from '@/theme';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { appIntegrityService } from '@/services/security/AppIntegrityService';

function MainAppContent() {
  const colors = useThemeColors();
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'system' ? systemScheme !== 'light' : themeMode !== 'light';
  const { currentUser, loading } = useAuth();
  const [hasStartupCompleted, setHasStartupCompleted] = useState<boolean>(false);

  React.useEffect(() => {
    // Perform background device integrity and security assessment
    appIntegrityService.checkIntegrity().catch(() => {});
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Main application tree: renders AuthContainer or AppShell */}
      {currentUser ? (
        <AppShell key={currentUser.uid || currentUser.email} />
      ) : (
        <AuthContainer />
      )}

      {/* Full-screen startup video loading experience (displays only Final_loading_video.mp4) */}
      {!hasStartupCompleted && (
        <StartupVideoScreen
          isAppReady={!loading}
          onTransitionComplete={() => setHasStartupCompleted(true)}
        />
      )}
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
    backgroundColor: '#000000',
  },
});
