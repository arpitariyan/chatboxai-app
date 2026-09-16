import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconMenu2,
  IconChevronDown,
  IconEdit,
  IconDotsVertical,
  IconSparkles,
} from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius, typography } from '@/theme';

interface HeaderProps {
  currentModel?: string;
  onOpenDrawer: () => void;
  onOpenModelSelector: () => void;
  onNewChat: () => void;
  onOpenOptionsMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentModel = 'ChatBox AI Pro',
  onOpenDrawer,
  onOpenModelSelector,
  onNewChat,
  onOpenOptionsMenu,
}) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: Math.max(insets.top, 12),
        },
      ]}
    >
      <View style={styles.headerRow}>
        {/* Left Segmented Pill: [ Menu Button | Divider | ChatBox AI Pro ▾ ] */}
        <View
          style={[
            styles.segmentedPill,
            {
              backgroundColor: colors.surface,
              borderColor: colors.line,
            },
          ]}
        >
          {/* Action 1: Menu / Drawer Toggle */}
          <Pressable
            onPress={onOpenDrawer}
            hitSlop={6}
            accessibilityLabel="Open navigation menu"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.segmentedButton,
              styles.menuAction,
              {
                backgroundColor: pressed ? colors.hover : 'transparent',
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <IconMenu2 size={19} color={colors.ink} />
          </Pressable>

          {/* Hairline Divider */}
          <View style={[styles.pillDivider, { backgroundColor: colors.line }]} />

          {/* Action 2: Model Selector / ChatBox AI Pro */}
          <Pressable
            onPress={onOpenModelSelector}
            hitSlop={6}
            accessibilityLabel="Select AI Model"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.segmentedButton,
              styles.modelAction,
              {
                backgroundColor: pressed ? colors.hover : 'transparent',
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <IconSparkles size={14} color={colors.accent} />
            <Text style={[styles.modelName, { color: colors.ink }]} numberOfLines={1}>
              {currentModel}
            </Text>
            <IconChevronDown size={13} color={colors.ink2} />
          </Pressable>
        </View>

        {/* Right Segmented Pill: [ New Chat | Divider | Options (⋮) ] */}
        <View
          style={[
            styles.segmentedPill,
            {
              backgroundColor: colors.surface,
              borderColor: colors.line,
            },
          ]}
        >
          {/* Action 1: New Chat */}
          <Pressable
            onPress={onNewChat}
            hitSlop={6}
            accessibilityLabel="Start new chat"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.segmentedButton,
              styles.iconAction,
              {
                backgroundColor: pressed ? colors.hover : 'transparent',
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <IconEdit size={18} color={colors.ink} />
          </Pressable>

          {/* Hairline Divider */}
          <View style={[styles.pillDivider, { backgroundColor: colors.line }]} />

          {/* Action 2: Options / Settings Menu */}
          <Pressable
            onPress={onOpenOptionsMenu || onOpenModelSelector}
            hitSlop={6}
            accessibilityLabel="More options"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.segmentedButton,
              styles.iconAction,
              {
                backgroundColor: pressed ? colors.hover : 'transparent',
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <IconDotsVertical size={18} color={colors.ink} />
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderBottomWidth: 0,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    zIndex: 10,
  },
  headerRow: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  segmentedPill: {
    height: 38,
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderCurve: radius.borderCurve,
  },
  segmentedButton: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuAction: {
    paddingHorizontal: 12,
  },
  modelAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 6,
  },
  modelName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: -0.2,
    maxWidth: 130,
  },
  iconAction: {
    paddingHorizontal: 11,
  },
  pillDivider: {
    width: 1,
    height: 18,
  },
});

