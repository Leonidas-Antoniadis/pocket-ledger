import * as SplashScreen from 'expo-splash-screen';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getAllSettings, setSetting } from '@/data/settings';
import { detectCurrency, detectLanguage, localeFor, strings, type Strings } from '@/i18n';
import type { AppSettings, Language } from '@/types';

interface SettingsContextValue {
  settings: AppSettings;
  strings: Strings;
  locale: string;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function isLanguage(value: string | undefined): value is Language {
  return value === 'en' || value === 'el';
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAllSettings(db)
      .then((raw) => {
        if (cancelled) return;
        setSettings({
          currency: raw.currency ?? detectCurrency(),
          language: isLanguage(raw.language) ? raw.language : detectLanguage(),
          profileName: raw.profileName ?? '',
        });
      })
      .catch(() => {
        if (cancelled) return;
        setSettings({ currency: 'EUR', language: 'en', profileName: '' });
      })
      .finally(() => {
        SplashScreen.hideAsync().catch(() => undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [db]);

  const updateSettings = useCallback(
    async (partial: Partial<AppSettings>) => {
      setSettings((prev) => (prev ? { ...prev, ...partial } : prev));
      for (const [key, value] of Object.entries(partial)) {
        if (value !== undefined) await setSetting(db, key, String(value));
      }
    },
    [db],
  );

  const value = useMemo<SettingsContextValue | null>(() => {
    if (!settings) return null;
    return {
      settings,
      strings: strings[settings.language],
      locale: localeFor(settings.language),
      updateSettings,
    };
  }, [settings, updateSettings]);

  if (!value) return null;
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}

/** Convenience: translated strings, locale and currency in one call. */
export function useStrings() {
  const { strings: t, locale, settings } = useSettings();
  return { t, locale, currency: settings.currency, language: settings.language };
}
