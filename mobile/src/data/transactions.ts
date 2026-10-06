import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  CategoryTotal,
  Kind,
  MonthSummary,
  Transaction,
  TransactionInput,
  TransactionListItem,
} from '@/types';
import { monthKeyOf, nowISO } from '@/utils/dates';

import { notifyDataChanged } from './events';

const TX_COLUMNS = `t.id, t.kind, t.amount_cents AS amountCents, t.currency, t.occurred_on AS occurredOn, t.month,
  t.category_id AS categoryId, t.counterparty, t.note, t.payment_method AS paymentMethod,
  t.vat_cents AS vatCents, t.invoice_number AS invoiceNumber, t.created_at AS createdAt, t.updated_at AS updatedAt`;

const LIST_SELECT = `SELECT ${TX_COLUMNS},
  c.name AS categoryName, c.icon AS categoryIcon, c.color AS categoryColor, COALESCE(c.is_system, 0) AS categoryIsSystem,
  (SELECT COUNT(*) FROM attachments a WHERE a.transaction_id = t.id AND a.deleted_at IS NULL) AS attachmentCount,
  (SELECT a.relative_path FROM attachments a WHERE a.transaction_id = t.id AND a.deleted_at IS NULL
     ORDER BY a.created_at LIMIT 1) AS firstAttachmentPath
  FROM transactions t
  LEFT JOIN categories c ON c.id = t.category_id
  WHERE t.deleted_at IS NULL`;

type ListRow = Omit<TransactionListItem, 'categoryIsSystem'> & { categoryIsSystem: number };

function mapListRow(row: ListRow): TransactionListItem {
  return { ...row, categoryIsSystem: row.categoryIsSystem === 1 };
}

export async function listTransactionsByMonth(db: SQLiteDatabase, month: string): Promise<TransactionListItem[]> {
  const rows = await db.getAllAsync<ListRow>(
    `${LIST_SELECT} AND t.month = ? ORDER BY t.occurred_on DESC, t.created_at DESC`,
    [month],
  );
  return rows.map(mapListRow);
}

export async function listTransactionsByYear(db: SQLiteDatabase, year: number): Promise<TransactionListItem[]> {
  const rows = await db.getAllAsync<ListRow>(
    `${LIST_SELECT} AND t.month LIKE ? ORDER BY t.occurred_on ASC, t.created_at ASC`,
    [`${year}-%`],
  );
  return rows.map(mapListRow);
}

export async function listAllTransactions(db: SQLiteDatabase): Promise<TransactionListItem[]> {
  const rows = await db.getAllAsync<ListRow>(`${LIST_SELECT} ORDER BY t.occurred_on ASC, t.created_at ASC`);
  return rows.map(mapListRow);
}

export async function getTransaction(db: SQLiteDatabase, id: string): Promise<TransactionListItem | null> {
  const row = await db.getFirstAsync<ListRow>(`${LIST_SELECT} AND t.id = ?`, [id]);
  return row ? mapListRow(row) : null;
}

export async function getMonthSummary(db: SQLiteDatabase, month: string): Promise<MonthSummary> {
  const row = await db.getFirstAsync<Omit<MonthSummary, 'month'>>(
    `SELECT
       COALESCE(SUM(CASE WHEN kind = 'income' THEN amount_cents END), 0) AS incomeCents,
       COALESCE(SUM(CASE WHEN kind = 'expense' THEN amount_cents END), 0) AS expenseCents,
       COUNT(*) AS transactionCount,
       (SELECT COUNT(*) FROM attachments a JOIN transactions t2 ON t2.id = a.transaction_id
          WHERE a.deleted_at IS NULL AND t2.deleted_at IS NULL AND t2.month = ?) AS receiptCount
     FROM transactions WHERE deleted_at IS NULL AND month = ?`,
    [month, month],
  );
  return {
    month,
    incomeCents: row?.incomeCents ?? 0,
    expenseCents: row?.expenseCents ?? 0,
    transactionCount: row?.transactionCount ?? 0,
    receiptCount: row?.receiptCount ?? 0,
  };
}

/** One row per month that has entries, newest first. */
export async function listMonthSummaries(db: SQLiteDatabase): Promise<MonthSummary[]> {
  return db.getAllAsync<MonthSummary>(
    `SELECT t.month,
       COALESCE(SUM(CASE WHEN t.kind = 'income' THEN t.amount_cents END), 0) AS incomeCents,
       COALESCE(SUM(CASE WHEN t.kind = 'expense' THEN t.amount_cents END), 0) AS expenseCents,
       COUNT(*) AS transactionCount,
       (SELECT COUNT(*) FROM attachments a JOIN transactions t2 ON t2.id = a.transaction_id
          WHERE a.deleted_at IS NULL AND t2.deleted_at IS NULL AND t2.month = t.month) AS receiptCount
     FROM transactions t WHERE t.deleted_at IS NULL
     GROUP BY t.month ORDER BY t.month DESC`,
  );
}

export async function listMonthSummariesForYear(db: SQLiteDatabase, year: number): Promise<MonthSummary[]> {
  return db.getAllAsync<MonthSummary>(
    `SELECT t.month,
       COALESCE(SUM(CASE WHEN t.kind = 'income' THEN t.amount_cents END), 0) AS incomeCents,
       COALESCE(SUM(CASE WHEN t.kind = 'expense' THEN t.amount_cents END), 0) AS expenseCents,
       COUNT(*) AS transactionCount,
       0 AS receiptCount
     FROM transactions t WHERE t.deleted_at IS NULL AND t.month LIKE ?
     GROUP BY t.month ORDER BY t.month ASC`,
    [`${year}-%`],
  );
}

export async function listYearsWithData(db: SQLiteDatabase): Promise<number[]> {
  const rows = await db.getAllAsync<{ year: string }>(
    `SELECT DISTINCT substr(month, 1, 4) AS year FROM transactions WHERE deleted_at IS NULL ORDER BY year DESC`,
  );
  return rows.map((r) => Number(r.year));
}

export async function listCategoryTotals(
  db: SQLiteDatabase,
  period: { year: number; month?: string | null },
): Promise<CategoryTotal[]> {
  const where = period.month ? 't.month = ?' : 't.month LIKE ?';
  const param = period.month ?? `${period.year}-%`;
  const rows = await db.getAllAsync<Omit<CategoryTotal, 'isSystem'> & { isSystem: number }>(
    `SELECT t.category_id AS categoryId, c.name, c.icon, c.color, COALESCE(c.is_system, 0) AS isSystem, t.kind,
       SUM(t.amount_cents) AS totalCents, COUNT(*) AS count
     FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.deleted_at IS NULL AND ${where}
     GROUP BY t.category_id, t.kind
     ORDER BY totalCents DESC`,
    [param],
  );
  return rows.map((r) => ({ ...r, isSystem: r.isSystem === 1 }));
}

export async function listRecentCounterparties(db: SQLiteDatabase, kind: Kind, limit = 8): Promise<string[]> {
  const rows = await db.getAllAsync<{ counterparty: string }>(
    `SELECT counterparty, MAX(occurred_on) AS lastUsed FROM transactions
     WHERE deleted_at IS NULL AND kind = ? AND counterparty IS NOT NULL AND TRIM(counterparty) <> ''
     GROUP BY counterparty ORDER BY lastUsed DESC LIMIT ?`,
    [kind, limit],
  );
  return rows.map((r) => r.counterparty);
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Inserts a transaction. Does not notify listeners: callers wrap this in a DB transaction together with attachments and notify after. */
export async function insertTransaction(
  db: SQLiteDatabase,
  input: TransactionInput,
  id: string = Crypto.randomUUID(),
): Promise<Transaction> {
  const now = nowISO();
  const tx: Transaction = {
    id,
    kind: input.kind,
    amountCents: input.amountCents,
    currency: input.currency,
    occurredOn: input.occurredOn,
    month: monthKeyOf(input.occurredOn),
    categoryId: input.categoryId,
    counterparty: clean(input.counterparty),
    note: clean(input.note),
    paymentMethod: input.paymentMethod,
    vatCents: input.vatCents,
    invoiceNumber: clean(input.invoiceNumber),
    createdAt: now,
    updatedAt: now,
  };
  await db.runAsync(
    `INSERT INTO transactions (id, kind, amount_cents, currency, occurred_on, month, category_id, counterparty, note,
       payment_method, vat_cents, invoice_number, created_at, updated_at, sync_state)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local')`,
    [
      tx.id,
      tx.kind,
      tx.amountCents,
      tx.currency,
      tx.occurredOn,
      tx.month,
      tx.categoryId,
      tx.counterparty,
      tx.note,
      tx.paymentMethod,
      tx.vatCents,
      tx.invoiceNumber,
      tx.createdAt,
      tx.updatedAt,
    ],
  );
  return tx;
}

export async function updateTransaction(db: SQLiteDatabase, id: string, input: TransactionInput): Promise<void> {
  await db.runAsync(
    `UPDATE transactions SET kind = ?, amount_cents = ?, currency = ?, occurred_on = ?, month = ?, category_id = ?,
       counterparty = ?, note = ?, payment_method = ?, vat_cents = ?, invoice_number = ?, updated_at = ?,
       sync_state = CASE WHEN sync_state = 'synced' THEN 'dirty' ELSE sync_state END
     WHERE id = ?`,
    [
      input.kind,
      input.amountCents,
      input.currency,
      input.occurredOn,
      monthKeyOf(input.occurredOn),
      input.categoryId,
      clean(input.counterparty),
      clean(input.note),
      input.paymentMethod,
      input.vatCents,
      clean(input.invoiceNumber),
      nowISO(),
      id,
    ],
  );
}

/** Soft-deletes the transaction row and its attachment rows. Files are removed by the receipts service. */
export async function softDeleteTransaction(db: SQLiteDatabase, id: string): Promise<void> {
  const now = nowISO();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('UPDATE attachments SET deleted_at = ? WHERE transaction_id = ? AND deleted_at IS NULL', [now, id]);
    await txn.runAsync(
      `UPDATE transactions SET deleted_at = ?, updated_at = ?,
         sync_state = CASE WHEN sync_state = 'synced' THEN 'dirty' ELSE sync_state END WHERE id = ?`,
      [now, now, id],
    );
  });
  notifyDataChanged();
}

/** Used by backup restore: insert or overwrite a transaction keeping the given id and timestamps. */
export async function upsertTransactionRaw(
  db: SQLiteDatabase,
  tx: Transaction & { deletedAt?: string | null },
): Promise<void> {
  await db.runAsync(
    `INSERT INTO transactions (id, kind, amount_cents, currency, occurred_on, month, category_id, counterparty, note,
       payment_method, vat_cents, invoice_number, created_at, updated_at, deleted_at, sync_state)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local')
     ON CONFLICT(id) DO UPDATE SET
       kind = excluded.kind, amount_cents = excluded.amount_cents, currency = excluded.currency,
       occurred_on = excluded.occurred_on, month = excluded.month, category_id = excluded.category_id,
       counterparty = excluded.counterparty, note = excluded.note, payment_method = excluded.payment_method,
       vat_cents = excluded.vat_cents, invoice_number = excluded.invoice_number,
       updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
     WHERE excluded.updated_at >= transactions.updated_at`,
    [
      tx.id,
      tx.kind,
      tx.amountCents,
      tx.currency,
      tx.occurredOn,
      monthKeyOf(tx.occurredOn),
      tx.categoryId,
      tx.counterparty,
      tx.note,
      tx.paymentMethod,
      tx.vatCents,
      tx.invoiceNumber,
      tx.createdAt,
      tx.updatedAt,
      tx.deletedAt ?? null,
    ],
  );
}
