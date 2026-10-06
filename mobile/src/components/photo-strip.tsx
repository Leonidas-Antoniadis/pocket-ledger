import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useStrings } from '@/state/settings';

export interface PhotoItem {
  key: string;
  uri: string;
}

interface Props {
  photos: PhotoItem[];
  busy?: boolean;
  onTakePhoto: () => void;
  onPickPhoto: () => void;
  onRemove: (key: string) => void;
  onOpen?: (key: string) => void;
}

export function PhotoStrip({ photos, busy, onTakePhoto, onPickPhoto, onRemove, onOpen }: Props) {
  const theme = useTheme();
  const { t } = useStrings();
  return (
    <View style={styles.wrap}>
      {photos.length > 0 || busy ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {photos.map((photo) => (
            <View key={photo.key} style={styles.thumbWrap}>
              <Pressable onPress={onOpen ? () => onOpen(photo.key) : undefined} accessibilityRole="imagebutton">
                <Image
                  source={{ uri: photo.uri }}
                  style={[styles.thumb, { backgroundColor: theme.chip }]}
                  contentFit="cover"
                  transition={150}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.common.delete}
                onPress={() => onRemove(photo.key)}
                hitSlop={6}
                style={[styles.remove, { backgroundColor: theme.card }]}>
                <Ionicons name="close" size={14} color={theme.danger} />
              </Pressable>
            </View>
          ))}
          {busy ? (
            <View style={[styles.thumb, styles.busy, { backgroundColor: theme.chip }]}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <AppText variant="caption">{t.tx.noPhotos}</AppText>
      )}
      <View style={styles.buttons}>
        <Button title={t.tx.takePhoto} icon="camera" variant="secondary" onPress={onTakePhoto} style={styles.button} />
        <Button title={t.tx.pickPhoto} icon="images" variant="secondary" onPress={onPickPhoto} style={styles.button} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  strip: { gap: Spacing.md, paddingVertical: 4, paddingRight: Spacing.sm },
  thumbWrap: { width: 96, height: 96 },
  thumb: { width: 96, height: 96, borderRadius: Radius.md },
  busy: { alignItems: 'center', justifyContent: 'center' },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  buttons: { flexDirection: 'row', gap: Spacing.sm },
  button: { flex: 1 },
});
