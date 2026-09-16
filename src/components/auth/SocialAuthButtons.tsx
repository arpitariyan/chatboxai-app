import React from 'react';
import { StyleSheet, Text, View, Pressable, Image, ActivityIndicator } from 'react-native';
import { useThemeColors, spacing, radius, typography } from '@/theme';

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
  const colors = useThemeColors();

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
                backgroundColor: colors.inset,
                borderColor: colors.line,
                opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
                transform: [{ scale: pressed ? 0.985 : 1 }],
              },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.ink2} />
            ) : (
              <>
                <View style={styles.iconWrapper}>
                  <Image
                    source={provider.iconSource}
                    style={styles.iconImage}
                    resizeMode="contain"
                  />
                </View>
                <Text style={[styles.buttonText, { color: colors.ink }]}>
                  {provider.name}
                </Text>
              </>
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
    marginBottom: spacing.md,
  },
  button: {
    height: 50,
    borderRadius: radius.control,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderCurve: radius.borderCurve,
  },
  iconWrapper: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  iconImage: {
    width: 22,
    height: 22,
  },
  buttonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    letterSpacing: -0.1,
  },
});
