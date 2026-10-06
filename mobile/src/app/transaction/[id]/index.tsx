import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, CategoryIcon, Divider, EmptyState, IconButton, Loading, Screen } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { listAttachments } from '@/data/attachments';
import { getTransaction } from '@/data/transactions';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { categoryDisplayName } from '@/i18n';
import { deleteEntry } from '@/services/entries';
import { absoluteUri, folderLabel } from '@/services/receipt-files';
import { useStrings } from '@/state/settings';
import { formatDate, formatDateTime } from '@/utils/dates';
import { formatMoney, formatSignedMoney } from '@/utils/money';

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const { t, locale } = useStrings();
  const [deleting, setDeleting] = useState(false);

  const tx = useQuery((d) => getTransaction(d, id), [id]);
  const attachments = useQuery((d) => listAttachments(d, id), [id]);

  if (tx.loading) return <Loading />;
  const item = tx.data;
  if (!item) {
    return (
      <Screen edges={[]}>
        <EmptyState icon="alert-circle-outline" title={t.tx.deleted} />
      </Screen>
    );
  }

  const amountColor = item.kind === 'income' ? theme.income : theme.expense;
  const categoryName = categoryDisplayName(
    item.categoryName ? { name: item.categoryName, isSystem: item.categoryIsSystem } : null,
    t,
  );

  function confirmDelete() {
    Alert.alert(t.common.delete, t.tx.deleteConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete,
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteEntry(db, id);
            router.back();
          } catch (error) {
            setDeleting(false);
            Alert.alert(t.common.error, error instanceof Error ? error.message : String(error));
          }
        },
      },
    ]);
  }

  const details: { label: string; value: string | null }[] = [
    { label: t.tx.category, value: categoryName },
    { label: t.tx.date, value: formatDate(item.occurredOn, locale) },
    { label: item.kind === 'income' ? t.tx.counterpartyIncome : t.tx.counterpartyExpense, value: item.counterparty },
    { label: t.tx.paymentMethod, value: item.paymentMethod ? t.tx.payment[item.paymentMethod] : null },
    { label: t.tx.invoiceNumber, value: item.invoiceNumber },
    { label: t.tx.vat, value: item.vatCents != null ? formatMoney(item.vatCents, item.currency, locale) : null },
    { label: t.tx.note, value: item.note },
  ].filter((row) => row.value);

  return (
    <Screen edges={[]} scroll>
      <Stack.Screen
        options={{
          title: item.kind === 'income' ? t.kind.income : t.kind.expense,
          headerRight: () => (
            <IconButton icon="create-outline" color={theme.primary} onPress={() => router.push(`/transaction/${id}/edit`)} />
          ),
        }}
      />

      <View style={styles.hero}>
        <CategoryIcon icon={item.categoryIcon} color={item.categoryColor} size={56} />
        <AppText variant="title" color={amountColor}>
          {formatSignedMoney(item.amountCents, item.kind, item.currency, locale)}
        </AppText>
        <AppText variant="secondary">{item.counterparty || categoryName}</AppText>
      </View>

      <Card style={styles.card}>
        {details.map((row, index) => (
          <View key={row.label}>
            {index > 0 ? <Divider /> : null}
            <View style={styles.detailRow}>
              <AppText variant="secondary">{row.label}</AppText>
              <AppText style={styles.detailValue} align="right">
                {row.value}
              </AppText>
            </View>
          </View>
        ))}
      </Card>

      <View>
        <View style={styles.photosHeader}>
          <AppText variant="label">{t.tx.photos}</AppText>
          <AppText variant="mono">{folderLabel(item.month)}</AppText>
        </View>
        {attachments.data && attachments.data.length > 0 ? (
          <View style={styles.grid}>
            {attachments.data.map((attachment) => (
              <Pressable
                key={attachment.id}
                accessibilityRole="imagebutton"
                onPress={() => router.push(`/attachment/${attachment.id}`)}
                style={({ pressed }) => [styles.gridItem, { opacity: pressed ? 0.7 : 1 }]}>
                <Image
                  source={{ uri: absoluteUri(attachment.relativePath) }}
                  style={[styles.gridImage, { backgroundColor: theme.chip }]}
                  contentFit="cover"
                  transition={150}
                />
              </Pressable>
            ))}
          </View>
        ) : (
          <Card style={styles.noPhotos}>
            <Ionicons name="image-outline" size={20} color={theme.textMuted} />
            <AppText variant="secondary">{t.tx.noPhotos}</AppText>
          </Card>
        )}
      </View>

      <AppText variant="caption" align="center">
        {t.tx.added} {formatDateTime(item.createdAt, locale)}
        {item.updatedAt !== item.createdAt ? ` · ${t.tx.updated} ${formatDateTime(item.updatedAt, locale)}` : ''}
      </AppText>

      <Button title={t.common.delete} icon="trash-outline" variant="danger" onPress={confirmDelete} loading={deleting} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  card: { paddingVertical: 4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.lg, paddingVertical: 12 },
  detailValue: { flex: 1 },
  photosHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  gridItem: { width: '48%', aspectRatio: 3 / 4 },
  gridImage: { flex: 1, borderRadius: Radius.md },
  noPhotos: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
