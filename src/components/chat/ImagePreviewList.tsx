import React, { useMemo } from 'react';
import { StyleSheet, Text, View, Image, ScrollView, Pressable, Linking } from 'react-native';
import { IconPhoto } from '@tabler/icons-react-native';
import { useThemeColors, spacing, radius } from '@/theme';

interface ImageItem {
  id: string;
  url: string;
  thumbnail?: string;
  title?: string;
}

interface ImagePreviewListProps {
  searchResult?: any;
}

export const ImagePreviewList: React.FC<ImagePreviewListProps> = React.memo(({ searchResult }) => {
  const colors = useThemeColors();

  const images = useMemo<ImageItem[]>(() => {
    if (!searchResult) return [];

    let parsed: any = searchResult;
    if (typeof searchResult === 'string') {
      try {
        parsed = JSON.parse(searchResult);
      } catch {
        return [];
      }
    }

    const list: any[] = Array.isArray(parsed)
      ? parsed
      : parsed?.images || parsed?.searchResult || parsed?.mixedResults || [];

    const result: ImageItem[] = [];
    list.forEach((item, index) => {
      const imgUrl = item?.image || item?.thumbnail || item?.thumbnailUrl;
      if (typeof imgUrl === 'string' && (imgUrl.startsWith('http://') || imgUrl.startsWith('https://'))) {
        result.push({
          id: `img-${index}-${imgUrl.slice(-10)}`,
          url: imgUrl,
          thumbnail: item?.thumbnail || imgUrl,
          title: item?.title || 'Image',
        });
      }
    });

    return result;
  }, [searchResult]);

  if (images.length === 0) return null;

  const handleOpenImage = (url: string) => {
    Linking.openURL(url).catch((err) => console.warn('Failed to open image URL:', err));
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <IconPhoto size={14} color={colors.ink3} />
        <Text style={[styles.sectionHeading, { color: colors.ink3 }]}>
          IMAGES
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {images.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => handleOpenImage(item.url)}
            style={({ pressed }) => [
              styles.card,
              {
                borderColor: colors.line,
                backgroundColor: colors.surface,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Image
              source={{ uri: item.thumbnail || item.url }}
              style={styles.image}
              resizeMode="cover"
            />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm + 2,
    marginBottom: spacing.xs,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  scrollContent: {
    gap: spacing.xs + 2,
    paddingRight: spacing.sm,
  },
  card: {
    width: 110,
    height: 75,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
