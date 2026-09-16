import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconX } from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius, typography } from '@/theme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  children,
}) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.sheetContainer,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.line,
                  paddingBottom: Math.max(insets.bottom, spacing.md),
                },
              ]}
            >
              {/* Drag Handle */}
              <View style={styles.handleWrapper}>
                <View style={[styles.handleBar, { backgroundColor: colors.line }]} />
              </View>

              {/* Title Header if present */}
              {title ? (
                <View style={[styles.titleRow, { borderBottomColor: colors.line }]}>
                  <Text style={[styles.titleText, { color: colors.ink }]}>{title}</Text>
                  <Pressable onPress={onClose} hitSlop={8}>
                    <IconX size={20} color={colors.ink2} />
                  </Pressable>
                </View>
              ) : null}

              {/* Sheet Body Content */}
              <View style={styles.content}>{children}</View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.lg,
    borderCurve: radius.borderCurve,
  },
  handleWrapper: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    marginBottom: spacing.sm,
  },
  titleText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: -0.2,
  },
  closeText: {
    fontSize: 16,
    fontWeight: typography.fontWeight.medium,
  },
  content: {
    width: '100%',
  },
});
