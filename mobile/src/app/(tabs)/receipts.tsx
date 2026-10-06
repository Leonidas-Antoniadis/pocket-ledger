import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, EmptyState, Loading, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { listMonthSummaries } from '@/data/transactions';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { folderLabel } from '@/services/receipt-files';
import { useStrings } from '@/state/settings';
import { formatMonth } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

export default function ReceiptsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { t, locale, currency } = useStrings();
  const months = useQuery(listMonthSummaries, []);

  return (
    <Screen>
      <FlatList
        data={months.data ?? []}
        keyExtractor={(item) => item.month}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <AppText variant="title">{t.receipts.title}</AppText>
            <AppText variant="secondary">{t.receipts.emptyHint}</AppText>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/folder/${item.month}`)} accessibilityRole="button">
            {({ pressed }) => (
              <Card style={[styles.card, { opacity: pressed ? 0.7 : 1 }]}>
                <View style={[styles.folderIcon, { backgroundColor: theme.primarySoft }]}>
                  <Ionicons name="folder" size={26} color={theme.primary} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="subheading">{formatMonth(item.month, locale)}</AppText>
                  <AppText variant="caption">
                    {t.home.receipts(item.receiptCount)} · {t.home.entries(item.transactionCount)}
                  </AppText>
                  <AppText variant="mono">{folderLabel(item.month)}</AppText>
                </View>
                <View style={styles.amounts}>
                  <AppText variant="caption" color={theme.income} weight="600">
                    +{formatMoney(item.incomeCents, currency, locale)}
                  </AppText>
                  <AppText variant="caption" color={theme.expense} weight="600">
                    -{formatMoney(item.expenseCents, currency, locale)}
                  </AppText>
                  <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                </View>
              </Card>
            )}
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        ListEmptyComponent={
          months.loading ? <Loading /> : <EmptyState icon="folder-open-outline" title={t.receipts.empty} hint={t.receipts.emptyHint} />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl * 2 },
  header: { gap: Spacing.xs, marginBottom: Spacing.lg },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  folderIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  amounts: { alignItems: 'flex-end', gap: 2 },
  gap: { height: Spacing.md },
});
