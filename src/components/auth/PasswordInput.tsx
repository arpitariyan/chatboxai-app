import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  TextInputProps,
} from 'react-native';
import { IconLock, IconEye, IconEyeOff } from '@tabler/icons-react-native';
import { spacing } from '@/theme';

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
  const [isFocused, setIsFocused] = useState(false);
  const [secureTextEntry, setSecureTextEntry] = useState(true);

  const isError = !!error;

  const activeBorderColor = isError
    ? '#ef4444'
    : isFocused
    ? '#ffffff'
    : 'rgba(255, 255, 255, 0.35)';

  const activeDividerColor = isFocused ? '#ffffff' : '#7F7F7F';

  return (
    <View style={styles.container}>
      {/* Label */}
      <Text style={styles.label}>{label}</Text>

      {/* Underline Input Row */}
      <View
        style={[
          styles.inputRow,
          {
            borderBottomColor: activeBorderColor,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <View style={styles.leftGroup}>
          {/* Lock Icon */}
          <View style={styles.iconBox}>
            <IconLock
              size={18}
              color={isFocused ? '#ffffff' : '#7F7F7F'}
              strokeWidth={1.8}
            />
          </View>

          {/* Vertical Separator Hairline */}
          <View
            style={[styles.verticalDivider, { backgroundColor: activeDividerColor }]}
          />

          {/* Password Input */}
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#7F7F7F"
            secureTextEntry={secureTextEntry}
            editable={!disabled}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            autoCapitalize="none"
            selectionColor="#ffffff"
            {...rest}
          />
        </View>

        {/* View / Eye Toggle Button */}
        <Pressable
          disabled={disabled}
          onPress={() => setSecureTextEntry((prev) => !prev)}
          hitSlop={8}
          style={({ pressed }) => [
            styles.eyeButton,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          accessibilityLabel={secureTextEntry ? 'Show password' : 'Hide password'}
          accessibilityRole="button"
        >
          {secureTextEntry ? (
            <IconEye size={18} color="#7F7F7F" strokeWidth={1.8} />
          ) : (
            <IconEyeOff size={18} color="#ffffff" strokeWidth={1.8} />
          )}
        </Pressable>
      </View>

      {/* Error Message */}
      {isError && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1.5,
    paddingBottom: 8,
    minHeight: 38,
  },
  leftGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verticalDivider: {
    width: 1,
    height: 16,
    opacity: 0.7,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  eyeButton: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 6,
    fontWeight: '500',
  },
});
