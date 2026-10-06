import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, IconButton } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useStrings } from '@/state/settings';
import { currentMonthKey, formatMonth, shiftMonth } from '@/utils/dates';

interface Props {
  month: string;
  onChange: (month: string) => void;
}

export function MonthSwitcher({ month, onChange }: Props) {
  const theme = useTheme();
  const { locale, t } = useStrings();
  const isCurrent = month === currentMonthKey();
  return (
    <View style={styles.wrap}>
      <IconButton icon="chevron-back" onPress={() => onChange(shiftMonth(month, -1))} accessibilityLabel="Previous month" />
      <Pressable style={styles.center} onPress={() => onChange(currentMonthKey())} accessibilityRole="button">
        <AppText variant="heading" align="center">
          {formatMonth(month, locale)}
        </AppText>
        {!isCurrent ? (
          <AppText variant="caption" color={theme.primary} align="center">
            {t.common.today}
          </AppText>
        ) : null}
      </Pressable>
      <IconButton icon="chevron-forward" onPress={() => onChange(shiftMonth(month, 1))} accessibilityLabel="Next month" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.sm },
  center: { flex: 1, alignItems: 'center' },
});
