import type { SQLiteDatabase } from 'expo-sqlite';

import {
  insertAttachment,
  listAttachments,
  softDeleteAttachment,
  updateAttachmentPath,
} from '@/data/attachments';
import { notifyDataChanged } from '@/data/events';
import { insertTransaction, softDeleteTransaction, updateTransaction } from '@/data/transactions';
import { wipeAllData } from '@/db/database';
import type { PendingAttachment, TransactionInput } from '@/types';
import { monthKeyOf } from '@/utils/dates';

import {
  commitPendingAttachment,
  deleteAllReceiptFiles,
  deleteFile,
  moveAttachmentToMonth,
} from './receipt-files';

/**
 * Orchestrates database rows + photo files for an entry. Files are moved first; if the database write
 * then fails we remove the moved files so nothing is left orphaned.
 */
export async function createEntry(
  db: SQLiteDatabase,
  input: TransactionInput,
  newPhotos: PendingAttachment[],
): Promise<string> {
  const month = monthKeyOf(input.occurredOn);
  const committed: { pending: PendingAttachment; path: string }[] = [];
  for (const pending of newPhotos) {
    committed.push({ pending, path: await commitPendingAttachment(pending, month) });
  }

  try {
    let id = '';
    await db.withExclusiveTransactionAsync(async (txn) => {
      const tx = await insertTransaction(txn, input);
      id = tx.id;
      for (const item of committed) {
        await insertAttachment(txn, id, item.pending, item.path);
      }
    });
    notifyDataChanged();
    return id;
  } catch (error) {
    for (const item of committed) deleteFile(item.path);
    throw error;
  }
}

export async function updateEntry(
  db: SQLiteDatabase,
  id: string,
  input: TransactionInput,
  newPhotos: PendingAttachment[],
  removedAttachmentIds: string[],
): Promise<void> {
  const month = monthKeyOf(input.occurredOn);
  const existing = await listAttachments(db, id);
  const removed = new Set(removedAttachmentIds);

  const committed: { pending: PendingAttachment; path: string }[] = [];
  for (const pending of newPhotos) {
    committed.push({ pending, path: await commitPendingAttachment(pending, month) });
  }

  const moves: { id: string; path: string }[] = [];
  for (const attachment of existing) {
    if (removed.has(attachment.id)) continue;
    const newPath = await moveAttachmentToMonth(attachment.relativePath, month);
    if (newPath !== attachment.relativePath) moves.push({ id: attachment.id, path: newPath });
  }

  await db.withExclusiveTransactionAsync(async (txn) => {
    await updateTransaction(txn, id, input);
    for (const move of moves) await updateAttachmentPath(txn, move.id, move.path);
    for (const removedId of removed) await softDeleteAttachment(txn, removedId);
    for (const item of committed) await insertAttachment(txn, id, item.pending, item.path);
  });

  for (const attachment of existing) {
    if (removed.has(attachment.id)) deleteFile(attachment.relativePath);
  }
  notifyDataChanged();
}

export async function deleteEntry(db: SQLiteDatabase, id: string): Promise<void> {
  const attachments = await listAttachments(db, id);
  await softDeleteTransaction(db, id);
  for (const attachment of attachments) deleteFile(attachment.relativePath);
}

export async function deleteAllData(db: SQLiteDatabase): Promise<void> {
  await wipeAllData(db);
  deleteAllReceiptFiles();
  notifyDataChanged();
}
