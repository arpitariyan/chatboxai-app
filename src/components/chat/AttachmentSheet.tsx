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
  onSelectCreateImage?: () => void;
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
  onSelectCreateImage,
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
        mediaTypes: 'images',
        quality: 0.8,
        base64: false,
      });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        const mimeType = asset.mimeType || 'image/jpeg';
        onAttachmentsSelected([{
          uri: asset.uri,
          name: `photo_${Date.now()}.jpg`,
          mimeType,
          type: 'image',
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
        mediaTypes: 'images',
        quality: 0.8,
        base64: false,
        allowsMultipleSelection: true,
        selectionLimit: 20,
      });
      if (!result.canceled && result.assets.length > 0) {
        // Validate 10MB limit
        const invalidFiles = result.assets.filter(a => (a.fileSize ?? 0) > 10 * 1024 * 1024);
        if (invalidFiles.length > 0) {
          Alert.alert('File too large', 'Images must be under 10MB.');
          setIsLoading(false);
          return;
        }

        const attachments: ChatAttachment[] = result.assets.map((asset) => {
          const mimeType = asset.mimeType || 'image/jpeg';
          return {
            uri: asset.uri,
            name: asset.fileName || `image_${Date.now()}.jpg`,
            mimeType,
            type: 'image' as const,
          };
        });
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
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        // Validate 20MB limit
        const invalidFiles = result.assets.filter((a) => (a.size ?? 0) > 20 * 1024 * 1024);
        if (invalidFiles.length > 0) {
          Alert.alert('File too large', 'Files must be under 20MB.');
          setIsLoading(false);
          return;
        }

        const inferMime = (name: string, rawMime?: string | null): string => {
          if (rawMime && rawMime !== 'application/octet-stream') return rawMime;
          const ext = (name.split('.').pop() || '').toLowerCase();
          switch (ext) {
            case 'pdf': return 'application/pdf';
            case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            case 'doc': return 'application/msword';
            case 'pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
            case 'ppt': return 'application/vnd.ms-powerpoint';
            case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            case 'xls': return 'application/vnd.ms-excel';
            case 'csv': return 'text/csv';
            case 'tsv': return 'text/tab-separated-values';
            case 'txt': return 'text/plain';
            case 'md': return 'text/markdown';
            case 'json': return 'application/json';
            case 'xml': return 'application/xml';
            case 'html': return 'text/html';
            case 'zip': return 'application/zip';
            case 'mp4': return 'video/mp4';
            case 'mov': return 'video/quicktime';
            case 'webm': return 'video/webm';
            case 'mp3': return 'audio/mpeg';
            case 'wav': return 'audio/wav';
            case 'm4a': return 'audio/mp4';
            default: return rawMime || 'application/octet-stream';
          }
        };

        const attachments: ChatAttachment[] = result.assets.map((asset) => {
          const resolvedMime = inferMime(asset.name, asset.mimeType);
          const isImg = resolvedMime.startsWith('image/');
          return {
            uri: asset.uri,
            name: asset.name,
            mimeType: resolvedMime,
            type: isImg ? ('image' as const) : ('file' as const),
          };
        });
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

        {/* ── Create Image ── */}
        <Pressable
          style={({ pressed }) => [
            styles.listRow,
            {
              backgroundColor: colors.surface,
              borderColor: colors.line,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
          onPress={() => {
            onClose();
            onSelectCreateImage?.();
          }}
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
