import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconMenu2,
  IconEdit,
  IconDotsVertical,
} from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius } from '@/theme';

interface HeaderProps {
  onOpenDrawer: () => void;
  onNewChat: () => void;
  onOpenOptionsMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenDrawer,
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
        {/* Left Action: Menu Toggle */}
        <Pressable
          onPress={onOpenDrawer}
          hitSlop={8}
          accessibilityLabel="Open navigation menu"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.iconButton,
            {
              backgroundColor: pressed ? colors.hover : colors.surface,
              borderColor: colors.line,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <IconMenu2 size={22} color={colors.ink} strokeWidth={2} />
        </Pressable>

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
            onPress={onOpenOptionsMenu}
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
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderCurve: radius.borderCurve,
  },
  segmentedButton: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconAction: {
    paddingHorizontal: 11,
  },
  pillDivider: {
    width: 1,
    height: 18,
  },
});

