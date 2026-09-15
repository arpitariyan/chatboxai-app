import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { AuthContainer } from '@/features/auth';
import { getColors } from '@/theme';

export default function App() {
  // Dark mode by default for premium AI experience
  const colors = getColors('dark', 'violet');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      <AuthContainer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
});
