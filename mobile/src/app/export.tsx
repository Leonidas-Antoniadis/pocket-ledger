import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { MonthSwitcher } from '@/components/month-switcher';
import { AppText, BusyOverlay, Card, Chip, Divider, ListRow, Screen, SectionHeader, Segmented } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { listYearsWithData } from '@/data/transactions';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { createBackup, InvalidBackupError, pickAndRestoreBackup } from '@/services/backup';
import { exportCsv, exportPdf, exportReceiptsZip, type ExportOutcome, type Period } from '@/services/export';
import { useSettings, useStrings } from '@/state/settings';
import { currentMonthKey } from '@/utils/dates';

type PeriodType = 'month' | 'year';

export default function ExportScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { t, locale, currency } = useStrings();
  const { settings } = useSettings();
  const currentYear = new Date().getFullYear();

  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [month, setMonth] = useState(currentMonthKey());
  const [year, setYear] = useState(currentYear);
  const [includePhotos, setIncludePhotos] = useState(true);
  const [busy, setBusy] = useState(false);

  const years = useQuery(listYearsWithData, []);
  const yearOptions = Array.from(new Set([currentYear, ...(years.data ?? [])])).sort((a, b) => b - a);

  const period: Period = periodType === 'month' ? { type: 'month', month } : { type: 'year', year };
  const ctx = { t, locale, currency, profileName: settings.profileName };

  async function run(task: () => Promise<ExportOutcome | void>) {
    setBusy(true);
    try {
      const outcome = await task();
      if (outcome === 'empty') Alert.alert(t.export.nothing);
    } catch (error) {
      Alert.alert(t.common.error, error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  function confirmRestore() {
    Alert.alert(t.export.restore, t.export.restoreConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.confirm,
        onPress: () =>
          void run(async () => {
            try {
              const restored = await pickAndRestoreBackup(db);
              if (restored !== null) Alert.alert(t.export.restoreDone(restored));
            } catch (error) {
              if (error instanceof InvalidBackupError) {
                Alert.alert(t.export.restoreInvalid);
                return;
              }
              throw error;
            }
          }),
      },
    ]);
  }

  return (
    <Screen edges={[]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <SectionHeader title={t.export.period} />
          <Card style={styles.periodCard}>
            <Segmented<PeriodType>
              value={periodType}
              onChange={setPeriodType}
              options={[
                { value: 'month', label: t.export.month },
                { value: 'year', label: t.export.year },
              ]}
            />
            {periodType === 'month' ? (
              <MonthSwitcher month={month} onChange={setMonth} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.years}>
                {yearOptions.map((option) => (
                  <Chip key={option} label={String(option)} selected={option === year} onPress={() => setYear(option)} />
                ))}
              </ScrollView>
            )}
          </Card>
        </View>

        <View>
          <SectionHeader title={t.export.title} />
          <Card style={styles.card}>
            <ListRow
              title={t.export.csv}
              subtitle={t.export.csvHint}
              icon="document-text-outline"
              chevron
              onPress={() => void run(() => exportCsv(db, period, ctx))}
            />
            <Divider />
            <ListRow
              title={t.export.pdf}
              subtitle={t.export.pdfHint}
              icon="reader-outline"
              chevron
              onPress={() => void run(() => exportPdf(db, period, ctx, includePhotos))}
            />
            <View style={styles.switchRow}>
              <AppText variant="secondary" style={styles.flex}>
                {t.export.includePhotos}
              </AppText>
              <Switch value={includePhotos} onValueChange={setIncludePhotos} trackColor={{ true: theme.primary }} />
            </View>
            <Divider />
            <ListRow
              title={t.export.zip}
              subtitle={t.export.zipHint}
              icon="images-outline"
              chevron
              onPress={() => void run(() => exportReceiptsZip(db, period, ctx))}
            />
          </Card>
        </View>

        <View>
          <SectionHeader title={t.export.backupSection} />
          <Card style={styles.card}>
            <ListRow
              title={t.export.backup}
              subtitle={t.export.backupHint}
              icon="archive-outline"
              chevron
              onPress={() => void run(() => createBackup(db, t))}
            />
            <Divider />
            <ListRow
              title={t.export.restore}
              subtitle={t.export.restoreHint}
              icon="cloud-upload-outline"
              chevron
              onPress={confirmRestore}
            />
          </Card>
        </View>
      </ScrollView>
      <BusyOverlay visible={busy} label={t.export.working} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl * 2 },
  periodCard: { gap: Spacing.md },
  years: { gap: Spacing.sm },
  card: { paddingVertical: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingBottom: 12, paddingLeft: 36 + Spacing.md },
});
