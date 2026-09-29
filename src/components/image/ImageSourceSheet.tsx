/**
 * src/components/image/ImageSourceSheet.tsx
 *
 * Premium slide-up bottom sheet for selecting image source (Photos or Camera).
 * Smooth native slide-up animation from the bottom.
 * Sleek, modern dark-mode aesthetic with clear touch targets.
 * Strictly displays NO model names as requested.
 */

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
import { IconCamera, IconPhoto, IconChevronRight } from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius, typography } from '@/theme';

export interface ImageSourceSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectCamera: () => void;
  onSelectLibrary: () => void;
}

export const ImageSourceSheet: React.FC<ImageSourceSheetProps> = ({
  visible,
  onClose,
  onSelectCamera,
  onSelectLibrary,
}) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.sheetContainer,
                {
                  backgroundColor: colors.surface || '#1c1c1e',
                  borderColor: colors.line || '#2c2c2e',
                  paddingBottom: Math.max(insets.bottom + 8, spacing.lg),
                },
              ]}
            >
              {/* Drag Handle Indicator */}
              <View style={styles.handleWrapper}>
                <View style={[styles.handleBar, { backgroundColor: colors.line || '#3a3a3c' }]} />
              </View>

              {/* Header */}
              <View style={styles.header}>
                <Text style={[styles.title, { color: colors.ink || '#ffffff' }]}>
                  Add Image
                </Text>
                <Text style={[styles.subtitle, { color: colors.ink3 || '#8e8e93' }]}>
                  Choose how you want to add your reference image
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.optionsList}>
                {/* Choose from Photos */}
                <Pressable
                  onPress={() => {
                    onClose();
                    // Slight delay to allow modal exit on Android
                    setTimeout(onSelectLibrary, 120);
                  }}
                  style={({ pressed }) => [
                    styles.optionRow,
                    {
                      backgroundColor: pressed ? '#2c2c2e' : '#242426',
                      borderColor: colors.line || '#333336',
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Choose from Photos"
                >
                  <View style={styles.iconContainer}>
                    <IconPhoto size={22} color="#ffffff" strokeWidth={1.9} />
                  </View>
                  <View style={styles.optionTextCol}>
                    <Text style={styles.optionTitle}>Choose from Photos</Text>
                    <Text style={styles.optionSubtitle}>Select an image from your gallery</Text>
                  </View>
                  <IconChevronRight size={18} color="#8e8e93" />
                </Pressable>

                {/* Take Photo */}
                <Pressable
                  onPress={() => {
                    onClose();
                    setTimeout(onSelectCamera, 120);
                  }}
                  style={({ pressed }) => [
                    styles.optionRow,
                    {
                      backgroundColor: pressed ? '#2c2c2e' : '#242426',
                      borderColor: colors.line || '#333336',
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Take Photo"
                >
                  <View style={styles.iconContainer}>
                    <IconCamera size={22} color="#ffffff" strokeWidth={1.9} />
                  </View>
                  <View style={styles.optionTextCol}>
                    <Text style={styles.optionTitle}>Take Photo</Text>
                    <Text style={styles.optionSubtitle}>Capture a picture with your camera</Text>
                  </View>
                  <IconChevronRight size={18} color="#8e8e93" />
                </Pressable>
              </View>

              {/* Cancel Button */}
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.cancelBtn,
                  {
                    backgroundColor: pressed ? '#2c2c2e' : '#222224',
                    borderColor: colors.line || '#333336',
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  handleWrapper: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    marginBottom: spacing.md,
    marginTop: 2,
  },
  title: {
    fontSize: typography.fontSize.lg || 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: typography.fontSize.xs || 12,
    marginTop: 4,
    lineHeight: 16,
  },
  optionsList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.lg || 16,
    borderWidth: 1,
    gap: spacing.sm + 2,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#323236',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextCol: {
    flex: 1,
  },
  optionTitle: {
    fontSize: typography.fontSize.base || 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  optionSubtitle: {
    fontSize: typography.fontSize.xs || 12,
    color: '#8e8e93',
    marginTop: 2,
  },
  cancelBtn: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  cancelBtnText: {
    fontSize: typography.fontSize.base || 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});
