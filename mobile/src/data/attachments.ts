import type { SQLiteDatabase } from 'expo-sqlite';

import type { Attachment, MonthReceipt, PendingAttachment } from '@/types';
import { nowISO } from '@/utils/dates';

const ATTACHMENT_COLUMNS = `a.id, a.transaction_id AS transactionId, a.relative_path AS relativePath, a.mime_type AS mimeType,
  a.width, a.height, a.size_bytes AS sizeBytes, a.created_at AS createdAt`;

export async function listAttachments(db: SQLiteDatabase, transactionId: string): Promise<Attachment[]> {
  return db.getAllAsync<Attachment>(
    `SELECT ${ATTACHMENT_COLUMNS} FROM attachments a
     WHERE a.transaction_id = ? AND a.deleted_at IS NULL ORDER BY a.created_at`,
    [transactionId],
  );
}

export async function listAllAttachments(db: SQLiteDatabase): Promise<Attachment[]> {
  return db.getAllAsync<Attachment>(
    `SELECT ${ATTACHMENT_COLUMNS} FROM attachments a JOIN transactions t ON t.id = a.transaction_id
     WHERE a.deleted_at IS NULL AND t.deleted_at IS NULL ORDER BY a.created_at`,
  );
}

export async function getAttachment(db: SQLiteDatabase, id: string): Promise<MonthReceipt | null> {
  const row = await db.getFirstAsync<Omit<MonthReceipt, 'categoryIsSystem'> & { categoryIsSystem: number }>(
    `SELECT ${ATTACHMENT_COLUMNS}, t.kind, t.amount_cents AS amountCents, t.currency, t.occurred_on AS occurredOn,
       t.counterparty, c.name AS categoryName, COALESCE(c.is_system, 0) AS categoryIsSystem
     FROM attachments a
     JOIN transactions t ON t.id = a.transaction_id
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE a.id = ? AND a.deleted_at IS NULL`,
    [id],
  );
  return row ? { ...row, categoryIsSystem: row.categoryIsSystem === 1 } : null;
}

/** All receipt photos whose entry falls in the given month (or year when `period` is a 4-digit year). */
export async function listReceiptsForPeriod(db: SQLiteDatabase, period: string): Promise<MonthReceipt[]> {
  const where = period.length === 4 ? 't.month LIKE ?' : 't.month = ?';
  const param = period.length === 4 ? `${period}-%` : period;
  const rows = await db.getAllAsync<Omit<MonthReceipt, 'categoryIsSystem'> & { categoryIsSystem: number }>(
    `SELECT ${ATTACHMENT_COLUMNS}, t.kind, t.amount_cents AS amountCents, t.currency, t.occurred_on AS occurredOn,
       t.counterparty, c.name AS categoryName, COALESCE(c.is_system, 0) AS categoryIsSystem
     FROM attachments a
     JOIN transactions t ON t.id = a.transaction_id
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE a.deleted_at IS NULL AND t.deleted_at IS NULL AND ${where}
     ORDER BY t.occurred_on DESC, a.created_at DESC`,
    [param],
  );
  return rows.map((r) => ({ ...r, categoryIsSystem: r.categoryIsSystem === 1 }));
}

export async function insertAttachment(
  db: SQLiteDatabase,
  transactionId: string,
  pending: PendingAttachment,
  relativePath: string,
): Promise<Attachment> {
  const attachment: Attachment = {
    id: pending.id,
    transactionId,
    relativePath,
    mimeType: pending.mimeType,
    width: pending.width,
    height: pending.height,
    sizeBytes: pending.sizeBytes,
    createdAt: nowISO(),
  };
  await db.runAsync(
    `INSERT INTO attachments (id, transaction_id, relative_path, mime_type, width, height, size_bytes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      attachment.id,
      attachment.transactionId,
      attachment.relativePath,
      attachment.mimeType,
      attachment.width,
      attachment.height,
      attachment.sizeBytes,
      attachment.createdAt,
    ],
  );
  return attachment;
}

export async function updateAttachmentPath(db: SQLiteDatabase, id: string, relativePath: string): Promise<void> {
  await db.runAsync('UPDATE attachments SET relative_path = ? WHERE id = ?', [relativePath, id]);
}

export async function softDeleteAttachment(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('UPDATE attachments SET deleted_at = ? WHERE id = ?', [nowISO(), id]);
}

/** Used by backup restore. */
export async function upsertAttachmentRaw(db: SQLiteDatabase, attachment: Attachment): Promise<void> {
  await db.runAsync(
    `INSERT INTO attachments (id, transaction_id, relative_path, mime_type, width, height, size_bytes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET relative_path = excluded.relative_path, deleted_at = NULL`,
    [
      attachment.id,
      attachment.transactionId,
      attachment.relativePath,
      attachment.mimeType,
      attachment.width,
      attachment.height,
      attachment.sizeBytes,
      attachment.createdAt,
    ],
  );
}

export async function totalAttachmentBytes(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ total: number | null }>(
    'SELECT SUM(size_bytes) AS total FROM attachments WHERE deleted_at IS NULL',
  );
  return row?.total ?? 0;
}
