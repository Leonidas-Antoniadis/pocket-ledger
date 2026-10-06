import type { SQLiteDatabase } from 'expo-sqlite';

import { nowISO } from '@/utils/dates';

import { DEFAULT_CATEGORIES } from './seed';
import { runInTransaction } from './transaction';

export const DATABASE_NAME = 'pocket-ledger.db';

const LATEST_VERSION = 1;

/**
 * Schema notes (kept sync-friendly for the planned .NET API + SQL Server backend):
 *  - every row has a client-generated string id (UUID or stable "sys:" id), created_at / updated_at,
 *    and a nullable deleted_at tombstone instead of hard deletes;
 *  - transactions.sync_state tracks what still has to be pushed ('local' = never synced, 'dirty' = changed, 'synced').
 */
const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_system INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  occurred_on TEXT NOT NULL,
  month TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id),
  counterparty TEXT,
  note TEXT,
  payment_method TEXT,
  vat_cents INTEGER,
  invoice_number TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_state TEXT NOT NULL DEFAULT 'local'
);
CREATE INDEX IF NOT EXISTS idx_transactions_month ON transactions(month);
CREATE INDEX IF NOT EXISTS idx_transactions_occurred_on ON transactions(occurred_on);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY NOT NULL,
  transaction_id TEXT NOT NULL REFERENCES transactions(id),
  relative_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  size_bytes INTEGER,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_attachments_transaction ON attachments(transaction_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;

export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  if (version < 1) {
    await db.execAsync(SCHEMA_V1);
    await seedDefaultCategories(db);
    version = 1;
  }

  // Future migrations go here: if (version < 2) { ... version = 2; }

  if (version !== LATEST_VERSION) {
    await db.execAsync(`PRAGMA user_version = ${LATEST_VERSION}`);
  } else if ((row?.user_version ?? 0) !== LATEST_VERSION) {
    await db.execAsync(`PRAGMA user_version = ${LATEST_VERSION}`);
  }
}

export async function seedDefaultCategories(db: SQLiteDatabase): Promise<void> {
  const now = nowISO();
  const statement = await db.prepareAsync(
    `INSERT OR IGNORE INTO categories (id, name, kind, icon, color, sort_order, is_system, is_archived, created_at, updated_at)
     VALUES ($id, $name, $kind, $icon, $color, $sortOrder, 1, 0, $now, $now)`,
  );
  try {
    for (const [index, category] of DEFAULT_CATEGORIES.entries()) {
      await statement.executeAsync({
        $id: category.id,
        $name: category.name,
        $kind: category.kind,
        $icon: category.icon,
        $color: category.color,
        $sortOrder: index,
        $now: now,
      });
    }
  } finally {
    await statement.finalizeAsync();
  }
}

/** Removes every row. Used by "Delete all data" (files are removed separately by the receipt-files service). */
export async function wipeAllData(db: SQLiteDatabase): Promise<void> {
  await runInTransaction(db, async (txn) => {
    await txn.execAsync('DELETE FROM attachments; DELETE FROM transactions; DELETE FROM categories; DELETE FROM settings;');
  });
  await seedDefaultCategories(db);
}
