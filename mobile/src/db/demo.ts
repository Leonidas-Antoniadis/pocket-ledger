import { Asset } from 'expo-asset';
import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { insertAttachment } from '@/data/attachments';
import { notifyDataChanged } from '@/data/events';
import { insertTransaction } from '@/data/transactions';
import { runInTransaction } from '@/db/transaction';
import { importFileToPath, RECEIPTS_DIR } from '@/services/receipt-files';
import type { Kind, PaymentMethod, TransactionInput } from '@/types';
import { monthKeyOf, toISODate } from '@/utils/dates';

/**
 * Sample data for trying the app (dev builds only; see the "Load demo data" row in Settings).
 * The receipt pictures are rendered by scripts/make-demo-receipts.mjs.
 */
const DEMO_RECEIPTS = {
  fuel: require('@/assets/demo/receipt-fuel.jpg'),
  phone: require('@/assets/demo/receipt-phone.jpg'),
  repair: require('@/assets/demo/receipt-repair.jpg'),
  parking: require('@/assets/demo/receipt-parking.jpg'),
  bag: require('@/assets/demo/receipt-bag.jpg'),
  insurance: require('@/assets/demo/receipt-insurance.jpg'),
} as const;

type ReceiptKey = keyof typeof DEMO_RECEIPTS;

interface DemoEntry {
  daysAgo: number;
  kind: Kind;
  amount: number;
  category: string;
  counterparty: string;
  payment?: PaymentMethod;
  note?: string;
  invoice?: string;
  vat?: number;
  receipt?: ReceiptKey;
}

const ENTRIES: DemoEntry[] = [
  // current month
  { daysAgo: 1, kind: 'income', amount: 412.6, category: 'delivery_earnings', counterparty: 'Wolt', payment: 'bank', note: 'Weekly payout' },
  { daysAgo: 1, kind: 'income', amount: 23.5, category: 'tips', counterparty: 'Wolt', payment: 'bank' },
  { daysAgo: 2, kind: 'expense', amount: 67.97, category: 'fuel', counterparty: 'Shell', payment: 'card', receipt: 'fuel', vat: 13.15 },
  { daysAgo: 3, kind: 'expense', amount: 4.5, category: 'parking_tolls', counterparty: 'Municipal parking', payment: 'card', receipt: 'parking' },
  { daysAgo: 4, kind: 'expense', amount: 33.59, category: 'phone_internet', counterparty: 'Vodafone', payment: 'bank', receipt: 'phone', invoice: 'INV 2026-09-118823', vat: 6.5 },
  { daysAgo: 5, kind: 'expense', amount: 114.0, category: 'insurance', counterparty: 'Insurance Co.', payment: 'bank', receipt: 'insurance', invoice: '2026/4410', note: '6-month liability + roadside' },
  { daysAgo: 6, kind: 'expense', amount: 8.9, category: 'meals', counterparty: 'Bakery', payment: 'cash' },
  { daysAgo: 8, kind: 'income', amount: 388.2, category: 'delivery_earnings', counterparty: 'Wolt', payment: 'bank', note: 'Weekly payout' },
  { daysAgo: 9, kind: 'expense', amount: 42.1, category: 'fuel', counterparty: 'BP', payment: 'card' },
  { daysAgo: 11, kind: 'income', amount: 40.0, category: 'bonus', counterparty: 'Wolt', payment: 'bank', note: 'Rainy-day bonus' },
  // previous month
  { daysAgo: 16, kind: 'income', amount: 401.3, category: 'delivery_earnings', counterparty: 'Wolt', payment: 'bank', note: 'Weekly payout' },
  { daysAgo: 17, kind: 'expense', amount: 65.1, category: 'vehicle_maintenance', counterparty: 'Moto Service Nikos', payment: 'cash', receipt: 'repair', invoice: 'ΤΠΥ 000912', vat: 12.6 },
  { daysAgo: 19, kind: 'expense', amount: 58.3, category: 'equipment', counterparty: 'Courier Gear Store', payment: 'card', receipt: 'bag', invoice: '55012', note: 'Thermal bag + phone holder' },
  { daysAgo: 21, kind: 'expense', amount: 55.4, category: 'fuel', counterparty: 'Shell', payment: 'card' },
  { daysAgo: 23, kind: 'income', amount: 18.0, category: 'tips', counterparty: 'Wolt', payment: 'bank' },
  { daysAgo: 24, kind: 'income', amount: 395.75, category: 'delivery_earnings', counterparty: 'Wolt', payment: 'bank', note: 'Weekly payout' },
  { daysAgo: 27, kind: 'expense', amount: 12.4, category: 'meals', counterparty: 'Souvlaki corner', payment: 'cash' },
  { daysAgo: 30, kind: 'expense', amount: 60.0, category: 'accounting', counterparty: 'Accountant', payment: 'bank', note: 'Monthly fee' },
  { daysAgo: 33, kind: 'income', amount: 379.9, category: 'delivery_earnings', counterparty: 'Wolt', payment: 'bank', note: 'Weekly payout' },
  { daysAgo: 36, kind: 'expense', amount: 49.8, category: 'fuel', counterparty: 'EKO', payment: 'card' },
  // two months ago
  { daysAgo: 47, kind: 'income', amount: 410.0, category: 'delivery_earnings', counterparty: 'Wolt', payment: 'bank', note: 'Weekly payout' },
  { daysAgo: 49, kind: 'expense', amount: 33.59, category: 'phone_internet', counterparty: 'Vodafone', payment: 'bank' },
  { daysAgo: 52, kind: 'expense', amount: 51.2, category: 'fuel', counterparty: 'Shell', payment: 'card' },
  { daysAgo: 55, kind: 'income', amount: 366.4, category: 'delivery_earnings', counterparty: 'Wolt', payment: 'bank', note: 'Weekly payout' },
  { daysAgo: 58, kind: 'expense', amount: 7.5, category: 'parking_tolls', counterparty: 'Attiki Odos', payment: 'card' },
  { daysAgo: 61, kind: 'expense', amount: 60.0, category: 'accounting', counterparty: 'Accountant', payment: 'bank', note: 'Monthly fee' },
];

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** Inserts the demo entries (with receipt photos where available). Returns how many entries were added. */
export async function loadDemoData(db: SQLiteDatabase, currency: string): Promise<number> {
  const today = new Date();
  const prepared: { id: string; input: TransactionInput; receipt?: ReceiptKey }[] = ENTRIES.map((entry) => {
    const date = new Date(today);
    date.setDate(today.getDate() - entry.daysAgo);
    return {
      id: Crypto.randomUUID(),
      receipt: entry.receipt,
      input: {
        kind: entry.kind,
        amountCents: toCents(entry.amount),
        currency,
        occurredOn: toISODate(date),
        categoryId: `sys:${entry.category}`,
        counterparty: entry.counterparty,
        note: entry.note ?? null,
        paymentMethod: entry.payment ?? null,
        vatCents: entry.vat != null ? toCents(entry.vat) : null,
        invoiceNumber: entry.invoice ?? null,
      },
    };
  });

  // Copy the sample pictures into the right monthly folders first (file work stays outside the DB transaction).
  const photos: { transactionId: string; attachmentId: string; relativePath: string; sizeBytes: number | null }[] = [];
  for (const item of prepared) {
    if (!item.receipt) continue;
    const asset = Asset.fromModule(DEMO_RECEIPTS[item.receipt]);
    await asset.downloadAsync();
    const sourceUri = asset.localUri ?? asset.uri;
    const attachmentId = Crypto.randomUUID();
    const relativePath = `${RECEIPTS_DIR}/${monthKeyOf(item.input.occurredOn)}/${attachmentId}.jpg`;
    const sizeBytes = await importFileToPath(sourceUri, relativePath);
    photos.push({ transactionId: item.id, attachmentId, relativePath, sizeBytes });
  }

  await runInTransaction(db, async (txn) => {
    for (const item of prepared) {
      await insertTransaction(txn, item.input, item.id);
    }
    for (const photo of photos) {
      await insertAttachment(
        txn,
        photo.transactionId,
        { id: photo.attachmentId, relativePath: photo.relativePath, mimeType: 'image/jpeg', width: null, height: null, sizeBytes: photo.sizeBytes },
        photo.relativePath,
      );
    }
  });

  notifyDataChanged();
  return prepared.length;
}
