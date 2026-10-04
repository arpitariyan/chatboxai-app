import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  Keyboard,
  Platform,
  ScrollView,
  Image,
  Alert,
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
  IconLock,
  IconX,
  IconFile,
} from '@tabler/icons-react-native';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { VoiceWaveformBar } from './VoiceWaveformBar';
import { useThemeColors, spacing, radius, typography } from '@/theme';
import { ModelSelector } from './ModelSelector';
import { useModelStore } from '@/stores/useModelStore';
import { useResearchStore } from '@/stores/useResearchStore';
import { auth } from '@/config/firebase';
import { ChatAttachment } from '@/hooks/useChatGeneration';
import { FileTypeIcon } from './FileTypeIcon';

interface ComposerProps {
  /** Optional external value — only used for externally-driven clears (e.g. after send).
   *  Do NOT use this to drive every keystroke — that is what caused the 1-char bug.
   *  Leave undefined for fully uncontrolled local state (preferred). */
  externalValue?: string;
  onSend: (text: string, searchType: 'chat' | 'search' | 'research', attachments?: ChatAttachment[]) => void;
  onStop?: () => void;
  onOpenAttachments?: () => void;
  onOpenVoice?: () => void;
  onFocus?: () => void;
  isGenerating?: boolean;
  disabled?: boolean;
  // Attachments are managed externally (from AttachmentSheet)
  pendingAttachments?: ChatAttachment[];
  onClearAttachment?: (uri: string) => void;
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
  pendingAttachments = [],
  onClearAttachment,
}) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  // ── LOCAL text state — decoupled from parent to prevent re-render cascade ──
  const [localText, setLocalText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const hasText = localText.trim().length > 0;
  const hasContent = hasText || pendingAttachments.length > 0;
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const { isResearchMode, quota, toggleResearchMode, fetchQuota, setResearchMode } = useResearchStore();
  const { syncModelWithMode, webSearchEnabled, setWebSearchEnabled } = useModelStore();

  // The search type sent with each message:
  // - 'research' when Research mode is active
  // - 'search' when neither mode is active (Normal Search)
  // webSearchEnabled (from + menu) enhances Normal Search with web data
  // but does NOT change the mode pill state or the searchType sent.
  const currentSearchType: 'chat' | 'search' | 'research' = isResearchMode
    ? 'research'
    : 'search';

  const userEmail = auth.currentUser?.email || undefined;
  useEffect(() => {
    fetchQuota(userEmail).catch(() => {});
  }, [userEmail, fetchQuota]);

  // ── Speech-to-Text hook ───────────────────────────────────────────────────
  const {
    isListening,
    isTranscribing,
    audioLevel,
    startListening,
    stopListening,
    cancelListening,
  } = useSpeechToText({
    onTranscript: (newText) => {
      setLocalText((prev) => {
        const trimmedPrev = prev.trim();
        if (!trimmedPrev) return newText;
        return `${trimmedPrev} ${newText}`;
      });
    },
    onError: (err, msg) => {
      if (err !== 'NO_SPEECH') {
        Alert.alert('Speech to Text', msg);
      }
    },
  });

  const handleMicPress = useCallback(() => {
    Keyboard.dismiss();
    startListening();
  }, [startListening]);

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
    if ((!trimmed && pendingAttachments.length === 0) || isGenerating || disabled) return;
    onSend(trimmed, currentSearchType, pendingAttachments.length > 0 ? pendingAttachments : undefined);
    // Clear local text immediately after send
    setLocalText('');
  }, [localText, isGenerating, disabled, onSend, currentSearchType, pendingAttachments]);

  return (
    <View
      style={[
        styles.outerContainer,
        {
          backgroundColor: colors.background,
          paddingTop: spacing.xs + 2,
          paddingBottom: isKeyboardVisible
            ? 22
            : Math.max(insets.bottom, 22),
        },
      ]}
    >
      <View style={styles.topControls}>
        <View style={styles.modelSelectorWrapper}>
          <ModelSelector isResearch={isResearchMode} />
        </View>
        <View style={styles.toggles}>
          <Pressable
            style={[styles.toggleBtn, !isResearchMode && styles.toggleBtnActive]}
            onPress={() => {
              if (isResearchMode) {
                // Deactivate Research mode — return to Normal Search
                setResearchMode(false);
                syncModelWithMode(false);
              }
              // If already in Normal Search (not Research), pressing Search does nothing
            }}
          >
            <IconWorldSearch size={15} color={!isResearchMode ? '#3b82f6' : '#8e8e93'} />
            <Text style={[styles.toggleText, !isResearchMode && styles.toggleTextActive]} numberOfLines={1}>Search</Text>
          </Pressable>
          <Pressable
            style={[
              styles.toggleBtn,
              isResearchMode && styles.toggleBtnResearchActive,
              quota && !quota.canResearch && styles.toggleBtnLocked,
            ]}
            onPress={() => {
              toggleResearchMode(auth.currentUser?.email || undefined);
              if (!isResearchMode) {
                setWebSearchEnabled(false);
              }
            }}
          >
            {quota && !quota.canResearch ? (
              <IconLock size={14} color="#f59e0b" />
            ) : (
              <IconFlask size={15} color={isResearchMode ? '#a78bfa' : '#8e8e93'} />
            )}
            <Text
              style={[
                styles.toggleText,
                isResearchMode && styles.toggleTextResearchActive,
                quota && !quota.canResearch && { color: '#f59e0b' },
              ]}
              numberOfLines={1}
            >
              {isResearchMode && quota?.remaining !== undefined && quota.remaining >= 0
                ? `Research (${quota.remaining})`
                : quota && !quota.canResearch
                  ? 'Locked'
                  : 'Research'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── Attachment chips preview ── */}
      {pendingAttachments.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.attachmentStrip}
          contentContainerStyle={styles.attachmentStripContent}
        >
          {pendingAttachments.slice(0, 4).map((att) => (
            <View key={att.uri} style={styles.attachmentChip}>
              {att.type === 'image' && (att.data || att.uri) ? (
                <Image
                  source={{ uri: att.data || att.uri }}
                  style={styles.attachmentThumb}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.attachmentFileIcon}>
                  <FileTypeIcon fileName={att.name} mimeType={att.mimeType} size={18} />
                </View>
              )}
              <Text style={styles.attachmentName} numberOfLines={1}>
                {att.name.length > 16 ? `${att.name.slice(0, 13)}...` : att.name}
              </Text>
              {onClearAttachment && (
                <Pressable
                  onPress={() => onClearAttachment(att.uri)}
                  hitSlop={6}
                  style={styles.attachmentRemoveBtn}
                >
                  <IconX size={12} color="#8e8e93" />
                </Pressable>
              )}
            </View>
          ))}
          {pendingAttachments.length > 4 && (
            <View style={[styles.attachmentChip, { justifyContent: 'center', alignItems: 'center', width: 60, backgroundColor: colors.surface }]}>
              <Text style={{ color: colors.ink, fontWeight: 'bold', fontSize: 16 }}>
                +{pendingAttachments.length - 4}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      <View style={styles.composerBar}>
        {isListening || isTranscribing ? (
          <VoiceWaveformBar
            isListening={isListening}
            isTranscribing={isTranscribing}
            audioLevel={audioLevel}
            onCancel={cancelListening}
            onStop={stopListening}
          />
        ) : (
          <>
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
              placeholder={pendingAttachments.length > 0 ? 'Add a message...' : 'Ask ChatBox AI...'}
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
            ) : (
              <View style={styles.rightGroup}>
                <Pressable
                  disabled={disabled}
                  onPress={handleMicPress}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.micBtn,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                  accessibilityLabel="Dictate message with voice"
                >
                  <IconMicrophone size={20} color="#8e8e93" />
                </Pressable>

                {hasContent ? (
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
                    accessibilityLabel="Open voice call mode"
                  >
                    <IconPhone size={16} color="#ffffff" />
                  </Pressable>
                )}
              </View>
            )}
          </>
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
    width: '100%',
    paddingHorizontal: 2,
    minHeight: 36,
    marginBottom: spacing.xs,
    gap: 8,
  },
  modelSelectorWrapper: {
    flex: 1,
    flexShrink: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  toggles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: '#2c2c2e',
    gap: 4,
    flexShrink: 0,
  },
  toggleBtnActive: {
    borderColor: 'rgba(59, 130, 246, 0.5)',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  toggleText: {
    color: '#8e8e93',
    fontSize: 11.5,
    fontWeight: '500',
  },
  toggleTextActive: {
    color: '#3b82f6',
  },
  toggleBtnResearchActive: {
    borderColor: 'rgba(139, 92, 246, 0.5)',
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
  },
  toggleTextResearchActive: {
    color: '#a78bfa',
    fontWeight: '600',
  },
  toggleBtnLocked: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  // ── Attachment strip ──────────────────────────────────────────────────────
  attachmentStrip: {
    maxHeight: 68,
  },
  attachmentStripContent: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: 2,
    paddingBottom: spacing.xs,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#2c2c2e',
    paddingHorizontal: spacing.xs,
    paddingVertical: 6,
    gap: 6,
    maxWidth: 160,
  },
  attachmentThumb: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  attachmentFileIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#2c2c2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentName: {
    flex: 1,
    color: '#e4e4e7',
    fontSize: typography.fontSize.xs,
  },
  attachmentRemoveBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#3a3a3c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Composer bar ──────────────────────────────────────────────────────────
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
