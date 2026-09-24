import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing } from '@/theme';

export const AuthDivider: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <Text style={styles.text}>OR</Text>
      <View style={styles.line} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
    width: '100%',
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  text: {
    paddingHorizontal: spacing.md,
    fontSize: 12,
    fontWeight: '600',
    color: '#7F7F7F',
    letterSpacing: 1.5,
  },
});
