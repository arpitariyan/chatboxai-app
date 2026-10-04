import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { useThemeColors, spacing, radius, typography } from '@/theme';
import { useModelStore, EffortLevel } from '@/stores/useModelStore';
import { ChatAttachment } from '@/hooks/useChatGeneration';

interface AddMenuSheetProps {
  visible: boolean;
  onClose: () => void;
  onAttachmentsSelected: (attachments: ChatAttachment[]) => void;
  onSelectCreateImage?: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const EFFORT_LEVELS: EffortLevel[] = ['Low', 'Medium', 'High', 'Extra High'];

export const AddMenuSheet: React.FC<AddMenuSheetProps> = ({
  visible,
  onClose,
  onAttachmentsSelected,
  onSelectCreateImage,
}) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const {
    effortLevel,
    setEffortLevel,
    thinkingMode,
    setThinkingMode,
    webSearchEnabled,
    setWebSearchEnabled,
  } = useModelStore();
  const [isLoading, setIsLoading] = useState(false);

  // UI-only toggles
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
    setShowEffortPicker((prev) => !prev);
  }, []);

  const selectEffort = useCallback((level: EffortLevel) => {
    setEffortLevel(level);
    setShowEffortPicker(false);
  }, [setEffortLevel]);

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
                  Add to chat
                </Text>
                <Text style={[styles.subtitle, { color: colors.ink3 || '#8e8e93' }]}>
                  Choose attachments or AI tools for your conversation
                </Text>
              </View>

              {isLoading && (
                <View style={[styles.loadingOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                  <ActivityIndicator size="large" color="#ffffff" />
                </View>
              )}

              {/* Scrollable List of Actions */}
              <ScrollView
                style={{ maxHeight: SCREEN_HEIGHT * 0.68 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.optionsList}
                keyboardShouldPersistTaps="handled"
              >
                {/* Choose from Photos */}
                <Pressable
                  onPress={handlePhotos}
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
                    <Text style={styles.optionSubtitle}>Select images from your gallery</Text>
                  </View>
                  <IconChevronRight size={18} color="#8e8e93" />
                </Pressable>

                {/* Take Photo */}
                <Pressable
                  onPress={handleCamera}
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

                {/* Attach Files */}
                <Pressable
                  onPress={handleFiles}
                  style={({ pressed }) => [
                    styles.optionRow,
                    {
                      backgroundColor: pressed ? '#2c2c2e' : '#242426',
                      borderColor: colors.line || '#333336',
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Attach Files"
                >
                  <View style={styles.iconContainer}>
                    <IconFile size={22} color="#ffffff" strokeWidth={1.9} />
                  </View>
                  <View style={styles.optionTextCol}>
                    <Text style={styles.optionTitle}>Attach Files</Text>
                    <Text style={styles.optionSubtitle}>Documents, PDFs, audio or files</Text>
                  </View>
                  <IconChevronRight size={18} color="#8e8e93" />
                </Pressable>

                {/* Create Image */}
                <Pressable
                  onPress={() => {
                    onClose();
                    onSelectCreateImage?.();
                  }}
                  style={({ pressed }) => [
                    styles.optionRow,
                    {
                      backgroundColor: pressed ? '#2c2c2e' : '#242426',
                      borderColor: colors.line || '#333336',
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Create Image"
                >
                  <View style={styles.iconContainer}>
                    <IconSparkles size={22} color="#ffffff" strokeWidth={1.9} />
                  </View>
                  <View style={styles.optionTextCol}>
                    <Text style={styles.optionTitle}>Create Image</Text>
                    <Text style={styles.optionSubtitle}>Generate AI images or stickers</Text>
                  </View>
                  <IconChevronRight size={18} color="#8e8e93" />
                </Pressable>

                {/* Reasoning Effort */}
                <Pressable
                  onPress={toggleEffortPicker}
                  style={({ pressed }) => [
                    styles.optionRow,
                    {
                      backgroundColor: pressed ? '#2c2c2e' : '#242426',
                      borderColor: colors.line || '#333336',
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Reasoning Effort"
                >
                  <View style={styles.iconContainer}>
                    <IconBolt size={22} color="#ffffff" strokeWidth={1.9} />
                  </View>
                  <View style={styles.optionTextCol}>
                    <Text style={styles.optionTitle}>Reasoning Effort</Text>
                    <Text style={styles.optionSubtitle}>{effortLevel} effort level</Text>
                  </View>
                  <IconChevronRight
                    size={18}
                    color="#8e8e93"
                    style={{ transform: [{ rotate: showEffortPicker ? '90deg' : '0deg' }] }}
                  />
                </Pressable>

                {/* Effort Sub-Picker */}
                {showEffortPicker && (
                  <View style={[styles.effortSheet, { borderColor: colors.line || '#333336' }]}>
                    {EFFORT_LEVELS.map((level, i) => {
                      const isActive = effortLevel === level;
                      const isLast = i === EFFORT_LEVELS.length - 1;
                      return (
                        <Pressable
                          key={level}
                          style={({ pressed }) => [
                            styles.effortRow,
                            !isLast && {
                              borderBottomWidth: StyleSheet.hairlineWidth,
                              borderBottomColor: '#333336',
                            },
                            { backgroundColor: pressed ? '#2c2c2e' : 'transparent' },
                          ]}
                          onPress={() => selectEffort(level)}
                        >
                          <Text
                            style={[
                              styles.effortLabel,
                              { color: isActive ? '#ffffff' : '#8e8e93' },
                              isActive && styles.effortLabelActive,
                            ]}
                          >
                            {level}
                          </Text>
                          {isActive && (
                            <IconCheck size={16} color="#ffffff" strokeWidth={2.2} />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {/* Thinking Mode */}
                <View
                  style={[
                    styles.optionRow,
                    {
                      backgroundColor: '#242426',
                      borderColor: colors.line || '#333336',
                    },
                  ]}
                >
                  <View style={styles.iconContainer}>
                    <IconBrain size={22} color="#ffffff" strokeWidth={1.9} />
                  </View>
                  <View style={styles.optionTextCol}>
                    <Text style={styles.optionTitle}>Thinking Mode</Text>
                    <Text style={styles.optionSubtitle}>Show deep reasoning process</Text>
                  </View>
                  <Switch
                    value={thinkingMode}
                    onValueChange={setThinkingMode}
                    trackColor={{ false: '#3a3a3c', true: colors.accent || '#c084fc' }}
                    thumbColor="#ffffff"
                    ios_backgroundColor="#3a3a3c"
                  />
                </View>

                {/* Web Search */}
                <View
                  style={[
                    styles.optionRow,
                    {
                      backgroundColor: '#242426',
                      borderColor: colors.line || '#333336',
                    },
                  ]}
                >
                  <View style={styles.iconContainer}>
                    <IconWorldSearch size={22} color="#ffffff" strokeWidth={1.9} />
                  </View>
                  <View style={styles.optionTextCol}>
                    <Text style={styles.optionTitle}>Web search</Text>
                    <Text style={styles.optionSubtitle}>Browse live web sources</Text>
                  </View>
                  <Switch
                    value={webSearchEnabled}
                    onValueChange={setWebSearchEnabled}
                    trackColor={{ false: '#3a3a3c', true: colors.accent || '#c084fc' }}
                    thumbColor="#ffffff"
                    ios_backgroundColor="#3a3a3c"
                  />
                </View>

                {/* Memory */}
                <View
                  style={[
                    styles.optionRow,
                    {
                      backgroundColor: '#242426',
                      borderColor: colors.line || '#333336',
                    },
                  ]}
                >
                  <View style={styles.iconContainer}>
                    <IconHistory size={22} color="#ffffff" strokeWidth={1.9} />
                  </View>
                  <View style={styles.optionTextCol}>
                    <Text style={styles.optionTitle}>Memory</Text>
                    <Text style={styles.optionSubtitle}>Remember across conversations</Text>
                  </View>
                  <Switch
                    value={memoryEnabled}
                    onValueChange={setMemoryEnabled}
                    trackColor={{ false: '#3a3a3c', true: colors.accent || '#c084fc' }}
                    thumbColor="#ffffff"
                    ios_backgroundColor="#3a3a3c"
                  />
                </View>
              </ScrollView>

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
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderRadius: 24,
  },
  optionsList: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
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
  effortSheet: {
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: '#242426',
    overflow: 'hidden',
    marginTop: -2,
    marginBottom: 4,
  },
  effortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  effortLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  effortLabelActive: {
    fontWeight: '700',
  },
  cancelBtn: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  cancelBtnText: {
    fontSize: typography.fontSize.base || 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});
