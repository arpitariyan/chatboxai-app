import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  IconCamera,
  IconPhoto,
  IconFile,
  IconBolt,
  IconWorldSearch,
  IconSparkles,
  IconBrain,
  IconHistory,
  IconChevronRight,
  IconCheck,
} from '@tabler/icons-react-native';
import { BottomSheet } from '@/components/common/BottomSheet';
import { useThemeColors, spacing, radius, typography } from '@/theme';
import { useModelStore, EffortLevel } from '@/stores/useModelStore';
import { ChatAttachment } from '@/hooks/useChatGeneration';

interface AddMenuSheetProps {
  visible: boolean;
  onClose: () => void;
  onAttachmentsSelected: (attachments: ChatAttachment[]) => void;
}

const EFFORT_LEVELS: EffortLevel[] = ['Low', 'Medium', 'High', 'Extra High'];

// Converts file URI to base64 data URI using fetch API (works in RN/Expo)
async function uriToBase64DataURI(uri: string, mimeType: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export const AddMenuSheet: React.FC<AddMenuSheetProps> = ({
  visible,
  onClose,
  onAttachmentsSelected,
}) => {
  const colors = useThemeColors();
  const { effortLevel, setEffortLevel, thinkingMode, setThinkingMode } = useModelStore();
  const [isLoading, setIsLoading] = useState(false);

  // UI-only toggles
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(true);

  // Effort picker expanded state
  const [showEffortPicker, setShowEffortPicker] = useState(false);

  // ── Camera ────────────────────────────────────────────────────────────────
  const handleCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
      return;
    }
    setIsLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images', // ✅ Fixed: use string literal instead of deprecated MediaTypeOptions
        quality: 0.8,
        base64: true,
        allowsEditing: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        const mimeType = asset.mimeType || 'image/jpeg';
        const dataUri = asset.base64
          ? `data:${mimeType};base64,${asset.base64}`
          : await uriToBase64DataURI(asset.uri, mimeType);
        onAttachmentsSelected([{
          uri: asset.uri,
          name: `photo_${Date.now()}.jpg`,
          mimeType,
          type: 'image',
          data: dataUri,
        }]);
        onClose();
      }
    } catch {
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [onAttachmentsSelected, onClose]);

  // ── Photos ────────────────────────────────────────────────────────────────
  const handlePhotos = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library permission is needed to pick images.');
      return;
    }
    setIsLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images', // ✅ Fixed: use string literal instead of deprecated MediaTypeOptions
        quality: 0.8,
        base64: true,
        allowsMultipleSelection: true,
        selectionLimit: 4,
      });
      if (!result.canceled && result.assets.length > 0) {
        const attachments: ChatAttachment[] = await Promise.all(
          result.assets.map(async (asset) => {
            const mimeType = asset.mimeType || 'image/jpeg';
            const dataUri = asset.base64
              ? `data:${mimeType};base64,${asset.base64}`
              : await uriToBase64DataURI(asset.uri, mimeType);
            return {
              uri: asset.uri,
              name: asset.fileName || `image_${Date.now()}.jpg`,
              mimeType,
              type: 'image' as const,
              data: dataUri,
            };
          })
        );
        onAttachmentsSelected(attachments);
        onClose();
      }
    } catch {
      Alert.alert('Error', 'Failed to pick images. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [onAttachmentsSelected, onClose]);

  // ── Files ─────────────────────────────────────────────────────────────────
  const handleFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'text/plain',
          'text/markdown',
          'application/json',
          'text/html',
          'text/csv',
        ],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        const attachments: ChatAttachment[] = await Promise.all(
          result.assets.map(async (asset) => {
            let data: string | undefined;
            if (
              asset.mimeType?.startsWith('text/') ||
              asset.mimeType === 'application/json'
            ) {
              try {
                const resp = await fetch(asset.uri);
                data = await resp.text();
              } catch {
                data = undefined;
              }
            }
            return {
              uri: asset.uri,
              name: asset.name,
              mimeType: asset.mimeType || 'application/octet-stream',
              type: 'file' as const,
              data,
            };
          })
        );
        onAttachmentsSelected(attachments);
        onClose();
      }
    } catch {
      Alert.alert('Error', 'Failed to pick files. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [onAttachmentsSelected, onClose]);

  const toggleEffortPicker = useCallback(() => {
    setShowEffortPicker(prev => !prev);
  }, []);

  const selectEffort = useCallback((level: EffortLevel) => {
    setEffortLevel(level);
    setShowEffortPicker(false);
  }, [setEffortLevel]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add to chat">
      <View style={styles.container}>
        {isLoading && (
          <View style={[styles.loadingOverlay, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
            <ActivityIndicator size="large" color={colors.ink} />
          </View>
        )}

        {/* ── Media grid: Camera / Photos / Files ── */}
        <View style={styles.gridRow}>
          {[
            { label: 'Camera', icon: IconCamera, onPress: handleCamera },
            { label: 'Photos', icon: IconPhoto, onPress: handlePhotos },
            { label: 'Files', icon: IconFile, onPress: handleFiles },
          ].map(({ label, icon: Icon, onPress }) => (
            <Pressable
              key={label}
              style={({ pressed }) => [
                styles.gridBtn,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.line,
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
              onPress={onPress}
            >
              <View style={[styles.gridIconWrap, { backgroundColor: colors.inset }]}>
                <Icon size={22} color={colors.ink} strokeWidth={1.5} />
              </View>
              <Text style={[styles.gridLabel, { color: colors.ink2 }]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── Effort Level ── */}
        <Pressable
          style={({ pressed }) => [
            styles.listRow,
            {
              backgroundColor: colors.surface,
              borderColor: colors.line,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
          onPress={toggleEffortPicker}
        >
          <View style={[styles.listIconWrap, { backgroundColor: colors.inset }]}>
            <IconBolt size={17} color={colors.ink} strokeWidth={1.5} />
          </View>
          <View style={styles.listContent}>
            <Text style={[styles.listTitle, { color: colors.ink }]}>Effort</Text>
            <Text style={[styles.listSub, { color: colors.ink3 }]}>{effortLevel}</Text>
          </View>
          <IconChevronRight
            size={15}
            color={colors.ink3}
            style={{ transform: [{ rotate: showEffortPicker ? '90deg' : '0deg' }] }}
          />
        </Pressable>

        {/* Effort sub-picker */}
        {showEffortPicker && (
          <View style={[styles.effortSheet, { backgroundColor: colors.inset, borderColor: colors.line }]}>
            {EFFORT_LEVELS.map((level, i) => {
              const isActive = effortLevel === level;
              const isLast = i === EFFORT_LEVELS.length - 1;
              return (
                <Pressable
                  key={level}
                  style={({ pressed }) => [
                    styles.effortRow,
                    !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                  onPress={() => selectEffort(level)}
                >
                  <Text style={[
                    styles.effortLabel,
                    { color: isActive ? colors.ink : colors.ink2 },
                    isActive && styles.effortLabelActive,
                  ]}>
                    {level}
                  </Text>
                  {isActive && (
                    <IconCheck size={15} color={colors.ink} strokeWidth={2} />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ── Thinking Mode ── */}
        <View style={[styles.listRow, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={[styles.listIconWrap, { backgroundColor: colors.inset }]}>
            <IconBrain size={17} color={colors.ink} strokeWidth={1.5} />
          </View>
          <View style={styles.listContent}>
            <Text style={[styles.listTitle, { color: colors.ink }]}>Thinking Mode</Text>
          </View>
          <Switch
            value={thinkingMode}
            onValueChange={setThinkingMode}
            trackColor={{ false: colors.inset, true: colors.ink }}
            thumbColor={colors.surface}
            ios_backgroundColor={colors.inset}
          />
        </View>

        {/* ── Web Search ── */}
        <View style={[styles.listRow, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={[styles.listIconWrap, { backgroundColor: colors.inset }]}>
            <IconWorldSearch size={17} color={colors.ink} strokeWidth={1.5} />
          </View>
          <View style={styles.listContent}>
            <Text style={[styles.listTitle, { color: colors.ink }]}>Web search</Text>
          </View>
          <Switch
            value={webSearchEnabled}
            onValueChange={setWebSearchEnabled}
            trackColor={{ false: colors.inset, true: colors.ink }}
            thumbColor={colors.surface}
            ios_backgroundColor={colors.inset}
          />
        </View>

        {/* ── Create Image (UI only) ── */}
        <Pressable
          style={({ pressed }) => [
            styles.listRow,
            {
              backgroundColor: colors.surface,
              borderColor: colors.line,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
          onPress={() => Alert.alert('Coming Soon', 'Image generation will be available in a future update.')}
        >
          <View style={[styles.listIconWrap, { backgroundColor: colors.inset }]}>
            <IconSparkles size={17} color={colors.ink} strokeWidth={1.5} />
          </View>
          <View style={styles.listContent}>
            <Text style={[styles.listTitle, { color: colors.ink }]}>Create image</Text>
          </View>
          <IconChevronRight size={15} color={colors.ink3} />
        </Pressable>

        {/* ── Memory (UI only) ── */}
        <View style={[styles.listRow, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={[styles.listIconWrap, { backgroundColor: colors.inset }]}>
            <IconHistory size={17} color={colors.ink} strokeWidth={1.5} />
          </View>
          <View style={styles.listContent}>
            <Text style={[styles.listTitle, { color: colors.ink }]}>Memory</Text>
          </View>
          <Switch
            value={memoryEnabled}
            onValueChange={setMemoryEnabled}
            trackColor={{ false: colors.inset, true: colors.ink }}
            thumbColor={colors.surface}
            ios_backgroundColor={colors.inset}
          />
        </View>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: spacing.xs,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderRadius: radius.lg,
  },
  // ── Media grid ─────────────────────────────────────────────────────────────
  gridRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  gridBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderCurve: 'continuous',
    gap: spacing.sm,
  },
  gridIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  gridLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    letterSpacing: 0.1,
  },
  // ── List rows ──────────────────────────────────────────────────────────────
  listRow: {
    height: 56,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  listIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  listContent: {
    flex: 1,
  },
  listTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    lineHeight: 20,
  },
  listSub: {
    fontSize: typography.fontSize.xs,
    lineHeight: 16,
  },
  // ── Effort sub-picker ──────────────────────────────────────────────────────
  effortSheet: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  effortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
  },
  effortLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.normal,
  },
  effortLabelActive: {
    fontWeight: typography.fontWeight.medium,
  },
});
