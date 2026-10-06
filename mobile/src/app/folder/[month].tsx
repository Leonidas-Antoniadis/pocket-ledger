import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { AppText, BusyOverlay, EmptyState, IconButton, Loading, Screen } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { listReceiptsForPeriod } from '@/data/attachments';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { exportReceiptsZip } from '@/services/export';
import { absoluteUri, folderLabel } from '@/services/receipt-files';
import { useSettings, useStrings } from '@/state/settings';
import { formatMonth } from '@/utils/dates';
import { formatSignedMoney } from '@/utils/money';

export default function FolderScreen() {
  const { month } = useLocalSearchParams<{ month: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const { t, locale, currency } = useStrings();
  const { settings } = useSettings();
  const [busy, setBusy] = useState(false);

  const receipts = useQuery((d) => listReceiptsForPeriod(d, month), [month]);

  async function shareFolder() {
    setBusy(true);
    try {
      const outcome = await exportReceiptsZip(
        db,
        { type: 'month', month },
        { t, locale, currency, profileName: settings.profileName },
      );
      if (outcome === 'empty') Alert.alert(t.export.nothing);
    } catch (error) {
      Alert.alert(t.common.error, error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={[]}>
      <Stack.Screen
        options={{
          title: formatMonth(month, locale),
          headerRight: () => <IconButton icon="share-outline" color={theme.primary} onPress={shareFolder} />,
        }}
      />
      <FlatList
        data={receipts.data ?? []}
        keyExtractor={(item) => item.id}
        numColumns={3}
        columnWrapperStyle={styles.columns}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <AppText variant="mono">{folderLabel(month)}</AppText>
            <AppText variant="caption">{t.home.receipts(receipts.data?.length ?? 0)}</AppText>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="imagebutton"
            onPress={() => router.push(`/attachment/${item.id}`)}
            style={({ pressed }) => [styles.cell, { opacity: pressed ? 0.7 : 1 }]}>
            <Image
              source={{ uri: absoluteUri(item.relativePath) }}
              style={[styles.image, { backgroundColor: theme.chip }]}
              contentFit="cover"
              transition={150}
            />
            <AppText variant="caption" numberOfLines={1} color={item.kind === 'income' ? theme.income : theme.expense}>
              {formatSignedMoney(item.amountCents, item.kind, item.currency, locale)}
            </AppText>
            <AppText variant="caption" numberOfLines={1}>
              {item.occurredOn.slice(8)} · {item.counterparty ?? ''}
            </AppText>
          </Pressable>
        )}
        ListEmptyComponent={
          receipts.loading ? <Loading /> : <EmptyState icon="images-outline" title={t.receipts.noPhotosInMonth} />
        }
      />
      <BusyOverlay visible={busy} label={t.export.working} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl * 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  columns: { gap: Spacing.sm, marginBottom: Spacing.md },
  cell: { flex: 1 / 3, gap: 2 },
  image: { width: '100%', aspectRatio: 3 / 4, borderRadius: Radius.md },
});
