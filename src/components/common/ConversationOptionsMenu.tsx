import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconShare,
  IconPin,
  IconPinned,
  IconHome,
  IconTrash,
} from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius } from '@/theme';

export interface MenuAnchorPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ConversationOptionsMenuProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  isPinned: boolean;
  anchorPosition?: MenuAnchorPosition | null;
  onShare: () => void;
  onTogglePin: () => void;
  onGoToHome: () => void;
  onDelete: () => void;
}

export const ConversationOptionsMenu: React.FC<ConversationOptionsMenuProps> = React.memo(({
  visible,
  onClose,
  title,
  isPinned,
  anchorPosition,
  onShare,
  onTogglePin,
  onGoToHome,
  onDelete,
}) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const windowWidth = Dimensions.get('window').width;

  if (!visible) return null;

  const displayTitle = title ? title.trim() : 'Conversation';

  // Anchoring calculation:
  // When anchorPosition is measured from the 3-dot button in window coordinates,
  // place popup immediately below the button (+4px gap).
  // Fallback: If not measured, place directly below the header row (insets.top + 44px).
  const computedTop =
    anchorPosition && typeof anchorPosition.y === 'number' && anchorPosition.y > 0
      ? anchorPosition.y + anchorPosition.height + 4
      : Math.max(insets.top, 12) + 44;

  const computedRight =
    anchorPosition && typeof anchorPosition.x === 'number' && anchorPosition.width > 0
      ? Math.max(12, windowWidth - (anchorPosition.x + anchorPosition.width))
      : spacing.md;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        />
        <View
          style={[
            styles.menuCard,
            {
                  top: computedTop,
                  right: computedRight,
                  backgroundColor: colors.surface || '#1f1f23',
                  borderColor: colors.line,
                },
              ]}
            >
              {/* Header: Conversation Title */}
              <View style={styles.headerArea}>
                <Text
                  style={[styles.headerTitle, { color: colors.ink }]}
                  numberOfLines={1}
                >
                  {displayTitle}
                </Text>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.line }]} />

              {/* Action 1: Share */}
              <Pressable
                onPress={() => {
                  onClose();
                  onShare();
                }}
                style={({ pressed }) => [
                  styles.menuItem,
                  {
                    backgroundColor: pressed ? colors.hover : 'transparent',
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Share conversation"
              >
                <IconShare size={19} color={colors.ink} strokeWidth={1.9} />
                <Text style={[styles.menuItemText, { color: colors.ink }]}>
                  Share
                </Text>
              </Pressable>

              {/* Action 2: Pin / Unpin */}
              <Pressable
                onPress={() => {
                  onClose();
                  onTogglePin();
                }}
                style={({ pressed }) => [
                  styles.menuItem,
                  {
                    backgroundColor: pressed ? colors.hover : 'transparent',
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={isPinned ? 'Unpin conversation' : 'Pin conversation'}
              >
                {isPinned ? (
                  <IconPinned size={19} color={colors.accent || '#a855f7'} strokeWidth={1.9} />
                ) : (
                  <IconPin size={19} color={colors.ink} strokeWidth={1.9} />
                )}
                <Text
                  style={[
                    styles.menuItemText,
                    { color: isPinned ? (colors.accent || '#a855f7') : colors.ink },
                  ]}
                >
                  {isPinned ? 'Unpin' : 'Pin'}
                </Text>
              </Pressable>

              {/* Action 3: Go to Home */}
              <Pressable
                onPress={() => {
                  onClose();
                  onGoToHome();
                }}
                style={({ pressed }) => [
                  styles.menuItem,
                  {
                    backgroundColor: pressed ? colors.hover : 'transparent',
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Go to Home"
              >
                <IconHome size={19} color={colors.ink} strokeWidth={1.9} />
                <Text style={[styles.menuItemText, { color: colors.ink }]}>
                  Go to Home
                </Text>
              </Pressable>

              {/* Action 4: Delete */}
              <Pressable
                onPress={() => {
                  onClose();
                  onDelete();
                }}
                style={({ pressed }) => [
                  styles.menuItem,
                  styles.deleteItem,
                  {
                    backgroundColor: pressed ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Delete conversation"
              >
                <IconTrash size={19} color="#ef4444" strokeWidth={1.9} />
                <Text style={[styles.menuItemText, styles.deleteText]}>
                  Delete
                </Text>
              </Pressable>
            </View>
        </View>
      </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  menuCard: {
    position: 'absolute',
    width: 220,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
    overflow: 'hidden',
  },
  headerArea: {
    paddingHorizontal: spacing.md,
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  divider: {
    height: 1,
    width: '100%',
    marginVertical: 4,
    opacity: 0.8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: 12,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  deleteItem: {
    marginTop: 2,
  },
  deleteText: {
    color: '#ef4444',
    fontWeight: '600',
  },
});
