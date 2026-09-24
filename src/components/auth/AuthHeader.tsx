import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { IconArrowLeft } from '@tabler/icons-react-native';
import { spacing } from '@/theme';

interface AuthHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showUnderline?: boolean;
}

export const AuthHeader: React.FC<AuthHeaderProps> = ({
  title,
  subtitle,
  onBack,
  showUnderline = true,
}) => {
  return (
    <View style={styles.container}>
      {onBack && (
        <Pressable
          onPress={onBack}
          hitSlop={10}
          style={({ pressed }) => [
            styles.backButton,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          accessibilityLabel="Go back"
        >
          <IconArrowLeft size={22} color="#ffffff" strokeWidth={2} />
        </Pressable>
      )}

      <Text
        style={[
          styles.title,
          showUnderline && styles.underlineTitle,
        ]}
      >
        {title}
      </Text>

      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#252525',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 34,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: -0.5,
    lineHeight: 42,
  },
  underlineTitle: {
    textDecorationLine: 'underline',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#7F7F7F',
    lineHeight: 20,
    marginTop: 8,
  },
});
