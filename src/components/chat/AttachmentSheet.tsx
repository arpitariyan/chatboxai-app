import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { IconPhoto, IconCamera, IconFileText } from '@tabler/icons-react-native';
import { BottomSheet } from '@/components/common/BottomSheet';
import { useThemeColors, spacing, radius, typography } from '@/theme';

interface AttachmentSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectOption: (type: 'camera' | 'photo' | 'file') => void;
}

export const AttachmentSheet: React.FC<AttachmentSheetProps> = ({
  visible,
  onClose,
  onSelectOption,
}) => {
  const colors = useThemeColors();

  const options: Array<{
    id: 'camera' | 'photo' | 'file';
    icon: React.ComponentType<any>;
    title: string;
    desc: string;
  }> = [
    { id: 'photo', icon: IconPhoto, title: 'Photo Library', desc: 'Choose image from gallery' },
    { id: 'camera', icon: IconCamera, title: 'Take Photo', desc: 'Use camera to snap a picture' },
    { id: 'file', icon: IconFileText, title: 'Document & File', desc: 'Upload PDF, TXT, or Code files' },
  ];

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add Attachment">
      <View style={styles.container}>
        {options.map((opt) => {
          const IconComponent = opt.icon;
          return (
            <Pressable
              key={opt.id}
              onPress={() => {
                onSelectOption(opt.id);
                onClose();
              }}
              style={({ pressed }) => [
                styles.optionRow,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.line,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <View style={[styles.iconBox, { backgroundColor: colors.inset }]}>
                <IconComponent size={20} color={colors.ink} />
              </View>
              <View style={styles.textGroup}>
                <Text style={[styles.title, { color: colors.ink }]}>{opt.title}</Text>
                <Text style={[styles.desc, { color: colors.ink2 }]}>{opt.desc}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  optionRow: {
    height: 58,
    borderRadius: radius.control,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderCurve: radius.borderCurve,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    borderCurve: radius.borderCurve,
  },
  icon: {
    fontSize: 18,
  },
  textGroup: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  desc: {
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
});
