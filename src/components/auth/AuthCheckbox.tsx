import React from 'react';
import { StyleSheet, Text, Pressable, View } from 'react-native';
import { IconCheck } from '@tabler/icons-react-native';

interface AuthCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

export const AuthCheckbox: React.FC<AuthCheckboxProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
}) => {
  return (
    <Pressable
      disabled={disabled}
      onPress={() => onChange(!checked)}
      hitSlop={8}
      style={({ pressed }) => [
        styles.container,
        { opacity: disabled ? 0.5 : pressed ? 0.75 : 1 },
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.checkbox,
          {
            borderColor: checked ? '#ffffff' : '#7F7F7F',
            backgroundColor: checked ? '#ffffff' : 'transparent',
          },
        ]}
      >
        {checked && <IconCheck size={11} color="#000000" strokeWidth={3.5} />}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
});
