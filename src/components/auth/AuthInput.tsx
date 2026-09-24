import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TextInputProps,
} from 'react-native';
import { IconMail, IconUser } from '@tabler/icons-react-native';
import { spacing } from '@/theme';

interface AuthInputProps extends TextInputProps {
  label: string;
  error?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
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
  icon,
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const isError = !!error;

  // Default icon selection based on label/keyboardType if not explicitly passed
  const renderIcon = () => {
    if (icon) return icon;
    const lower = label.toLowerCase();
    if (lower.includes('name') || lower.includes('user')) {
      return (
        <IconUser
          size={18}
          color={isFocused ? '#ffffff' : '#7F7F7F'}
          strokeWidth={1.8}
        />
      );
    }
    // Default mail icon for email or general fields
    return (
      <IconMail
        size={18}
        color={isFocused ? '#ffffff' : '#7F7F7F'}
        strokeWidth={1.8}
      />
    );
  };

  const activeBorderColor = isError
    ? '#ef4444'
    : isFocused
    ? '#ffffff'
    : 'rgba(255, 255, 255, 0.35)';

  const activeDividerColor = isFocused ? '#ffffff' : '#7F7F7F';

  return (
    <View style={styles.container}>
      {/* Field Label */}
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
          {/* Icon */}
          <View style={styles.iconBox}>{renderIcon()}</View>

          {/* Vertical Separator Hairline */}
          <View
            style={[styles.verticalDivider, { backgroundColor: activeDividerColor }]}
          />

          {/* Text Input */}
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#7F7F7F"
            editable={!disabled}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            selectionColor="#ffffff"
            {...rest}
          />
        </View>
      </View>

      {/* Error Message */}
      {isError && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: spacing.lg,
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
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 6,
    fontWeight: '500',
  },
});
