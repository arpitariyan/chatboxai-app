import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  TextInputProps,
} from 'react-native';
import { useThemeColors, spacing, radius, typography } from '@/theme';

interface PasswordInputProps extends TextInputProps {
  label?: string;
  error?: string;
  disabled?: boolean;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  label = 'Password',
  error,
  disabled = false,
  value,
  placeholder = '••••••••',
  onChangeText,
  ...rest
}) => {
  const colors = useThemeColors();
  const [isFocused, setIsFocused] = useState(false);
  const [secureTextEntry, setSecureTextEntry] = useState(true);

  const isError = !!error;

  return (
    <View style={styles.container}>
      {/* Label */}
      <Text style={[styles.label, { color: isError ? colors.destructive : colors.ink2 }]}>
        {label}
      </Text>

      {/* Input Row Container */}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.inset,
            borderColor: isError
              ? colors.destructive
              : isFocused
              ? colors.ring
              : colors.line,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <TextInput
          style={[styles.input, { color: colors.ink }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.ink3}
          secureTextEntry={secureTextEntry}
          editable={!disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoCapitalize="none"
          {...rest}
        />

        {/* Show / Hide Toggle */}
        <Pressable
          disabled={disabled}
          onPress={() => setSecureTextEntry((prev) => !prev)}
          hitSlop={8}
          style={({ pressed }) => [styles.toggleButton, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.toggleText, { color: colors.ink2 }]}>
            {secureTextEntry ? 'Show' : 'Hide'}
          </Text>
        </Pressable>
      </View>

      {/* Error Message */}
      {isError && (
        <Text style={[styles.errorText, { color: colors.destructive }]}>
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: typography.fontWeight.medium,
    marginBottom: 6,
    letterSpacing: -0.1,
  },
  inputContainer: {
    height: 50,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderCurve: radius.borderCurve,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.normal,
    padding: 0,
  },
  toggleButton: {
    paddingLeft: spacing.sm,
    paddingVertical: spacing.xs,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: typography.fontWeight.semibold,
  },
  errorText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.normal,
    marginTop: 4,
  },
});
