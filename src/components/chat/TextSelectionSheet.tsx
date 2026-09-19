/**
 * TextSelectionSheet.tsx
 *
 * A dedicated modal for native text selection and partial copying.
 * Built from scratch to avoid the core issues with the generic BottomSheet:
 *
 * 1. The generic BottomSheet wraps everything in `TouchableWithoutFeedback`
 *    which intercepts touch events before they reach the selectable Text node.
 * 2. React Native's `<Text selectable>` cannot work inside a ScrollView on Android
 *    when the parent has gesture interceptors — they fight for the same touch stream.
 *
 * FIX:
 * - Use a raw `<Modal>` with a simple Pressable backdrop (not TouchableWithoutFeedback).
 * - The selectable <Text> is the ONLY child of the ScrollView content, with no sibling gesture handlers.
 * - On Android, `nestedScrollEnabled` is set on ScrollView for compatibility.
 * - The sheet itself does not interfere with the native text selection system at all.
 */
import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
  SafeAreaView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconX } from '@tabler/icons-react-native';
import { useThemeColors, spacing, typography, radius } from '@/theme';

interface TextSelectionSheetProps {
  visible: boolean;
  onClose: () => void;
  content: string;
}

/**
 * Strips markdown syntax to produce clean, readable plain text.
 * The output is a single flat string — critical because any nested <Text>
 * children inside a selectable <Text> break Android's selection handles.
 */
function stripMarkdown(raw: string): string {
  if (!raw) return '';
  return raw
    // Strip code fences (```lang ... ```)
    .replace(/```[\s\S]*?```/g, (match) => {
      // Keep the code content but remove the fences
      return match.replace(/^```[^\n]*\n?/m, '').replace(/```$/m, '').trim();
    })
    // Strip inline code backticks
    .replace(/`([^`]+)`/g, '$1')
    // Bold **text** or __text__
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    // Italic *text* or _text_
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    // Markdown links [label](url) → label (url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    // Heading hashes
    .replace(/^#{1,6}\s+/gm, '')
    // Blockquotes
    .replace(/^>\s*/gm, '')
    // Horizontal rules
    .replace(/^(---|\*\*\*|___)\s*$/gm, '')
    .trim();
}

export const TextSelectionSheet: React.FC<TextSelectionSheetProps> = ({
  visible,
  onClose,
  content,
}) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const flatText = useMemo(() => stripMarkdown(content), [content]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape']}
    >
      {/* Backdrop — plain Pressable so it doesn't block child touch events */}
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        {/* Sheet container — plain View, no gesture handlers */}
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.line,
              paddingBottom: Math.max(insets.bottom + 8, spacing.lg),
              maxHeight: Dimensions.get('window').height * 0.85,
            },
          ]}
        >
          {/* Drag handle */}
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: colors.line }]} />
          </View>

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.line }]}>
            <Text style={[styles.headerTitle, { color: colors.ink }]}>
              Select Text to Copy
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <IconX size={20} color={colors.ink2} />
            </Pressable>
          </View>

          {/* 
            CRITICAL: ScrollView with nestedScrollEnabled + no extra gesture wrappers.
            The <Text selectable> must be the direct content child of ScrollView.
            Any Pressable/Touchable wrapper around it breaks selection on Android.
          */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            <Text
              selectable
              style={[styles.bodyText, { color: colors.ink }]}
            >
              {flatText}
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.lg,
  },
  handleRow: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    marginBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  scrollView: {
    flexGrow: 1,
  },
  scrollContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  bodyText: {
    fontSize: 16,
    lineHeight: 26,
    letterSpacing: -0.15,
  },
});
