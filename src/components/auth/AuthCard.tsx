import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { spacing } from '@/theme';

interface AuthCardProps extends ViewProps {
  children: React.ReactNode;
}

export const AuthCard: React.FC<AuthCardProps> = ({ children, style, ...rest }) => {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingHorizontal: spacing.xs,
  },
});
