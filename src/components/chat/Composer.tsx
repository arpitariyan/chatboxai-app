import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  Keyboard,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconPlus,
  IconSquare,
  IconArrowUp,
  IconMicrophone,
  IconPhone,
  IconWorldSearch,
  IconFlask,
} from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius, typography } from '@/theme';
import { ModelSelector } from './ModelSelector';
import { useModelStore } from '@/stores/useModelStore';

interface ComposerProps {
  /** Optional external value — only used for externally-driven clears (e.g. after send).
   *  Do NOT use this to drive every keystroke — that is what caused the 1-char bug.
   *  Leave undefined for fully uncontrolled local state (preferred). */
  externalValue?: string;
  onSend: (text: string, searchType: 'chat' | 'search' | 'research') => void;
  onStop?: () => void;
  onOpenAttachments?: () => void;
  onOpenVoice?: () => void;
  onFocus?: () => void;
  isGenerating?: boolean;
  disabled?: boolean;
}

export const Composer: React.FC<ComposerProps> = ({
  externalValue,
  onSend,
  onStop,
  onOpenAttachments,
  onOpenVoice,
  onFocus,
  isGenerating = false,
  disabled = false,
}) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  // ── LOCAL text state — decoupled from parent to prevent re-render cascade ──
  const [localText, setLocalText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const hasText = localText.trim().length > 0;
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState(true);
  const [researchEnabled, setResearchEnabled] = useState(false);
  const { syncModelWithMode } = useModelStore();

  const currentSearchType: 'chat' | 'search' | 'research' = researchEnabled
    ? 'research'
    : searchEnabled
    ? 'search'
    : 'chat';

  // Sync when parent explicitly clears the field (e.g. externalValue === '')
  useEffect(() => {
    if (externalValue !== undefined && externalValue !== localText) {
      setLocalText(externalValue);
    }
    // Only run when externalValue changes, NOT on every localText update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalValue]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = localText.trim();
    if (!trimmed || isGenerating || disabled) return;
    onSend(trimmed, currentSearchType);
    // Clear local text immediately after send
    setLocalText('');
  }, [localText, isGenerating, disabled, onSend, currentSearchType]);

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
      <View style={styles.topControls}>
        <ModelSelector isResearch={researchEnabled} />
        <View style={styles.toggles}>
          <Pressable
            style={[styles.toggleBtn, searchEnabled && !researchEnabled && styles.toggleBtnActive]}
            onPress={() => {
              setSearchEnabled(true);
              setResearchEnabled(false);
              syncModelWithMode(false);
            }}
          >
            <IconWorldSearch size={16} color={searchEnabled && !researchEnabled ? '#3b82f6' : '#8e8e93'} />
            <Text style={[styles.toggleText, searchEnabled && !researchEnabled && styles.toggleTextActive]}>Search</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, researchEnabled && styles.toggleBtnActive]}
            onPress={() => {
              setResearchEnabled(true);
              setSearchEnabled(false);
              syncModelWithMode(true);
            }}
          >
            <IconFlask size={16} color={researchEnabled ? '#3b82f6' : '#8e8e93'} />
            <Text style={[styles.toggleText, researchEnabled && styles.toggleTextActive]}>Research</Text>
          </Pressable>
        </View>
      </View>

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

        {/* Center: Multiline Input — local state only, NO parent setState per keystroke */}
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: '#ffffff' }]}
          value={localText}
          onChangeText={setLocalText}
          onFocus={onFocus}
          placeholder="Ask ChatBox AI..."
          placeholderTextColor="#8e8e93"
          editable={!disabled && !isGenerating}
          multiline
          maxLength={4000}
          blurOnSubmit={false}
        />

        {/* Right Controls */}
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
            onPress={handleSend}
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

            {/* Circular Blue Call Action Button */}
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
    gap: spacing.xs,
  },
  topControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  toggles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: '#2c2c2e',
    gap: 4,
  },
  toggleBtnActive: {
    borderColor: 'rgba(59, 130, 246, 0.5)',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  toggleText: {
    color: '#8e8e93',
    fontSize: typography.fontSize.xs,
    fontWeight: '500',
  },
  toggleTextActive: {
    color: '#3b82f6',
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
  callBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
