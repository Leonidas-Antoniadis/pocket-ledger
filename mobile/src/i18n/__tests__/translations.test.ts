import { CATEGORY_ICONS, DEFAULT_CATEGORIES } from '@/db/seed';

import { el } from '../el';
import { en } from '../en';

function leafPaths(value: unknown, prefix = ''): string[] {
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      leafPaths(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

describe('translations', () => {
  it('Greek has exactly the same keys as English', () => {
    expect(leafPaths(el).sort()).toEqual(leafPaths(en).sort());
  });

  it('no Greek string is left untranslated except proper nouns and language names', () => {
    const skip = new Set(['settings.languages.en', 'settings.languages.el', 'common.ok']);
    const enLeaves = Object.fromEntries(leafPaths(en).map((path) => [path, path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], en)]));
    const elLeaves = Object.fromEntries(leafPaths(el).map((path) => [path, path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], el)]));
    const identical = Object.keys(enLeaves).filter(
      (path) => typeof enLeaves[path] === 'string' && enLeaves[path] === elLeaves[path] && !skip.has(path),
    );
    expect(identical).toEqual([]);
  });

  it('pluralising functions produce text', () => {
    expect(en.home.receipts(1)).toBe('1 receipt');
    expect(en.home.receipts(3)).toBe('3 receipts');
    expect(el.home.entries(1)).toContain('1');
    expect(el.export.restoreDone(5)).toContain('5');
  });
});

describe('default categories', () => {
  it('have unique stable ids and a translation in both languages', () => {
    const ids = DEFAULT_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const category of DEFAULT_CATEGORIES) {
      expect(category.id.startsWith('sys:')).toBe(true);
      expect(en.categoryNames[category.name]).toBeTruthy();
      expect(el.categoryNames[category.name]).toBeTruthy();
    }
  });

  it('only use icons that the category editor offers', () => {
    const offered = new Set<string>(CATEGORY_ICONS);
    for (const category of DEFAULT_CATEGORIES) {
      expect(offered.has(category.icon)).toBe(true);
    }
  });

  it('cover both kinds', () => {
    expect(DEFAULT_CATEGORIES.some((c) => c.kind === 'expense')).toBe(true);
    expect(DEFAULT_CATEGORIES.some((c) => c.kind === 'income')).toBe(true);
  });
});
