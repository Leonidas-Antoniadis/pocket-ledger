import { getLocales } from 'expo-localization';

import type { Language } from '@/types';

import { el } from './el';
import { en, type Strings } from './en';

export type { Strings };

export const LANGUAGES: Language[] = ['en', 'el'];

export const strings: Record<Language, Strings> = { en, el };

export function localeFor(language: Language): string {
  return language === 'el' ? 'el-GR' : 'en-GB';
}

export function detectLanguage(): Language {
  const code = getLocales()[0]?.languageCode;
  return code === 'el' ? 'el' : 'en';
}

export function detectCurrency(): string {
  const code = getLocales()[0]?.currencyCode;
  return code && /^[A-Z]{3}$/.test(code) ? code : 'EUR';
}

/** System categories store a translation key as their name; custom ones store the literal name. */
export function categoryDisplayName(
  category: { name: string | null; isSystem: boolean } | null | undefined,
  s: Strings,
): string {
  if (!category || !category.name) return s.tx.noCategory;
  if (category.isSystem) return s.categoryNames[category.name] ?? category.name;
  return category.name;
}
