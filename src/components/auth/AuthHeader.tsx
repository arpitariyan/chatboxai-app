import React from 'react';
import { StyleSheet, Text, View, Image } from 'react-native';
import { useThemeColors, spacing, typography } from '@/theme';

interface AuthHeaderProps {
  title: string;
  subtitle: string;
}

const logoImg = require('../../../assets/images/logo.png');

export const AuthHeader: React.FC<AuthHeaderProps> = ({ title, subtitle }) => {
  const colors = useThemeColors();

  return (
    <View style={styles.container}>
      {/* Hero ChatBox AI Brand Logo Image */}
      <Image source={logoImg} style={styles.heroLogo} resizeMode="contain" />

      {/* Screen Title */}
      <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>

      {/* Supporting Subtitle */}
      <Text style={[styles.subtitle, { color: colors.ink2 }]}>{subtitle}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    width: '100%',
  },
  heroLogo: {
    width: 160,
    height: 56,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.normal,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 310,
  },
});

