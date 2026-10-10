/**
 * src/components/common/SignOutModal.tsx
 *
 * Premium Sign Out Confirmation Modal for ChatBox AI APK.
 * Matches ChatBox AI Design System:
 * - Restrained dark theme surface card (colors.surface, hairline 1px border)
 * - Rose tint danger badge with IconLogout
 * - High-contrast accessible buttons (Cancel & Destructive Sign Out)
 * - 46px touch targets, smooth backdrop dismiss
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import { IconLogout } from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius, typography } from '@/theme';

interface SignOutModalProps {
  visible: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const SignOutModal: React.FC<SignOutModalProps> = ({
  visible,
  isLoading = false,
  onClose,
  onConfirm,
}) => {
  const colors = useThemeColors();

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.line,
                },
              ]}
            >
              {/* Logout Icon Badge */}
              <View style={styles.iconBadge}>
                <IconLogout size={24} color="#ef4444" strokeWidth={2} />
              </View>

              {/* Title & Description */}
              <Text style={[styles.title, { color: colors.ink }]}>Sign Out</Text>
              <Text style={[styles.description, { color: colors.ink3 }]}>
                Are you sure you want to sign out? Your conversation history and preferences will remain securely saved on your account.
              </Text>

              {/* Action Buttons */}
              <View style={styles.buttonRow}>
                {/* Cancel Button */}
                <Pressable
                  onPress={onClose}
                  disabled={isLoading}
                  style={({ pressed }) => [
                    styles.button,
                    styles.cancelButton,
                    {
                      backgroundColor: colors.surface2,
                      borderColor: colors.line,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.cancelText, { color: colors.ink }]}>Cancel</Text>
                </Pressable>

                {/* Sign Out Button */}
                <Pressable
                  onPress={onConfirm}
                  disabled={isLoading}
                  style={({ pressed }) => [
                    styles.button,
                    styles.confirmButton,
                    {
                      opacity: pressed || isLoading ? 0.8 : 1,
                    },
                  ]}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.confirmText}>Sign Out</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#ef4444',
  },
  confirmText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
