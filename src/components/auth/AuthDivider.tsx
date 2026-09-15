import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemeColors, spacing, typography } from '@/theme';

export const AuthDivider: React.FC = () => {
  const colors = useThemeColors();

  return (
    <View style={styles.container}>
      <View style={[styles.line, { backgroundColor: colors.line }]} />
      <Text style={[styles.text, { color: colors.ink3, backgroundColor: colors.surface }]}>
        OR
      </Text>
      <View style={[styles.line, { backgroundColor: colors.line }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
    width: '100%',
  },
  line: {
    flex: 1,
    height: 1,
  },
  text: {
    paddingHorizontal: spacing.sm,
    fontSize: 11,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 1.2,
  },
});
