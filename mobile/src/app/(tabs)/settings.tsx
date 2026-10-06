import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Card, Divider, ListRow, Screen, SectionHeader, Segmented, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { totalAttachmentBytes } from '@/data/attachments';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { LANGUAGES } from '@/i18n';
import { deleteAllData } from '@/services/entries';
import { useSettings } from '@/state/settings';
import type { Language } from '@/types';
import { formatBytes } from '@/utils/money';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'TRY', 'ILS', 'AED', 'JPY', 'CAD', 'AUD'];

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const { settings, strings: t, updateSettings } = useSettings();
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [profileName, setProfileName] = useState(settings.profileName);
  const storage = useQuery(totalAttachmentBytes, []);

  function confirmDeleteAll() {
    Alert.alert(t.settings.deleteAll, t.settings.deleteAllConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete,
        style: 'destructive',
        onPress: () => {
          Alert.alert(t.settings.deleteAll, t.common.confirm + '?', [
            { text: t.common.cancel, style: 'cancel' },
            {
              text: t.common.delete,
              style: 'destructive',
              onPress: async () => {
                try {
                  await deleteAllData(db);
                  Alert.alert(t.settings.deleteAllDone);
                } catch (error) {
                  Alert.alert(t.common.error, error instanceof Error ? error.message : String(error));
                }
              },
            },
          ]);
        },
      },
    ]);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppText variant="title">{t.settings.title}</AppText>

        <View>
          <SectionHeader title={t.settings.general} />
          <Card style={styles.card}>
            <ListRow
              title={t.settings.currency}
              icon="cash-outline"
              value={settings.currency}
              chevron
              onPress={() => setCurrencyPickerOpen(true)}
            />
            <Divider />
            <View style={styles.languageRow}>
              <ListRow title={t.settings.language} icon="language-outline" />
              <Segmented<Language>
                value={settings.language}
                onChange={(language) => void updateSettings({ language })}
                options={LANGUAGES.map((code) => ({ value: code, label: t.settings.languages[code] ?? code }))}
              />
            </View>
            <Divider />
            <View style={styles.profileRow}>
              <ListRow title={t.settings.profileName} subtitle={t.settings.profileNameHint} icon="person-outline" />
              <TextField
                value={profileName}
                onChangeText={setProfileName}
                onBlur={() => void updateSettings({ profileName: profileName.trim() })}
                onSubmitEditing={() => void updateSettings({ profileName: profileName.trim() })}
                placeholder="—"
                returnKeyType="done"
              />
            </View>
          </Card>
        </View>

        <View>
          <SectionHeader title={t.settings.data} />
          <Card style={styles.card}>
            <ListRow
              title={t.settings.categories}
              subtitle={t.settings.categoriesHint}
              icon="pricetags-outline"
              chevron
              onPress={() => router.push('/categories')}
            />
            <Divider />
            <ListRow
              title={t.settings.exportBackup}
              subtitle={t.settings.exportBackupHint}
              icon="download-outline"
              chevron
              onPress={() => router.push('/export')}
            />
            <Divider />
            <ListRow title={t.settings.storage} icon="images-outline" value={formatBytes(storage.data ?? 0)} />
            <Divider />
            <ListRow title={t.settings.deleteAll} icon="trash-outline" destructive onPress={confirmDeleteAll} />
          </Card>
        </View>

        <View>
          <SectionHeader title={t.settings.about} />
          <Card style={styles.card}>
            <ListRow title={t.settings.cloudSync} subtitle={t.settings.cloudSyncHint} icon="cloud-offline-outline" />
            <Divider />
            <ListRow
              title={t.settings.version}
              icon="information-circle-outline"
              value={Constants.expoConfig?.version ?? '1.0.0'}
            />
          </Card>
        </View>
      </ScrollView>

      <Modal visible={currencyPickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCurrencyPickerOpen(false)}>
        <View style={[styles.modal, { backgroundColor: theme.background }]}>
          <View style={styles.modalHeader}>
            <AppText variant="heading">{t.settings.currency}</AppText>
            <Pressable onPress={() => setCurrencyPickerOpen(false)} hitSlop={8} accessibilityRole="button">
              <AppText color={theme.primary} weight="600">
                {t.common.close}
              </AppText>
            </Pressable>
          </View>
          <FlatList
            data={CURRENCIES}
            keyExtractor={(code) => code}
            ItemSeparatorComponent={Divider}
            renderItem={({ item }) => (
              <ListRow
                title={item}
                value={item === settings.currency ? '✓' : undefined}
                onPress={() => {
                  void updateSettings({ currency: item });
                  setCurrencyPickerOpen(false);
                }}
              />
            )}
          />
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl * 2 },
  card: { paddingVertical: 4 },
  languageRow: { gap: Spacing.xs, paddingBottom: Spacing.md },
  profileRow: { gap: Spacing.xs, paddingBottom: Spacing.md },
  modal: { flex: 1, padding: Spacing.lg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
});
