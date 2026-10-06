import { StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useStrings } from '@/state/settings';
import { formatMoney } from '@/utils/money';

interface Props {
  incomeCents: number;
  expenseCents: number;
  caption?: string;
}

export function SummaryCard({ incomeCents, expenseCents, caption }: Props) {
  const theme = useTheme();
  const { t, locale, currency } = useStrings();
  const net = incomeCents - expenseCents;
  return (
    <Card style={styles.card}>
      <View style={styles.net}>
        <AppText variant="label">{t.home.net}</AppText>
        <AppText variant="title" color={net >= 0 ? theme.income : theme.expense}>
          {formatMoney(net, currency, locale)}
        </AppText>
        {caption ? <AppText variant="caption">{caption}</AppText> : null}
      </View>
      <View style={styles.columns}>
        <View style={[styles.column, { backgroundColor: theme.incomeSoft }]}>
          <AppText variant="caption" color={theme.income} weight="600">
            {t.home.income}
          </AppText>
          <AppText weight="700" color={theme.income}>
            {formatMoney(incomeCents, currency, locale)}
          </AppText>
        </View>
        <View style={[styles.column, { backgroundColor: theme.expenseSoft }]}>
          <AppText variant="caption" color={theme.expense} weight="600">
            {t.home.expenses}
          </AppText>
          <AppText weight="700" color={theme.expense}>
            {formatMoney(expenseCents, currency, locale)}
          </AppText>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.lg },
  net: { gap: 2 },
  columns: { flexDirection: 'row', gap: Spacing.sm },
  column: { flex: 1, borderRadius: 12, padding: Spacing.md, gap: 2 },
});
