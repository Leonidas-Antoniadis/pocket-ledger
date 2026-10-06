import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { Category, Kind } from '@/types';
import { nowISO } from '@/utils/dates';

import { notifyDataChanged } from './events';

interface CategoryRow {
  id: string;
  name: string;
  kind: Kind;
  icon: string;
  color: string;
  sortOrder: number;
  isSystem: number;
  isArchived: number;
}

const SELECT = `SELECT id, name, kind, icon, color, sort_order AS sortOrder, is_system AS isSystem, is_archived AS isArchived
  FROM categories WHERE deleted_at IS NULL`;

function mapRow(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    icon: row.icon,
    color: row.color,
    sortOrder: row.sortOrder,
    isSystem: row.isSystem === 1,
    isArchived: row.isArchived === 1,
  };
}

export async function listCategories(
  db: SQLiteDatabase,
  options: { kind?: Kind; includeArchived?: boolean } = {},
): Promise<Category[]> {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (options.kind) {
    clauses.push('AND kind = ?');
    params.push(options.kind);
  }
  if (!options.includeArchived) {
    clauses.push('AND is_archived = 0');
  }
  const rows = await db.getAllAsync<CategoryRow>(
    `${SELECT} ${clauses.join(' ')} ORDER BY kind, sort_order, name`,
    params,
  );
  return rows.map(mapRow);
}

export async function getCategory(db: SQLiteDatabase, id: string): Promise<Category | null> {
  const row = await db.getFirstAsync<CategoryRow>(`${SELECT} AND id = ?`, [id]);
  return row ? mapRow(row) : null;
}

export async function createCategory(
  db: SQLiteDatabase,
  input: { name: string; kind: Kind; icon: string; color: string },
): Promise<Category> {
  const now = nowISO();
  const id = Crypto.randomUUID();
  const maxRow = await db.getFirstAsync<{ maxOrder: number | null }>(
    'SELECT MAX(sort_order) AS maxOrder FROM categories WHERE kind = ?',
    [input.kind],
  );
  const sortOrder = (maxRow?.maxOrder ?? 0) + 1;
  await db.runAsync(
    `INSERT INTO categories (id, name, kind, icon, color, sort_order, is_system, is_archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
    [id, input.name.trim(), input.kind, input.icon, input.color, sortOrder, now, now],
  );
  notifyDataChanged();
  return {
    id,
    name: input.name.trim(),
    kind: input.kind,
    icon: input.icon,
    color: input.color,
    sortOrder,
    isSystem: false,
    isArchived: false,
  };
}

export async function updateCategory(
  db: SQLiteDatabase,
  id: string,
  input: { name: string; icon: string; color: string },
): Promise<void> {
  await db.runAsync(
    'UPDATE categories SET name = ?, icon = ?, color = ?, is_system = 0, updated_at = ? WHERE id = ?',
    [input.name.trim(), input.icon, input.color, nowISO(), id],
  );
  notifyDataChanged();
}

export async function setCategoryArchived(db: SQLiteDatabase, id: string, archived: boolean): Promise<void> {
  await db.runAsync('UPDATE categories SET is_archived = ?, updated_at = ? WHERE id = ?', [
    archived ? 1 : 0,
    nowISO(),
    id,
  ]);
  notifyDataChanged();
}

export async function categoryUsageCount(db: SQLiteDatabase, id: string): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM transactions WHERE category_id = ? AND deleted_at IS NULL',
    [id],
  );
  return row?.count ?? 0;
}

/** Full category row as stored, used by backup/restore. */
export interface RawCategory extends Category {
  createdAt: string;
  updatedAt: string;
}

export async function listCategoriesRaw(db: SQLiteDatabase): Promise<RawCategory[]> {
  const rows = await db.getAllAsync<CategoryRow & { createdAt: string; updatedAt: string }>(
    `SELECT id, name, kind, icon, color, sort_order AS sortOrder, is_system AS isSystem, is_archived AS isArchived,
       created_at AS createdAt, updated_at AS updatedAt
     FROM categories WHERE deleted_at IS NULL ORDER BY kind, sort_order`,
  );
  return rows.map((row) => ({ ...mapRow(row), createdAt: row.createdAt, updatedAt: row.updatedAt }));
}

export async function upsertCategoryRaw(db: SQLiteDatabase, category: RawCategory): Promise<void> {
  await db.runAsync(
    `INSERT INTO categories (id, name, kind, icon, color, sort_order, is_system, is_archived, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, icon = excluded.icon, color = excluded.color, sort_order = excluded.sort_order,
       is_system = excluded.is_system, is_archived = excluded.is_archived, updated_at = excluded.updated_at, deleted_at = NULL
     WHERE excluded.updated_at >= categories.updated_at`,
    [
      category.id,
      category.name,
      category.kind,
      category.icon,
      category.color,
      category.sortOrder,
      category.isSystem ? 1 : 0,
      category.isArchived ? 1 : 0,
      category.createdAt,
      category.updatedAt,
    ],
  );
}

/** Soft-deletes a category. Returns false (and does nothing) when entries still use it. */
export async function deleteCategory(db: SQLiteDatabase, id: string): Promise<boolean> {
  const inUse = await categoryUsageCount(db, id);
  if (inUse > 0) return false;
  const now = nowISO();
  await db.runAsync('UPDATE categories SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
  notifyDataChanged();
  return true;
}
