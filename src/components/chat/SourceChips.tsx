import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, View, Pressable, Linking } from 'react-native';
import { IconWorld, IconFlask, IconChevronDown, IconChevronUp, IconExternalLink } from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius } from '@/theme';
import { SvglIcon, getDomainFromUrl } from './SvglIcon';

export interface SourceItem {
  title?: string;
  url?: string;
  link?: string;
  snippet?: string;
  description?: string;
  name?: string;
  displayLink?: string;
  deepResearch?: boolean;
}

interface SourceChipsProps {
  searchResult?: any;
  onOpenSheet?: () => void;
}

const getDomainLabel = (item: SourceItem): string => {
  const rawUrl = item.url || item.link || '';
  if (!rawUrl) return item.title || item.name || 'Source';
  const domain = getDomainFromUrl(rawUrl);
  if (domain && domain !== 'unknown') return domain;
  return item.title || item.name || 'Source';
};

export const SourceChips: React.FC<SourceChipsProps> = ({ searchResult, onOpenSheet }) => {
  const colors = useThemeColors();
  const [showAll, setShowAll] = useState(false);

  const { sources, isDeepResearch, confidence } = useMemo(() => {
    if (!searchResult) return { sources: [], isDeepResearch: false, confidence: null };

    let parsed: any = searchResult;
    if (typeof searchResult === 'string') {
      try {
        parsed = JSON.parse(searchResult);
      } catch {
        return { sources: [], isDeepResearch: false, confidence: null };
      }
    }

    const list: any[] = Array.isArray(parsed)
      ? parsed
      : (parsed?.sources || parsed?.web || parsed?.searchResult || parsed?.mixedResults || []);

    const validSources = list.filter((item) => {
      const url = item?.url || item?.link;
      return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));
    });

    const isResearch = Boolean(parsed?.deepResearch || list.some((i) => i?.deepResearch));
    const conf = parsed?.confidence || null;

    return { sources: validSources, isDeepResearch: isResearch, confidence: conf };
  }, [searchResult]);

  if (sources.length === 0) return null;

  const CHIP_LIMIT = 4;
  const visibleSources = showAll ? sources : sources.slice(0, CHIP_LIMIT);
  const hiddenCount = Math.max(0, sources.length - CHIP_LIMIT);

  const handleOpenUrl = (url?: string) => {
    if (!url) return;
    Linking.openURL(url).catch((err) => console.warn('Failed to open source URL:', err));
  };

  return (
    <View style={styles.container}>
      {/* Section Header matching website SourceList */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          {isDeepResearch ? (
            <IconFlask size={13} color="#a78bfa" />
          ) : (
            <IconWorld size={14} color={colors.accent || '#3b82f6'} />
          )}
          <Text style={[styles.sectionHeading, { color: isDeepResearch ? '#a78bfa' : colors.ink2 }]}>
            {isDeepResearch ? 'RESEARCH SOURCES' : 'SOURCES'}
          </Text>
          <Text style={[styles.sourceCount, { color: colors.ink3 }]}>
            ({sources.length})
          </Text>
        </View>

        {confidence && confidence !== 'Not Assessed' && (
          <View
            style={[
              styles.confidenceBadge,
              {
                backgroundColor:
                  confidence === 'High'
                    ? 'rgba(34, 197, 94, 0.12)'
                    : confidence === 'Medium'
                      ? 'rgba(59, 130, 246, 0.12)'
                      : 'rgba(245, 158, 11, 0.12)',
              },
            ]}
          >
            <Text
              style={[
                styles.confidenceText,
                {
                  color:
                    confidence === 'High'
                      ? '#22c55e'
                      : confidence === 'Medium'
                        ? '#60a5fa'
                        : '#f59e0b',
                },
              ]}
            >
              {confidence} Confidence
            </Text>
          </View>
        )}

        {onOpenSheet && sources.length > 2 && (
          <Pressable
            onPress={onOpenSheet}
            hitSlop={8}
            style={({ pressed }) => [
              styles.viewAllBtn,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.viewAllText, { color: colors.accent || '#3b82f6' }]}>
              View all
            </Text>
            <IconExternalLink size={11} color={colors.accent || '#3b82f6'} />
          </Pressable>
        )}
      </View>

      {/* Wrapping Pill Chips with domain brand logos */}
      <View style={styles.chipsWrap}>
        {visibleSources.map((item, index) => {
          const domain = getDomainLabel(item);
          const targetUrl = item.url || item.link;

          return (
            <Pressable
              key={`source-chip-${index}-${targetUrl}`}
              onPress={() => handleOpenUrl(targetUrl)}
              accessibilityRole="link"
              accessibilityLabel={`Open source: ${item.title || domain}`}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.line,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <View style={styles.iconBox}>
                <SvglIcon domain={domain} size={14} color={colors.ink3} />
              </View>
              <Text
                style={[styles.chipText, { color: colors.ink }]}
                numberOfLines={1}
              >
                {domain}
              </Text>
            </Pressable>
          );
        })}

        {/* Toggle +X More / Open Full Sheet */}
        {hiddenCount > 0 && (
          <Pressable
            onPress={() => {
              if (onOpenSheet) {
                onOpenSheet();
              } else {
                setShowAll(!showAll);
              }
            }}
            style={({ pressed }) => [
              styles.toggleChip,
              {
                backgroundColor: colors.surface,
                borderColor: colors.line,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Text style={[styles.toggleText, { color: colors.ink2 }]}>
              {showAll ? 'Show less' : `+${hiddenCount} more`}
            </Text>
            {showAll ? (
              <IconChevronUp size={12} color={colors.ink3} />
            ) : (
              <IconChevronDown size={12} color={colors.ink3} />
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm + 2,
    marginBottom: spacing.xs,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  sourceCount: {
    fontSize: 11,
    fontWeight: '600',
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 'auto',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  viewAllText: {
    fontSize: 11,
    fontWeight: '500',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    maxWidth: 170,
  },
  iconBox: {
    width: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  toggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  toggleText: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  confidenceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

