/**
 * src/components/settings/sections/HelpSection.tsx
 *
 * Help & Resources Settings Section for ChatBox AI Mobile APK.
 * Follows the unified Home screen + Menu/Bottom Sheet design language:
 * - Grouped Surface cards with hairline dividers
 * - Help Center & Support contact
 * - Legal policies (Terms & Privacy)
 * - Application specifications & build details
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Linking,
  Platform,
} from 'react-native';
import {
  IconHelpCircle,
  IconFileText,
  IconShield,
  IconMessage2,
  IconExternalLink,
  IconInfoCircle,
  IconChevronRight,
} from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius, typography } from '@/theme';

export const HelpSection: React.FC = () => {
  const colors = useThemeColors();

  const handleOpenUrl = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (err) {
      console.warn('Failed to open link:', err);
    }
  };

  return (
    <View style={styles.container}>
      {/* ─── GROUP 1: SUPPORT & RESOURCES ──────────────────────────────────── */}
      <Text style={[styles.sectionHeading, { color: colors.ink3 }]}>
        Support & Resources
      </Text>

      <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        {/* Help Center */}
        <Pressable
          onPress={() => handleOpenUrl('https://chatboxai.co.in/help-center')}
          style={({ pressed }) => [
            styles.actionRow,
            pressed && { backgroundColor: colors.hover },
          ]}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surface2 }]}>
            <IconHelpCircle size={18} color={colors.ink} strokeWidth={1.8} />
          </View>
          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.ink }]}>Help Center</Text>
            <Text style={[styles.rowSubtitle, { color: colors.ink3 }]}>
              Browse FAQs and detailed guides on how to use ChatBox AI
            </Text>
          </View>
          <IconExternalLink size={16} color={colors.ink3} strokeWidth={1.8} />
        </Pressable>

        <View style={[styles.divider, { backgroundColor: colors.line }]} />

        {/* Contact & Support */}
        <Pressable
          onPress={() => handleOpenUrl('mailto:support@chatboxai.co.in?subject=ChatBox%20AI%20Support')}
          style={({ pressed }) => [
            styles.actionRow,
            pressed && { backgroundColor: colors.hover },
          ]}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surface2 }]}>
            <IconMessage2 size={18} color="#4ade80" strokeWidth={1.8} />
          </View>
          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.ink }]}>Contact & Support</Text>
            <Text style={[styles.rowSubtitle, { color: colors.ink3 }]}>
              Typical response time within 24hr to 48hr
            </Text>
          </View>
          <IconExternalLink size={16} color={colors.ink3} strokeWidth={1.8} />
        </Pressable>
      </View>

      {/* ─── GROUP 2: LEGAL & POLICIES ─────────────────────────────────────── */}
      <Text style={[styles.sectionHeading, { color: colors.ink3 }]}>
        Legal & Policies
      </Text>

      <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        {/* Terms of Service */}
        <Pressable
          onPress={() => handleOpenUrl('https://chatboxai.co.in/terms-conditions')}
          style={({ pressed }) => [
            styles.actionRow,
            pressed && { backgroundColor: colors.hover },
          ]}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surface2 }]}>
            <IconFileText size={18} color={colors.ink} strokeWidth={1.8} />
          </View>
          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.ink }]}>Terms & Conditions</Text>
            <Text style={[styles.rowSubtitle, { color: colors.ink3 }]}>
              Read terms of service and acceptable usage policies
            </Text>
          </View>
          <IconExternalLink size={16} color={colors.ink3} strokeWidth={1.8} />
        </Pressable>

        <View style={[styles.divider, { backgroundColor: colors.line }]} />

        {/* Privacy Policy */}
        <Pressable
          onPress={() => handleOpenUrl('https://chatboxai.co.in/privacy-policy')}
          style={({ pressed }) => [
            styles.actionRow,
            pressed && { backgroundColor: colors.hover },
          ]}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surface2 }]}>
            <IconShield size={18} color={colors.ink} strokeWidth={1.8} />
          </View>
          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.ink }]}>Privacy Policy</Text>
            <Text style={[styles.rowSubtitle, { color: colors.ink3 }]}>
              Learn how your personal data and chats are protected
            </Text>
          </View>
          <IconExternalLink size={16} color={colors.ink3} strokeWidth={1.8} />
        </Pressable>
      </View>

      {/* ─── GROUP 3: APPLICATION SPECIFICATIONS ────────────────────────────── */}
      <Text style={[styles.sectionHeading, { color: colors.ink3 }]}>
        About ChatBox AI
      </Text>

      <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <View style={styles.specRow}>
          <Text style={[styles.specLabel, { color: colors.ink3 }]}>Version</Text>
          <Text style={[styles.specValue, { color: colors.ink }]}>1.0.0 (Release APK)</Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.line, marginLeft: 16 }]} />

        <View style={styles.specRow}>
          <Text style={[styles.specLabel, { color: colors.ink3 }]}>Build Number</Text>
          <Text style={[styles.specValue, { color: colors.ink }]}>42</Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.line, marginLeft: 16 }]} />

        <View style={styles.specRow}>
          <Text style={[styles.specLabel, { color: colors.ink3 }]}>Target Environment</Text>
          <Text style={[styles.specValue, { color: colors.ink }]}>
            {Platform.OS === 'android' ? 'Android Native' : Platform.OS === 'ios' ? 'iOS Native' : 'Mobile'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingBottom: spacing.lg,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  groupCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowTextCol: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  rowSubtitle: {
    fontSize: 12.5,
    marginTop: 2,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    marginLeft: 56,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  specLabel: {
    fontSize: 14,
  },
  specValue: {
    fontSize: 14,
    fontWeight: '500',
  },
});
