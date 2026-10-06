import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Alert, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, Button, IconButton, Loading } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { getAttachment } from '@/data/attachments';
import { useQuery } from '@/hooks/use-query';
import { categoryDisplayName } from '@/i18n';
import { absoluteUri } from '@/services/receipt-files';
import { useStrings } from '@/state/settings';
import { formatDate } from '@/utils/dates';
import { formatSignedMoney } from '@/utils/money';

export default function AttachmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useStrings();
  const attachment = useQuery((db) => getAttachment(db, id), [id]);

  async function share() {
    if (!attachment.data) return;
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error(t.export.shareUnavailable);
      await Sharing.shareAsync(absoluteUri(attachment.data.relativePath), {
        mimeType: attachment.data.mimeType,
        dialogTitle: t.common.share,
        UTI: 'public.jpeg',
      });
    } catch (error) {
      Alert.alert(t.common.error, error instanceof Error ? error.message : String(error));
    }
  }

  const item = attachment.data;
  const caption = item
    ? [
        formatDate(item.occurredOn, locale),
        item.counterparty,
        categoryDisplayName(item.categoryName ? { name: item.categoryName, isSystem: item.categoryIsSystem } : null, t),
        formatSignedMoney(item.amountCents, item.kind, item.currency, locale),
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.toolbar}>
        <IconButton icon="close" color="#fff" size={26} onPress={() => router.back()} accessibilityLabel={t.common.close} />
        <View style={styles.flex} />
        <IconButton icon="share-outline" color="#fff" size={24} onPress={share} accessibilityLabel={t.common.share} />
      </View>
      {attachment.loading ? (
        <Loading />
      ) : item ? (
        <Image source={{ uri: absoluteUri(item.relativePath) }} style={styles.image} contentFit="contain" transition={200} />
      ) : (
        <View style={styles.flex} />
      )}
      {item ? (
        <View style={styles.footer}>
          <AppText color="#fff" align="center" numberOfLines={2}>
            {caption}
          </AppText>
          <Button
            title={t.tx.details}
            icon="open-outline"
            variant="secondary"
            onPress={() => router.push(`/transaction/${item.transactionId}`)}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  image: { flex: 1 },
  footer: { padding: Spacing.lg, gap: Spacing.md },
});
