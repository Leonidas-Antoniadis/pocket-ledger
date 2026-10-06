import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { DATABASE_NAME, initializeDatabase } from '@/db/database';
import { useTheme } from '@/hooks/use-theme';
import { cleanupInbox } from '@/services/receipt-files';
import { SettingsProvider, useStrings } from '@/state/settings';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

async function onDatabaseInit(db: SQLiteDatabase) {
  await initializeDatabase(db);
  cleanupInbox();
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.primary,
      background: theme.background,
      card: theme.card,
      text: theme.text,
      border: theme.border,
    },
  };

  return (
    <SQLiteProvider
      databaseName={DATABASE_NAME}
      onInit={onDatabaseInit}
      onError={(error) => {
        console.error('Database failed to open', error);
        SplashScreen.hideAsync().catch(() => undefined);
      }}>
      <SettingsProvider>
        <ThemeProvider value={navigationTheme}>
          <RootStack />
          <StatusBar style="auto" />
        </ThemeProvider>
      </SettingsProvider>
    </SQLiteProvider>
  );
}

function RootStack() {
  const { t } = useStrings();
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="transaction/new" options={{ presentation: 'modal', title: '' }} />
      <Stack.Screen name="transaction/[id]/index" options={{ title: t.tx.details }} />
      <Stack.Screen name="transaction/[id]/edit" options={{ presentation: 'modal', title: t.tx.edit }} />
      <Stack.Screen name="folder/[month]" options={{ title: '' }} />
      <Stack.Screen name="attachment/[id]" options={{ presentation: 'fullScreenModal', headerShown: false }} />
      <Stack.Screen name="categories" options={{ title: t.categories.title }} />
      <Stack.Screen name="export" options={{ title: t.export.title }} />
    </Stack>
  );
}
