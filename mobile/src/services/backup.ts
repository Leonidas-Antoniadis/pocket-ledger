import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import type { SQLiteDatabase } from 'expo-sqlite';
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';

import { listAllAttachments, upsertAttachmentRaw } from '@/data/attachments';
import { listCategoriesRaw, upsertCategoryRaw, type RawCategory } from '@/data/categories';
import { notifyDataChanged } from '@/data/events';
import { getAllSettings } from '@/data/settings';
import { listAllTransactions, upsertTransactionRaw } from '@/data/transactions';
import { runInTransaction } from '@/db/transaction';
import type { Strings } from '@/i18n';
import type { Attachment, Transaction } from '@/types';
import { fileTimestamp, nowISO } from '@/utils/dates';

import { shareFile } from './export';
import { readFileBytes, readUriBytes, writeExportBytes, writeFileBytes } from './receipt-files';

const BACKUP_APP = 'pocket-ledger';
const BACKUP_FORMAT = 1;

interface BackupManifest {
  app: string;
  format: number;
  createdAt: string;
  appVersion: string | null;
  counts: { categories: number; transactions: number; attachments: number };
}

interface BackupData {
  categories: RawCategory[];
  transactions: Transaction[];
  attachments: Attachment[];
  settings: Record<string, string>;
}

/**
 * Backup ZIP layout:
 *   manifest.json                 app id, format version, counts
 *   data.json                     categories, entries, attachment rows, settings
 *   receipts/<YYYY-MM>/<id>.jpg   the photos, same relative paths as on the phone
 */
export async function createBackup(db: SQLiteDatabase, t: Strings): Promise<void> {
  const [categories, transactions, attachments, settings] = await Promise.all([
    listCategoriesRaw(db),
    listAllTransactions(db),
    listAllAttachments(db),
    getAllSettings(db),
  ]);

  const entries: Zippable = {};
  const includedAttachments: Attachment[] = [];
  for (const attachment of attachments) {
    const bytes = await readFileBytes(attachment.relativePath);
    if (!bytes) continue;
    entries[attachment.relativePath] = [bytes, { level: 0 }];
    includedAttachments.push(attachment);
  }

  const data: BackupData = {
    categories,
    transactions: transactions.map(stripListFields),
    attachments: includedAttachments,
    settings,
  };
  const manifest: BackupManifest = {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    createdAt: nowISO(),
    appVersion: Constants.expoConfig?.version ?? null,
    counts: {
      categories: categories.length,
      transactions: data.transactions.length,
      attachments: includedAttachments.length,
    },
  };
  entries['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
  entries['data.json'] = strToU8(JSON.stringify(data));

  const zipped = zipSync(entries);
  const file = writeExportBytes(`PocketLedger_backup_${fileTimestamp()}.zip`, zipped, 'application/zip');
  await shareFile(file, t.export.backup, t);
}

function stripListFields(tx: Transaction): Transaction {
  return {
    id: tx.id,
    kind: tx.kind,
    amountCents: tx.amountCents,
    currency: tx.currency,
    occurredOn: tx.occurredOn,
    month: tx.month,
    categoryId: tx.categoryId,
    counterparty: tx.counterparty,
    note: tx.note,
    paymentMethod: tx.paymentMethod,
    vatCents: tx.vatCents,
    invoiceNumber: tx.invoiceNumber,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
  };
}

export class InvalidBackupError extends Error {}

/** Lets the user pick a backup ZIP. Resolves to null when they cancel, otherwise the number of entries restored. */
export async function pickAndRestoreBackup(db: SQLiteDatabase): Promise<number | null> {
  const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (picked.canceled || !picked.assets[0]) return null;
  return restoreBackupFromUri(db, picked.assets[0].uri);
}

export async function restoreBackupFromUri(db: SQLiteDatabase, uri: string): Promise<number> {
  const bytes = await readUriBytes(uri);
  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(bytes);
  } catch {
    throw new InvalidBackupError('not a zip');
  }

  const manifestBytes = unzipped['manifest.json'];
  const dataBytes = unzipped['data.json'];
  if (!manifestBytes || !dataBytes) throw new InvalidBackupError('missing manifest');

  let manifest: BackupManifest;
  let data: BackupData;
  try {
    manifest = JSON.parse(strFromU8(manifestBytes)) as BackupManifest;
    data = JSON.parse(strFromU8(dataBytes)) as BackupData;
  } catch {
    throw new InvalidBackupError('corrupt json');
  }
  if (manifest.app !== BACKUP_APP || manifest.format > BACKUP_FORMAT) throw new InvalidBackupError('wrong app/format');
  if (!Array.isArray(data.transactions) || !Array.isArray(data.categories)) throw new InvalidBackupError('bad data');

  const attachments = (data.attachments ?? []).filter((a) => unzipped[a.relativePath] !== undefined);

  await runInTransaction(db, async (txn) => {
    for (const category of data.categories) await upsertCategoryRaw(txn, category);
    for (const tx of data.transactions) await upsertTransactionRaw(txn, tx);
    for (const attachment of attachments) await upsertAttachmentRaw(txn, attachment);
  });

  for (const attachment of attachments) {
    const fileBytes = unzipped[attachment.relativePath];
    if (fileBytes) await writeFileBytes(attachment.relativePath, fileBytes);
  }

  notifyDataChanged();
  return data.transactions.length;
}
