export type Kind = 'expense' | 'income';
export type PaymentMethod = 'cash' | 'card' | 'bank' | 'other';
export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'bank', 'other'];

export interface Category {
  id: string;
  /** For system categories this is a translation key (see i18n `categoryNames`); for custom ones the literal name. */
  name: string;
  kind: Kind;
  icon: string;
  color: string;
  sortOrder: number;
  isSystem: boolean;
  isArchived: boolean;
}

export interface Transaction {
  id: string;
  kind: Kind;
  amountCents: number;
  currency: string;
  /** ISO date, YYYY-MM-DD (local). */
  occurredOn: string;
  /** YYYY-MM, derived from occurredOn. Drives the monthly receipt folder. */
  month: string;
  categoryId: string | null;
  counterparty: string | null;
  note: string | null;
  paymentMethod: PaymentMethod | null;
  vatCents: number | null;
  invoiceNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionListItem extends Transaction {
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  categoryIsSystem: boolean;
  attachmentCount: number;
  firstAttachmentPath: string | null;
}

export interface Attachment {
  id: string;
  transactionId: string;
  /** Path relative to the app document directory, e.g. receipts/2026-10/<uuid>.jpg */
  relativePath: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  createdAt: string;
}

/** A receipt photo listed inside a monthly folder, with enough of its entry to label it. */
export interface MonthReceipt extends Attachment {
  kind: Kind;
  amountCents: number;
  currency: string;
  occurredOn: string;
  counterparty: string | null;
  categoryName: string | null;
  categoryIsSystem: boolean;
}

/** A photo that has been captured, compressed and saved to the inbox folder but not yet linked to a saved entry. */
export interface PendingAttachment {
  id: string;
  relativePath: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
}

export interface TransactionInput {
  kind: Kind;
  amountCents: number;
  currency: string;
  occurredOn: string;
  categoryId: string | null;
  counterparty: string | null;
  note: string | null;
  paymentMethod: PaymentMethod | null;
  vatCents: number | null;
  invoiceNumber: string | null;
}

export interface MonthSummary {
  month: string;
  incomeCents: number;
  expenseCents: number;
  transactionCount: number;
  receiptCount: number;
}

export interface CategoryTotal {
  categoryId: string | null;
  name: string | null;
  icon: string | null;
  color: string | null;
  isSystem: boolean;
  kind: Kind;
  totalCents: number;
  count: number;
}

export type Language = 'en' | 'el';

export interface AppSettings {
  currency: string;
  language: Language;
  profileName: string;
}
