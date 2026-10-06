import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';

import { MonthSwitcher } from '@/components/month-switcher';
import { SummaryCard } from '@/components/summary-card';
import { TransactionRow } from '@/components/transaction-row';
import { AppText, Button, Card, Divider, EmptyState, Loading, Row, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { getMonthSummary, listTransactionsByMonth } from '@/data/transactions';
import { useQuery } from '@/hooks/use-query';
import { useStrings } from '@/state/settings';
import type { TransactionListItem } from '@/types';
import { currentMonthKey, formatDayHeading } from '@/utils/dates';

interface DaySection {
  title: string;
  data: TransactionListItem[];
}

function groupByDay(items: TransactionListItem[]): DaySection[] {
  const sections: DaySection[] = [];
  for (const item of items) {
    const last = sections[sections.length - 1];
    if (last && last.title === item.occurredOn) {
      last.data.push(item);
    } else {
      sections.push({ title: item.occurredOn, data: [item] });
    }
  }
  return sections;
}

export default function HomeScreen() {
  const router = useRouter();
  const { t, locale } = useStrings();
  const [month, setMonth] = useState(currentMonthKey());

  const summary = useQuery((db) => getMonthSummary(db, month), [month]);
  const list = useQuery((db) => listTransactionsByMonth(db, month), [month]);
  const sections = groupByDay(list.data ?? []);

  return (
    <Screen>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <MonthSwitcher month={month} onChange={setMonth} />
            <SummaryCard
              incomeCents={summary.data?.incomeCents ?? 0}
              expenseCents={summary.data?.expenseCents ?? 0}
              caption={
                summary.data
                  ? `${t.home.entries(summary.data.transactionCount)} · ${t.home.receipts(summary.data.receiptCount)}`
                  : undefined
              }
            />
            <Button
              title={t.home.snapReceipt}
              icon="camera"
              size="lg"
              onPress={() => router.push({ pathname: '/transaction/new', params: { kind: 'expense', capture: '1' } })}
            />
            <Row>
              <Button
                title={t.home.addExpense}
                icon="remove-circle"
                variant="expense"
                style={styles.flex}
                onPress={() => router.push({ pathname: '/transaction/new', params: { kind: 'expense' } })}
              />
              <Button
                title={t.home.addIncome}
                icon="add-circle"
                variant="income"
                style={styles.flex}
                onPress={() => router.push({ pathname: '/transaction/new', params: { kind: 'income' } })}
              />
            </Row>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <AppText variant="label" style={styles.dayHeading}>
            {formatDayHeading(section.title, locale)}
          </AppText>
        )}
        renderItem={({ item, index, section }) => (
          <Card style={[styles.rowCard, index === 0 && styles.rowCardFirst, index === section.data.length - 1 && styles.rowCardLast]}>
            <TransactionRow item={item} onPress={() => router.push(`/transaction/${item.id}`)} />
          </Card>
        )}
        ItemSeparatorComponent={() => <Divider style={styles.separator} />}
        ListEmptyComponent={
          list.loading ? <Loading /> : <EmptyState icon="receipt-outline" title={t.home.empty} hint={t.home.emptyHint} />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl * 2 },
  header: { gap: Spacing.lg, marginBottom: Spacing.md },
  dayHeading: { marginTop: Spacing.lg, marginBottom: Spacing.sm, marginLeft: 2 },
  rowCard: { paddingVertical: 4, paddingHorizontal: Spacing.md, borderRadius: 0, borderWidth: 0 },
  rowCardFirst: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  rowCardLast: { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  separator: { marginLeft: Spacing.md + 44 + Spacing.md },
});
