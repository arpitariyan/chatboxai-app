import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TextInputProps,
} from 'react-native';
import { useThemeColors, spacing, radius, typography } from '@/theme';

interface AuthInputProps extends TextInputProps {
  label: string;
  error?: string;
  disabled?: boolean;
}

export const AuthInput: React.FC<AuthInputProps> = ({
  label,
  error,
  disabled = false,
  value,
  placeholder,
  onChangeText,
  keyboardType = 'email-address',
  autoCapitalize = 'none',
  ...rest
}) => {
  const colors = useThemeColors();
  const [isFocused, setIsFocused] = useState(false);

  const isError = !!error;

  return (
    <View style={styles.container}>
      {/* Field Label */}
      <Text style={[styles.label, { color: isError ? colors.destructive : colors.ink2 }]}>
        {label}
      </Text>

      {/* Input Box */}
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
          editable={!disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          {...rest}
        />
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
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: typography.fontWeight.medium,
    marginBottom: 6,
  },
  inputContainer: {
    height: 46,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderCurve: radius.borderCurve,
  },
  input: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.normal,
    padding: 0,
  },
  errorText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.normal,
    marginTop: 4,
  },
});
