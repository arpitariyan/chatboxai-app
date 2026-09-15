import React from 'react';
import { StyleSheet, Text, Pressable, ViewStyle, TextStyle } from 'react-native';
import { useThemeColors, spacing, typography } from '@/theme';

interface AuthFooterLinkProps {
  promptText?: string;
  linkText: string;
  onPress: () => void;
  align?: 'center' | 'right' | 'left';
  style?: ViewStyle;
}

export const AuthFooterLink: React.FC<AuthFooterLinkProps> = ({
  promptText,
  linkText,
  onPress,
  align = 'center',
  style,
}) => {
  const colors = useThemeColors();

  const alignmentStyle: TextStyle = {
    textAlign: align,
  };

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.container,
        { opacity: pressed ? 0.65 : 1 },
        style,
      ]}
    >
      <Text style={[styles.text, alignmentStyle]}>
        {promptText && (
          <Text style={{ color: colors.ink2 }}>{promptText} </Text>
        )}
        <Text style={{ color: colors.ink, fontWeight: typography.fontWeight.semibold }}>
          {linkText}
        </Text>
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  text: {
    fontSize: 12,
  },
});
