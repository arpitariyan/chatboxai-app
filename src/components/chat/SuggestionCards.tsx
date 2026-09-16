import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { IconPhoto, IconEdit, IconFileText, IconBulb } from '@tabler/icons-react-native';
import { useThemeColors, spacing, typography } from '@/theme';

interface SuggestionItem {
  id: string;
  icon: React.ComponentType<any>;
  title: string;
  promptText: string;
}

interface SuggestionCardsProps {
  onSelectSuggestion: (prompt: string) => void;
}

export const SuggestionCards: React.FC<SuggestionCardsProps> = ({
  onSelectSuggestion,
}) => {
  const colors = useThemeColors();

  const suggestions: SuggestionItem[] = [
    {
      id: '1',
      icon: IconPhoto,
      title: 'Create an image or sticker',
      promptText: 'Create a high quality futuristic illustration of a smart mobile assistant.',
    },
    {
      id: '2',
      icon: IconEdit,
      title: 'Write or edit',
      promptText: 'Help me write a concise, compelling announcement email.',
    },
    {
      id: '3',
      icon: IconFileText,
      title: 'Analyze a document',
      promptText: 'Summarize key technical requirements and architectural decisions.',
    },
    {
      id: '4',
      icon: IconBulb,
      title: 'Brainstorm ideas',
      promptText: 'Give me 5 unique product feature ideas for a mobile AI app.',
    },
  ];

  return (
    <View style={styles.container}>
      {suggestions.map((item) => {
        const IconComponent = item.icon;
        return (
          <Pressable
            key={item.id}
            onPress={() => onSelectSuggestion(item.promptText)}
            style={({ pressed }) => [
              styles.listRow,
              { opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <IconComponent size={20} color={colors.ink2} />
            <Text style={[styles.title, { color: colors.ink }]}>{item.title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: spacing.xs,
    gap: spacing.sm,
  },
  listRow: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {
    fontSize: 18,
  },
  title: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.normal,
  },
});
