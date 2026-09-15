import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { useThemeColors, spacing, radius } from '@/theme';

interface AuthCardProps extends ViewProps {
  children: React.ReactNode;
}

export const AuthCard: React.FC<AuthCardProps> = ({ children, style, ...rest }) => {
  const colors = useThemeColors();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.xl,
    alignSelf: 'center',
    borderCurve: radius.borderCurve,
  },
});
