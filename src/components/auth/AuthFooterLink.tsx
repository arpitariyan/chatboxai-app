import React from 'react';
import { StyleSheet, Text, Pressable, ViewStyle, TextStyle } from 'react-native';
import { spacing } from '@/theme';

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
      accessibilityRole="button"
      accessibilityLabel={`${promptText || ''} ${linkText}`}
    >
      <Text style={[styles.text, alignmentStyle]}>
        {promptText ? (
          <Text style={styles.promptText}>{promptText} </Text>
        ) : null}
        <Text style={styles.linkText}>{linkText}</Text>
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs + 2,
    marginTop: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 14,
    letterSpacing: -0.1,
  },
  promptText: {
    color: '#7F7F7F',
    fontWeight: '500',
  },
  linkText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
