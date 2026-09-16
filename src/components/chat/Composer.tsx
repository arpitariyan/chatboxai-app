import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconPlus,
  IconSquare,
  IconArrowUp,
  IconMicrophone,
  IconPhone,
} from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius, typography } from '@/theme';

interface ComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onStop?: () => void;
  onOpenAttachments?: () => void;
  onOpenVoice?: () => void;
  onFocus?: () => void;
  isGenerating?: boolean;
  disabled?: boolean;
  isKeyboardVisible?: boolean;
}

export const Composer: React.FC<ComposerProps> = ({
  value,
  onChangeText,
  onSend,
  onStop,
  onOpenAttachments,
  onOpenVoice,
  onFocus,
  isGenerating = false,
  disabled = false,
  isKeyboardVisible = false,
}) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const hasText = value.trim().length > 0;

  return (
    <View
      style={[
        styles.outerContainer,
        {
          paddingTop: spacing.xs + 2,
          paddingBottom: isKeyboardVisible
            ? 22
            : Math.max(insets.bottom, 22),
        },
      ]}
    >
      <View style={styles.composerBar}>
        {/* Left: Attachment Trigger (+) */}
        <Pressable
          disabled={disabled}
          onPress={onOpenAttachments}
          hitSlop={8}
          style={({ pressed }) => [
            styles.plusBtn,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <IconPlus size={22} color="#8e8e93" />
        </Pressable>

        {/* Center: Multiline Input */}
        <TextInput
          style={[styles.input, { color: '#ffffff' }]}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          placeholder="Ask ChatBox AI..."
          placeholderTextColor="#8e8e93"
          editable={!disabled && !isGenerating}
          multiline
          maxLength={4000}
        />

        {/* Right Controls: Mic & Blue Circular Call Voice Button (Matching ChatGPT Images 1, 2, 3) */}
        {isGenerating ? (
          <Pressable
            onPress={onStop}
            hitSlop={8}
            style={({ pressed }) => [
              styles.stopBtn,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <IconSquare size={16} color="#ffffff" fill="#ffffff" />
          </Pressable>
        ) : hasText ? (
          <Pressable
            disabled={disabled}
            onPress={onSend}
            hitSlop={8}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: colors.accent,
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              },
            ]}
          >
            <IconArrowUp size={18} color="#ffffff" strokeWidth={2.5} />
          </Pressable>
        ) : (
          <View style={styles.rightGroup}>
            <Pressable
              disabled={disabled}
              onPress={onOpenVoice}
              hitSlop={8}
              style={({ pressed }) => [
                styles.micBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <IconMicrophone size={20} color="#8e8e93" />
            </Pressable>

            {/* Circular Blue Call Action Button matching ChatGPT */}
            <Pressable
              disabled={disabled}
              onPress={onOpenVoice}
              hitSlop={8}
              style={({ pressed }) => [
                styles.callBtn,
                {
                  backgroundColor: '#2563eb',
                  opacity: pressed ? 0.85 : 1,
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                },
              ]}
            >
              <IconPhone size={16} color="#ffffff" />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    width: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  composerBar: {
    minHeight: 52,
    maxHeight: 120,
    borderRadius: 26,
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: '#2c2c2e',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs + 4,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  plusBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusIcon: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '300',
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
    maxHeight: 100,
    paddingVertical: 4,
    paddingHorizontal: spacing.xs,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  micBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micIcon: {
    color: '#ffffff',
    fontSize: 18,
  },
  callBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callIcon: {
    color: '#ffffff',
    fontSize: 16,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  stopBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopIcon: {
    color: '#ffffff',
    fontSize: 14,
  },
});
