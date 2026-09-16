import React from 'react';
import { StyleSheet, Text, View, Pressable, Switch } from 'react-native';
import { IconChevronRight } from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius, typography } from '@/theme';

interface ListRowProps {
  icon?: React.ReactNode | string;
  title: string;
  subtitle?: string;
  value?: string;
  isSwitch?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (val: boolean) => void;
  onPress?: () => void;
  destructive?: boolean;
  showChevron?: boolean;
}

export const ListRow: React.FC<ListRowProps> = ({
  icon,
  title,
  subtitle,
  value,
  isSwitch = false,
  switchValue = false,
  onSwitchChange,
  onPress,
  destructive = false,
  showChevron = true,
}) => {
  const colors = useThemeColors();

  return (
    <Pressable
      disabled={isSwitch || !onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      {/* Icon if provided */}
      {icon ? (
        <View style={[styles.iconBox, { backgroundColor: colors.inset }]}>
          {typeof icon === 'string' ? (
            <Text style={styles.iconText}>{icon}</Text>
          ) : (
            icon
          )}
        </View>
      ) : null}

      {/* Main Text Content */}
      <View style={styles.textContainer}>
        <Text
          style={[
            styles.title,
            { color: destructive ? colors.destructive : colors.ink },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.ink2 }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {/* Right Controls */}
      {isSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: colors.line, true: colors.accent }}
          thumbColor="#ffffff"
        />
      ) : (
        <View style={styles.rightSide}>
          {value ? (
            <Text style={[styles.valueText, { color: colors.ink2 }]}>{value}</Text>
          ) : null}
          {showChevron && onPress ? (
            <IconChevronRight size={16} color={colors.ink3} />
          ) : null}
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    height: 52,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    borderCurve: radius.borderCurve,
  },
  iconText: {
    fontSize: 16,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  subtitle: {
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  rightSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  valueText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  chevron: {
    fontSize: 18,
    fontWeight: '300',
  },
});
