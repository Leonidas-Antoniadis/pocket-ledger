import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';
import { strToU8, zipSync, type Zippable } from 'fflate';

import { listReceiptsForPeriod } from '@/data/attachments';
import { listTransactionsByMonth, listTransactionsByYear } from '@/data/transactions';
import { categoryDisplayName, type Strings } from '@/i18n';
import type { MonthReceipt, TransactionListItem } from '@/types';
import { toCsv } from '@/utils/csv';
import { formatDate, formatDateTime, formatMonth, nowISO } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { exportsDirectory, readFileBytes, renderBase64Jpeg, writeExportBytes, writeExportText } from './receipt-files';

export type Period = { type: 'month'; month: string } | { type: 'year'; year: number };

export interface ExportContext {
  t: Strings;
  locale: string;
  currency: string;
  profileName: string;
}

export type ExportOutcome = 'done' | 'empty';

export function periodKey(period: Period): string {
  return period.type === 'month' ? period.month : String(period.year);
}

export function periodLabel(period: Period, locale: string): string {
  return period.type === 'month' ? formatMonth(period.month, locale) : String(period.year);
}

function fileStem(period: Period): string {
  return `PocketLedger_${periodKey(period)}`;
}

export async function shareFile(file: File, mimeType: string, dialogTitle: string, t: Strings): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(t.export.shareUnavailable);
  }
  const uti = mimeType === 'application/pdf' ? 'com.adobe.pdf' : mimeType === 'text/csv' ? 'public.comma-separated-values-text' : 'public.zip-archive';
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle, UTI: uti });
}

async function loadPeriod(db: SQLiteDatabase, period: Period) {
  const unsorted =
    period.type === 'month' ? await listTransactionsByMonth(db, period.month) : await listTransactionsByYear(db, period.year);
  const transactions = [...unsorted].sort(
    (a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.createdAt.localeCompare(b.createdAt),
  );
  const receipts = await listReceiptsForPeriod(db, periodKey(period));
  const receiptsByTransaction = new Map<string, MonthReceipt[]>();
  for (const receipt of receipts) {
    const list = receiptsByTransaction.get(receipt.transactionId) ?? [];
    list.push(receipt);
    receiptsByTransaction.set(receipt.transactionId, list);
  }
  return { transactions, receipts, receiptsByTransaction };
}

function categoryLabel(tx: TransactionListItem, t: Strings): string {
  return categoryDisplayName(tx.categoryName ? { name: tx.categoryName, isSystem: tx.categoryIsSystem } : null, t);
}

function fileNameOf(relativePath: string): string {
  return relativePath.split('/').pop() ?? relativePath;
}

function buildCsv(
  transactions: TransactionListItem[],
  receiptsByTransaction: Map<string, MonthReceipt[]>,
  ctx: ExportContext,
): string {
  const { t } = ctx;
  const header = [
    t.pdf.date,
    t.pdf.type,
    t.pdf.category,
    t.pdf.counterparty,
    t.pdf.amount,
    ctx.currency,
    t.pdf.vat,
    t.pdf.invoiceNo,
    t.pdf.payment,
    t.pdf.note,
    t.pdf.photos,
  ];
  const rows = transactions.map((tx) => [
    tx.occurredOn,
    tx.kind === 'income' ? t.kind.income : t.kind.expense,
    categoryLabel(tx, t),
    tx.counterparty,
    (tx.amountCents / 100).toFixed(2),
    tx.currency,
    tx.vatCents != null ? (tx.vatCents / 100).toFixed(2) : '',
    tx.invoiceNumber,
    tx.paymentMethod ? t.tx.payment[tx.paymentMethod] : '',
    tx.note,
    (receiptsByTransaction.get(tx.id) ?? []).map((r) => `${r.relativePath.split('/').slice(-2).join('/')}`).join('; '),
  ]);
  return toCsv(header, rows);
}

export async function exportCsv(db: SQLiteDatabase, period: Period, ctx: ExportContext): Promise<ExportOutcome> {
  const { transactions, receiptsByTransaction } = await loadPeriod(db, period);
  if (transactions.length === 0) return 'empty';
  const file = writeExportText(`${fileStem(period)}.csv`, buildCsv(transactions, receiptsByTransaction, ctx));
  await shareFile(file, 'text/csv', `${ctx.t.export.csv} · ${periodLabel(period, ctx.locale)}`, ctx.t);
  return 'done';
}

function escapeHtml(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface ReceiptImage {
  caption: string;
  base64: string;
}

function buildReportHtml(
  period: Period,
  transactions: TransactionListItem[],
  receiptsByTransaction: Map<string, MonthReceipt[]>,
  images: ReceiptImage[],
  ctx: ExportContext,
): string {
  const { t, locale, currency } = ctx;
  const income = transactions.filter((x) => x.kind === 'income').reduce((sum, x) => sum + x.amountCents, 0);
  const expenses = transactions.filter((x) => x.kind === 'expense').reduce((sum, x) => sum + x.amountCents, 0);
  const money = (cents: number) => formatMoney(cents, currency, locale);

  const rows = transactions
    .map((tx) => {
      const photos = receiptsByTransaction.get(tx.id)?.length ?? 0;
      const amountClass = tx.kind === 'income' ? 'income' : 'expense';
      const sign = tx.kind === 'income' ? '+' : '−';
      return `<tr>
        <td>${escapeHtml(formatDate(tx.occurredOn, locale))}</td>
        <td>${tx.kind === 'income' ? escapeHtml(t.kind.income) : escapeHtml(t.kind.expense)}</td>
        <td>${escapeHtml(categoryLabel(tx, t))}</td>
        <td>${escapeHtml(tx.counterparty)}${tx.note ? `<div class="muted">${escapeHtml(tx.note)}</div>` : ''}</td>
        <td>${escapeHtml(tx.invoiceNumber)}</td>
        <td class="num">${tx.vatCents != null ? money(tx.vatCents) : ''}</td>
        <td class="num ${amountClass}">${sign}${money(tx.amountCents)}</td>
        <td class="num">${photos || ''}</td>
      </tr>`;
    })
    .join('');

  const imagesHtml = images
    .map(
      (img) => `<div class="receipt"><div class="caption">${escapeHtml(img.caption)}</div>
        <img src="data:image/jpeg;base64,${img.base64}" /></div>`,
    )
    .join('');

  const title = `${t.pdf.title} · ${periodLabel(period, locale)}`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; color: #111; margin: 28px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    h2 { font-size: 15px; margin: 24px 0 8px; border-bottom: 2px solid #0F766E; padding-bottom: 4px; }
    .muted { color: #666; font-size: 11px; }
    .summary { display: flex; gap: 12px; margin: 16px 0; }
    .box { flex: 1; border: 1px solid #ddd; border-radius: 8px; padding: 10px 12px; }
    .box .label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: .5px; }
    .box .value { font-size: 18px; font-weight: 600; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #e5e5e5; padding: 6px 5px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; }
    .num { text-align: right; white-space: nowrap; }
    .income { color: #15803D; } .expense { color: #B91C1C; }
    tfoot td { font-weight: 600; border-top: 2px solid #111; }
    .receipts { page-break-before: always; }
    .receipt { page-break-inside: avoid; margin: 0 0 18px; }
    .receipt img { max-width: 100%; max-height: 880px; border: 1px solid #ddd; border-radius: 4px; display: block; margin-top: 4px; }
    .caption { font-size: 12px; font-weight: 600; }
  </style></head><body>
  <h1>${escapeHtml(title)}</h1>
  <div class="muted">${ctx.profileName ? `${escapeHtml(ctx.profileName)} · ` : ''}${escapeHtml(t.pdf.generated)} ${escapeHtml(
    formatDateTime(nowISO(), locale),
  )}</div>
  <div class="summary">
    <div class="box"><div class="label">${escapeHtml(t.pdf.income)}</div><div class="value income">${money(income)}</div></div>
    <div class="box"><div class="label">${escapeHtml(t.pdf.expenses)}</div><div class="value expense">${money(expenses)}</div></div>
    <div class="box"><div class="label">${escapeHtml(t.pdf.net)}</div><div class="value">${money(income - expenses)}</div></div>
    <div class="box"><div class="label">${escapeHtml(t.pdf.count)}</div><div class="value">${transactions.length}</div></div>
  </div>
  <h2>${escapeHtml(t.pdf.entries)}</h2>
  <table>
    <thead><tr>
      <th>${escapeHtml(t.pdf.date)}</th><th>${escapeHtml(t.pdf.type)}</th><th>${escapeHtml(t.pdf.category)}</th>
      <th>${escapeHtml(t.pdf.counterparty)}</th><th>${escapeHtml(t.pdf.invoiceNo)}</th>
      <th class="num">${escapeHtml(t.pdf.vat)}</th><th class="num">${escapeHtml(t.pdf.amount)}</th><th class="num">${escapeHtml(t.pdf.photos)}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="6">${escapeHtml(t.pdf.net)}</td><td class="num">${money(income - expenses)}</td><td></td></tr></tfoot>
  </table>
  ${images.length > 0 ? `<div class="receipts"><h2>${escapeHtml(t.pdf.receipts)}</h2>${imagesHtml}</div>` : ''}
  </body></html>`;
}

export async function exportPdf(
  db: SQLiteDatabase,
  period: Period,
  ctx: ExportContext,
  includePhotos: boolean,
): Promise<ExportOutcome> {
  const { transactions, receipts, receiptsByTransaction } = await loadPeriod(db, period);
  if (transactions.length === 0) return 'empty';

  const images: ReceiptImage[] = [];
  if (includePhotos) {
    const txById = new Map(transactions.map((tx) => [tx.id, tx]));
    const ordered = [...receipts].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));
    for (const receipt of ordered) {
      const base64 = await renderBase64Jpeg(receipt.relativePath, {
        maxWidth: 900,
        quality: 0.6,
        knownWidth: receipt.width,
      });
      if (!base64) continue;
      const tx = txById.get(receipt.transactionId);
      const parts = [
        formatDate(receipt.occurredOn, ctx.locale),
        receipt.counterparty,
        tx ? categoryLabel(tx, ctx.t) : null,
        formatMoney(receipt.amountCents, receipt.currency, ctx.locale),
      ].filter(Boolean);
      images.push({ caption: parts.join(' · '), base64 });
    }
  }

  const html = buildReportHtml(period, transactions, receiptsByTransaction, images, ctx);
  const printed = await Print.printToFileAsync({ html, base64: false });
  const source = new File(printed.uri);
  const target = new File(exportsDirectory(), `${fileStem(period)}_report.pdf`);
  await source.move(target, { overwrite: true });
  await shareFile(target, 'application/pdf', `${ctx.t.export.pdf} · ${periodLabel(period, ctx.locale)}`, ctx.t);
  return 'done';
}

/** Receipt photos for the period in their monthly folders, plus the CSV, as one ZIP. */
export async function exportReceiptsZip(db: SQLiteDatabase, period: Period, ctx: ExportContext): Promise<ExportOutcome> {
  const { transactions, receipts, receiptsByTransaction } = await loadPeriod(db, period);
  if (transactions.length === 0) return 'empty';

  const entries: Zippable = {};
  entries['entries.csv'] = strToU8(buildCsv(transactions, receiptsByTransaction, ctx));
  for (const receipt of receipts) {
    const bytes = await readFileBytes(receipt.relativePath);
    if (!bytes) continue;
    const folder = receipt.relativePath.split('/').slice(-2, -1)[0] ?? 'receipts';
    entries[`${folder}/${fileNameOf(receipt.relativePath)}`] = [bytes, { level: 0 }];
  }
  const zipped = zipSync(entries);
  const file = writeExportBytes(`${fileStem(period)}_receipts.zip`, zipped);
  await shareFile(file, 'application/zip', `${ctx.t.export.zip} · ${periodLabel(period, ctx.locale)}`, ctx.t);
  return 'done';
}
