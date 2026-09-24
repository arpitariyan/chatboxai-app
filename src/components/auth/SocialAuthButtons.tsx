import React from 'react';
import { StyleSheet, Text, View, Pressable, Image, ActivityIndicator } from 'react-native';
import { spacing } from '@/theme';

interface SocialAuthButtonsProps {
  onProviderPress?: (provider: 'google' | 'github' | 'microsoft') => void;
  loadingProvider?: 'google' | 'github' | 'microsoft' | null;
  disabled?: boolean;
}

const googleLogo = require('../../../assets/images/google.png');
const githubLogo = require('../../../assets/images/github.png');
const microsoftLogo = require('../../../assets/images/microsoft.png');

export const SocialAuthButtons: React.FC<SocialAuthButtonsProps> = ({
  onProviderPress,
  loadingProvider,
  disabled = false,
}) => {
  const providers = [
    {
      id: 'google' as const,
      name: 'Continue with Google',
      iconSource: googleLogo,
    },
    {
      id: 'github' as const,
      name: 'Continue with GitHub',
      iconSource: githubLogo,
    },
    {
      id: 'microsoft' as const,
      name: 'Continue with Microsoft',
      iconSource: microsoftLogo,
    },
  ];

  return (
    <View style={styles.container}>
      {providers.map((provider) => {
        const isLoading = loadingProvider === provider.id;

        return (
          <Pressable
            key={provider.id}
            disabled={disabled || !!loadingProvider}
            onPress={() => onProviderPress?.(provider.id)}
            style={({ pressed }) => [
              styles.button,
              {
                opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.985 : 1 }],
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={provider.name}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <View style={styles.contentRow}>
                <Image
                  source={provider.iconSource}
                  style={styles.iconImage}
                  resizeMode="contain"
                />
                <Text style={styles.buttonText}>{provider.name}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  button: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: '#1c1c20',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconImage: {
    width: 20,
    height: 20,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
});
