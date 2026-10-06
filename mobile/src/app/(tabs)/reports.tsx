import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { SummaryCard } from '@/components/summary-card';
import { AppText, Card, CategoryIcon, Chip, Divider, EmptyState, Loading, Screen, SectionHeader, Segmented } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { listCategoryTotals, listMonthSummariesForYear, listYearsWithData } from '@/data/transactions';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { categoryDisplayName } from '@/i18n';
import { useStrings } from '@/state/settings';
import type { Kind } from '@/types';
import { formatShortMonth, monthsOfYear } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

export default function ReportsScreen() {
  const theme = useTheme();
  const { t, locale, currency } = useStrings();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [categoryKind, setCategoryKind] = useState<Kind>('expense');

  const years = useQuery(listYearsWithData, []);
  const monthly = useQuery((db) => listMonthSummariesForYear(db, year), [year]);
  const totals = useQuery((db) => listCategoryTotals(db, { year }), [year]);

  const yearOptions = Array.from(new Set([currentYear, ...(years.data ?? [])])).sort((a, b) => b - a);
  const byMonth = new Map((monthly.data ?? []).map((m) => [m.month, m]));
  const incomeTotal = (monthly.data ?? []).reduce((sum, m) => sum + m.incomeCents, 0);
  const expenseTotal = (monthly.data ?? []).reduce((sum, m) => sum + m.expenseCents, 0);
  const activeMonths = (monthly.data ?? []).length;
  const maxMonthly = Math.max(1, ...(monthly.data ?? []).flatMap((m) => [m.incomeCents, m.expenseCents]));
  const entryCount = (monthly.data ?? []).reduce((sum, m) => sum + m.transactionCount, 0);

  const kindTotals = (totals.data ?? []).filter((c) => c.kind === categoryKind);
  const kindSum = Math.max(1, kindTotals.reduce((sum, c) => sum + c.totalCents, 0));

  const hasData = !monthly.loading && activeMonths > 0;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="title">{t.reports.title}</AppText>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.years}>
          {yearOptions.map((option) => (
            <Chip key={option} label={String(option)} selected={option === year} onPress={() => setYear(option)} />
          ))}
        </ScrollView>

        {monthly.loading ? <Loading /> : null}

        {!monthly.loading && !hasData ? <EmptyState icon="stats-chart-outline" title={t.reports.noData} /> : null}

        {hasData ? (
          <>
            <SummaryCard
              incomeCents={incomeTotal}
              expenseCents={expenseTotal}
              caption={`${t.reports.entries(entryCount)} · ${t.reports.avgPerMonth}: ${formatMoney(
                Math.round((incomeTotal - expenseTotal) / Math.max(1, activeMonths)),
                currency,
                locale,
              )}`}
            />

            <View>
              <SectionHeader title={t.reports.byMonth} />
              <Card style={styles.monthCard}>
                {monthsOfYear(year).map((monthKey, index) => {
                  const data = byMonth.get(monthKey);
                  const income = data?.incomeCents ?? 0;
                  const expense = data?.expenseCents ?? 0;
                  return (
                    <View key={monthKey}>
                      {index > 0 ? <Divider style={styles.monthDivider} /> : null}
                      <View style={[styles.monthRow, !data && styles.dim]}>
                        <AppText variant="secondary" style={styles.monthLabel}>
                          {formatShortMonth(monthKey, locale)}
                        </AppText>
                        <View style={styles.bars}>
                          <View style={[styles.bar, { backgroundColor: theme.income, width: `${(income / maxMonthly) * 100}%` }]} />
                          <View style={[styles.bar, { backgroundColor: theme.expense, width: `${(expense / maxMonthly) * 100}%` }]} />
                        </View>
                        <View style={styles.monthAmounts}>
                          <AppText variant="caption" color={theme.income}>
                            {formatMoney(income, currency, locale)}
                          </AppText>
                          <AppText variant="caption" color={theme.expense}>
                            {formatMoney(expense, currency, locale)}
                          </AppText>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </Card>
            </View>

            <View>
              <SectionHeader title={t.reports.byCategory} />
              <Segmented<Kind>
                value={categoryKind}
                onChange={setCategoryKind}
                style={styles.kindSwitch}
                options={[
                  { value: 'expense', label: t.kind.expenses, color: theme.expense },
                  { value: 'income', label: t.kind.income, color: theme.income },
                ]}
              />
              <Card style={styles.categoryCard}>
                {kindTotals.length === 0 ? (
                  <AppText variant="secondary" align="center">
                    {t.reports.noData}
                  </AppText>
                ) : (
                  kindTotals.map((item, index) => {
                    const share = item.totalCents / kindSum;
                    const name = categoryDisplayName(
                      item.name ? { name: item.name, isSystem: item.isSystem } : null,
                      t,
                    );
                    return (
                      <View key={`${item.categoryId ?? 'none'}-${item.kind}`}>
                        {index > 0 ? <Divider style={styles.categoryDivider} /> : null}
                        <View style={styles.categoryRow}>
                          <CategoryIcon icon={item.icon} color={item.color} size={36} />
                          <View style={styles.flex}>
                            <View style={styles.categoryHeader}>
                              <AppText weight="600" numberOfLines={1} style={styles.flex}>
                                {name}
                              </AppText>
                              <AppText weight="600">{formatMoney(item.totalCents, currency, locale)}</AppText>
                            </View>
                            <View style={[styles.track, { backgroundColor: theme.chip }]}>
                              <View
                                style={[
                                  styles.fill,
                                  { backgroundColor: item.color ?? theme.primary, width: `${share * 100}%` },
                                ]}
                              />
                            </View>
                            <AppText variant="caption">
                              {Math.round(share * 100)}% · {t.reports.entries(item.count)}
                            </AppText>
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </Card>
            </View>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl * 2 },
  years: { gap: Spacing.sm },
  monthCard: { paddingVertical: Spacing.sm },
  monthDivider: { marginVertical: 2 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 6 },
  dim: { opacity: 0.45 },
  monthLabel: { width: 40 },
  bars: { flex: 1, gap: 4 },
  bar: { height: 8, borderRadius: 4, minWidth: 2 },
  monthAmounts: { alignItems: 'flex-end', minWidth: 84 },
  kindSwitch: { marginBottom: Spacing.md },
  categoryCard: { gap: 0 },
  categoryDivider: { marginVertical: Spacing.md },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  track: { height: 6, borderRadius: 3, marginVertical: 6, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
