import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconMenu,
  IconEdit,
  IconDotsVertical,
  IconSpy,
} from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius } from '@/theme';

export interface MenuAnchorPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface HeaderProps {
  onOpenDrawer: () => void;
  onNewChat: () => void;
  onOpenOptionsMenu?: (anchor?: MenuAnchorPosition) => void;
  onIncognitoChat?: () => void;
  isConversation?: boolean;
  /** When true, the incognito button is shown in its active/tinted state */
  isIncognito?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenDrawer,
  onNewChat,
  onOpenOptionsMenu,
  onIncognitoChat,
  isConversation = false,
  isIncognito = false,
}) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const optionsButtonRef = React.useRef<View>(null);

  const handleOpenOptionsMenu = () => {
    if (optionsButtonRef.current?.measureInWindow) {
      optionsButtonRef.current.measureInWindow((x, y, width, height) => {
        if (typeof y === 'number' && !isNaN(y) && height > 0) {
          onOpenOptionsMenu?.({ x, y, width, height });
        } else {
          onOpenOptionsMenu?.();
        }
      });
    } else {
      onOpenOptionsMenu?.();
    }
  };

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
          <IconMenu size={22} color={colors.ink} strokeWidth={2} />
        </Pressable>

        {/* Right Action:
            - Incognito mode: Active spy icon (exit) + New private chat if active conversation
            - Normal Conversation: [ New Chat | Divider | Options (⋮) ]
            - Normal Home: Incognito Chat toggle button
        */}
        {isIncognito ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            {isConversation && (
              <Pressable
                onPress={onNewChat}
                hitSlop={6}
                accessibilityLabel="Start new private chat"
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
                <IconEdit size={18} color={colors.ink} />
              </Pressable>
            )}

            <Pressable
              onPress={onIncognitoChat}
              hitSlop={8}
              accessibilityLabel="Exit incognito chat"
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.iconButton,
                {
                  backgroundColor: pressed ? '#3b285133' : '#3b285118',
                  borderColor: '#7c4fa066',
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <IconSpy
                size={20}
                color="#9b5de5"
                strokeWidth={2.2}
              />
            </Pressable>
          </View>
        ) : isConversation ? (
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
            <View ref={optionsButtonRef} collapsable={false}>
              <Pressable
                onPress={handleOpenOptionsMenu}
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
        ) : (
          <Pressable
            onPress={onIncognitoChat}
            hitSlop={8}
            accessibilityLabel="Enter incognito chat"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: pressed ? colors.hover : colors.surface,
                borderColor: colors.line,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <IconSpy
              size={20}
              color={colors.ink}
              strokeWidth={1.8}
            />
          </Pressable>
        )}
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

