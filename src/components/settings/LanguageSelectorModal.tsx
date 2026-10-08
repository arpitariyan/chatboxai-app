/**
 * src/components/settings/LanguageSelectorModal.tsx
 *
 * Clean, ISO-standard Language Selector Modal for ChatBox AI APK.
 * Features:
 * - Slide-up sheet with top drag handle and circular close button
 * - Real-time ISO search filter (search by English name, native script, or ISO code)
 * - 36x36 ISO Badge pill (EN, HI, ES, FR, DE, JA, etc.) with theme-aware styling
 * - Dual label display: Native script name + English & regional info
 * - Selection checkmark indicator in active accent color
 * - Full theme responsiveness (light/dark)
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconX,
  IconCheck,
  IconSearch,
  IconLanguage,
} from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius, typography } from '@/theme';
import {
  SUPPORTED_LANGUAGES,
  LanguageOption,
  AppLanguage,
  useTranslation,
} from '@/i18n';

interface LanguageSelectorModalProps {
  visible: boolean;
  selectedLanguage: AppLanguage;
  onSelectLanguage: (code: AppLanguage) => void;
  onClose: () => void;
}

export const LanguageSelectorModal: React.FC<LanguageSelectorModalProps> = ({
  visible,
  selectedLanguage,
  onSelectLanguage,
  onClose,
}) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  // Reset search when modal becomes visible
  React.useEffect(() => {
    if (visible) {
      setSearchQuery('');
    }
  }, [visible]);

  // Filter languages based on search query
  const filteredLanguages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return SUPPORTED_LANGUAGES;
    return SUPPORTED_LANGUAGES.filter((item) => {
      const name = item.name.toLowerCase();
      const native = item.nativeName.toLowerCase();
      const iso = item.iso.toLowerCase();
      const code = item.code.toLowerCase();
      const region = item.region.toLowerCase();
      return (
        name.includes(q) ||
        native.includes(q) ||
        iso.includes(q) ||
        code.includes(q) ||
        region.includes(q)
      );
    });
  }, [searchQuery]);

  const handleSelect = useCallback(
    (code: AppLanguage) => {
      onSelectLanguage(code);
      onClose();
    },
    [onSelectLanguage, onClose]
  );

  const renderItem = useCallback(
    ({ item }: { item: LanguageOption }) => {
      const isSelected = item.code === selectedLanguage;

      return (
        <Pressable
          onPress={() => handleSelect(item.code)}
          style={({ pressed }) => [
            styles.langRow,
            {
              backgroundColor: isSelected
                ? colors.surface2
                : 'transparent',
              borderColor: isSelected ? colors.accent : colors.line,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Select ${item.name}`}
        >
          {/* ISO Code Badge */}
          <View
            style={[
              styles.isoBadge,
              {
                backgroundColor: isSelected
                  ? colors.accent + '20'
                  : colors.surface2,
                borderColor: isSelected ? colors.accent : colors.line,
              },
            ]}
          >
            <Text
              style={[
                styles.isoBadgeText,
                {
                  color: isSelected ? colors.accent : colors.ink,
                },
              ]}
            >
              {item.iso}
            </Text>
          </View>

          {/* Name & Native script metadata */}
          <View style={styles.langInfo}>
            <View style={styles.langNameRow}>
              <Text style={[styles.langNative, { color: colors.ink }]}>
                {item.nativeName}
              </Text>
              {item.nativeName !== item.name && (
                <Text style={[styles.langEnglish, { color: colors.ink3 }]}>
                  • {item.name}
                </Text>
              )}
            </View>
            <Text style={[styles.langRegion, { color: colors.ink3 }]}>
              {item.region}
            </Text>
          </View>

          {/* Active selection checkmark */}
          {isSelected && (
            <View
              style={[
                styles.checkWrap,
                { backgroundColor: colors.accent + '20' },
              ]}
            >
              <IconCheck size={16} color={colors.accent} strokeWidth={2.5} />
            </View>
          )}
        </Pressable>
      );
    },
    [selectedLanguage, colors, handleSelect]
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close language selector"
        />

        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.surface,
              borderColor: colors.line,
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          {/* Top Sheet Drag Handle */}
          <View style={[styles.dragHandle, { backgroundColor: colors.lineStrong }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.headerIconWrap,
                  { backgroundColor: colors.surface2, borderColor: colors.line },
                ]}
              >
                <IconLanguage size={18} color={colors.ink} strokeWidth={1.8} />
              </View>
              <View style={styles.headerTitles}>
                <Text style={[styles.title, { color: colors.ink }]}>
                  {t('language', 'Language')}
                </Text>
                <Text style={[styles.subtitle, { color: colors.ink3 }]}>
                  {t('languageDesc', 'Interface and assistant output language')}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => [
                styles.closeBtn,
                {
                  backgroundColor: colors.surface2,
                  borderColor: colors.line,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
              accessibilityLabel="Close language selector"
            >
              <IconX size={18} color={colors.ink2} strokeWidth={1.8} />
            </Pressable>
          </View>

          {/* Search Box */}
          <View
            style={[
              styles.searchBox,
              { backgroundColor: colors.surface2, borderColor: colors.line },
            ]}
          >
            <IconSearch size={16} color={colors.ink3} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.ink }]}
              placeholder={t('searchLanguages', 'Search languages...')}
              placeholderTextColor={colors.ink3}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery('')}
                hitSlop={8}
                style={styles.clearBtn}
              >
                <IconX size={14} color={colors.ink2} />
              </Pressable>
            )}
          </View>

          {/* Language List */}
          <FlatList
            data={filteredLanguages}
            keyExtractor={(item) => item.code}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.ink3 }]}>
                  {t('noModelsMatch', 'No languages match')} "{searchQuery}"
                </Text>
              </View>
            }
          />
        </View>
      </View>
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
    maxHeight: '82%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 10,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitles: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSize.md,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11.5,
    marginTop: 1,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    height: 40,
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    gap: 8,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  isoBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  isoBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: 'monospace',
  },
  langInfo: {
    flex: 1,
  },
  langNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  langNative: {
    fontSize: 14,
    fontWeight: '600',
  },
  langEnglish: {
    fontSize: 12,
  },
  langRegion: {
    fontSize: 11,
    marginTop: 1,
  },
  checkWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
});
