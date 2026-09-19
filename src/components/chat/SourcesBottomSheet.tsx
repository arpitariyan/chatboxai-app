/**
 * SourcesBottomSheet
 *
 * Slides up from the bottom to display all web sources for one AI response.
 *
 * Touch architecture:
 *  - Full-screen modal overlay
 *  - Animated scrim (backdrop) at absolute fill
 *  - A flex-1 Pressable that occupies ONLY the area above the sheet → closes on tap
 *  - The sheet View below the Pressable receives touches normally
 *  - ScrollView inside the sheet handles panning without triggering the close Pressable
 *
 * This is the correct approach that prevents scrolling from accidentally closing the panel.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  ScrollView,
  Linking,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconX } from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius } from '@/theme';
import { SvglIcon, getDomainFromUrl } from './SvglIcon';

// ── Constants ────────────────────────────────────────────────────────────────
const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.76;
const OPEN_DURATION = 300;
const CLOSE_DURATION = 220;

// ── Types ────────────────────────────────────────────────────────────────────
export interface SourceItem {
  title?: string;
  url?: string;
  link?: string;
  snippet?: string;
  description?: string;
  name?: string;
  displayLink?: string;
}

interface SourcesBottomSheetProps {
  visible: boolean;
  sources: SourceItem[];
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const getSourceUrl = (item: SourceItem): string => item.url || item.link || '';

const getSourceTitle = (item: SourceItem): string => {
  if (item.title?.trim()) return item.title.trim();
  if (item.name?.trim()) return item.name.trim();
  const url = getSourceUrl(item);
  return url ? getDomainFromUrl(url) : 'Source';
};

const trimTitle = (t: string, max = 80): string =>
  t.length > max ? t.slice(0, max - 1) + '…' : t;

// ── SourceRow ─────────────────────────────────────────────────────────────────
const SourceRow: React.FC<{ item: SourceItem; index: number }> = ({ item, index }) => {
  const colors = useThemeColors();
  const url = getSourceUrl(item);
  const domain = url ? getDomainFromUrl(url) : '';
  const title = getSourceTitle(item);

  return (
    <Pressable
      onPress={() => url && Linking.openURL(url).catch(() => {})}
      accessibilityRole="link"
      accessibilityLabel={`Source ${index + 1}: ${title}`}
      style={({ pressed }) => [
        styles.sourceRow,
        {
          borderBottomColor: colors.line,
          backgroundColor: pressed ? colors.hover : 'transparent',
        },
      ]}
    >
      {/* Brand icon */}
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: colors.surface, borderColor: colors.line },
        ]}
      >
        <SvglIcon domain={domain || 'unknown'} size={18} color={colors.ink3} />
      </View>

      {/* Text */}
      <View style={styles.textBlock}>
        <Text style={[styles.sourceDomain, { color: colors.ink3 }]} numberOfLines={1}>
          {domain || 'Source'}
        </Text>
        <Text style={[styles.sourceTitle, { color: colors.ink }]} numberOfLines={3}>
          {trimTitle(title)}
        </Text>
      </View>

      {/* Arrow */}
      <Text style={[styles.arrow, { color: colors.ink3 }]}>↗</Text>
    </Pressable>
  );
};

// ── SourcesBottomSheet ────────────────────────────────────────────────────────
export const SourcesBottomSheet: React.FC<SourcesBottomSheetProps> = ({
  visible,
  sources,
  onClose,
}) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  // Keep modal mounted during close animation
  const [modalMounted, setModalMounted] = useState(visible);

  const slideAnim = useRef(new Animated.Value(SHEET_MAX_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const animateOpen = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: OPEN_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: OPEN_DURATION,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, backdropOpacity]);

  const animateClose = useCallback((callback?: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SHEET_MAX_HEIGHT,
        duration: CLOSE_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: CLOSE_DURATION,
        useNativeDriver: true,
      }),
    ]).start(callback);
  }, [slideAnim, backdropOpacity]);

  useEffect(() => {
    if (visible) {
      setModalMounted(true);
      // Ensure we start from off-screen before animating in
      slideAnim.setValue(SHEET_MAX_HEIGHT);
      backdropOpacity.setValue(0);
      animateOpen();
    } else if (modalMounted) {
      // Animate out, then unmount
      animateClose(() => setModalMounted(false));
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!modalMounted) return null;

  return (
    <Modal
      visible={modalMounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      {/* ── Full-screen container ─────────────────────────────────────────── */}
      <View style={styles.overlay}>

        {/* Animated scrim — behind everything */}
        <Animated.View
          style={[styles.scrim, { opacity: backdropOpacity }]}
          pointerEvents="none"
        />

        {/* ── Tap-to-close region (only above the sheet) ──────────────────── */}
        {/* flex: 1 means it fills all space ABOVE the sheet */}
        <Pressable style={styles.backdropPressable} onPress={handleClose} />

        {/* ── Sheet — always at bottom, handles its own touches ────────────── */}
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.canvas,
              borderTopColor: colors.line,
              maxHeight: SHEET_MAX_HEIGHT,
              paddingBottom: Math.max(insets.bottom, 8),
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Drag handle */}
          <View style={styles.handleRow} pointerEvents="none">
            <View style={[styles.handle, { backgroundColor: colors.lineStrong }]} />
          </View>

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.line }]}>
            <Text style={[styles.headerTitle, { color: colors.ink3 }]}>
              {sources.length} {sources.length === 1 ? 'Source' : 'Sources'}
            </Text>
            <Pressable
              onPress={handleClose}
              hitSlop={12}
              accessibilityLabel="Close sources"
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.closeBtn,
                {
                  backgroundColor: pressed ? colors.hover : colors.surface,
                  borderColor: colors.line,
                },
              ]}
            >
              <IconX size={14} color={colors.ink3} />
            </Pressable>
          </View>

          {/* Scrollable source list */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={Platform.OS === 'ios'}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
          >
            {sources.length === 0 ? (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: colors.ink3 }]}>
                  No sources available
                </Text>
              </View>
            ) : (
              sources.map((item, i) => (
                <SourceRow
                  key={`src-${i}-${getSourceUrl(item)}`}
                  item={item}
                  index={i}
                />
              ))
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backdropPressable: {
    // Fills all space above the sheet; tapping here closes the panel
    flex: 1,
  },
  sheet: {
    // Sheet is in normal flex flow, below the backdropPressable
    borderTopWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
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
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: 12,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  sourceDomain: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  sourceTitle: {
    fontSize: 13.5,
    fontWeight: '500',
    lineHeight: 19,
  },
  arrow: {
    fontSize: 16,
    flexShrink: 0,
  },
  empty: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
});
