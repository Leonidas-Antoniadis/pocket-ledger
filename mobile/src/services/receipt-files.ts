import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { PendingAttachment } from '@/types';

/**
 * Receipt photos live under the app's private document directory:
 *
 *   <documents>/receipts/<YYYY-MM>/<uuid>.jpg   one folder per month of the entry's date
 *   <documents>/receipts/_inbox/<uuid>.jpg      photos taken while a form is open but not yet saved
 *
 * The database stores paths relative to the document directory (`receipts/2026-10/<uuid>.jpg`) because
 * the absolute location can change between app installs/updates on iOS.
 */
export const RECEIPTS_DIR = 'receipts';
const INBOX_DIR = '_inbox';

/** Longest side of a stored receipt photo. Plenty for reading a receipt, keeps files around 200-400 KB. */
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.75;

function ensureDirectory(...segments: string[]): Directory {
  const dir = new Directory(Paths.document, ...segments);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export function receiptsRoot(): Directory {
  return ensureDirectory(RECEIPTS_DIR);
}

export function monthDirectory(month: string): Directory {
  return ensureDirectory(RECEIPTS_DIR, month);
}

function inboxDirectory(): Directory {
  return ensureDirectory(RECEIPTS_DIR, INBOX_DIR);
}

function fileFor(relativePath: string): File {
  return new File(Paths.document, ...relativePath.split('/'));
}

/** Absolute file:// URI for a stored relative path (for <Image source={{ uri }} />). */
export function absoluteUri(relativePath: string): string {
  return fileFor(relativePath).uri;
}

export function fileExists(relativePath: string): boolean {
  try {
    return fileFor(relativePath).exists;
  } catch {
    return false;
  }
}

export function folderLabel(month: string): string {
  return `${RECEIPTS_DIR}/${month}`;
}

/**
 * Compress a camera/gallery picture to JPEG, cap its size and park it in the inbox folder.
 * Returns the metadata the form keeps until the entry is saved.
 */
export async function importImage(uri: string, width?: number, height?: number): Promise<PendingAttachment> {
  let context = ImageManipulator.manipulate(uri);
  const w = width ?? 0;
  const h = height ?? 0;
  if (Math.max(w, h) > MAX_DIMENSION) {
    context = w >= h ? context.resize({ width: MAX_DIMENSION }) : context.resize({ height: MAX_DIMENSION });
  }
  const image = await context.renderAsync();
  let result;
  try {
    result = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
  } finally {
    try {
      image.release();
    } catch {
      // ignore
    }
  }

  const id = Crypto.randomUUID();
  const destination = new File(inboxDirectory(), `${id}.jpg`);
  await new File(result.uri).move(destination, { overwrite: true });

  return {
    id,
    relativePath: `${RECEIPTS_DIR}/${INBOX_DIR}/${id}.jpg`,
    mimeType: 'image/jpeg',
    width: result.width,
    height: result.height,
    sizeBytes: destination.size,
  };
}

/** Move an inbox photo into its final monthly folder. Returns the new relative path. */
export async function commitPendingAttachment(pending: PendingAttachment, month: string): Promise<string> {
  const target = `${RECEIPTS_DIR}/${month}/${pending.id}.jpg`;
  if (pending.relativePath === target) return target;
  const source = fileFor(pending.relativePath);
  const destination = new File(monthDirectory(month), `${pending.id}.jpg`);
  await source.move(destination, { overwrite: true });
  return target;
}

/** When an entry's date moves to another month, its photos follow. Returns the (possibly unchanged) relative path. */
export async function moveAttachmentToMonth(relativePath: string, month: string): Promise<string> {
  const name = relativePath.split('/').pop();
  if (!name) return relativePath;
  const target = `${RECEIPTS_DIR}/${month}/${name}`;
  if (target === relativePath) return relativePath;
  const source = fileFor(relativePath);
  if (!source.exists) return relativePath;
  await source.move(new File(monthDirectory(month), name), { overwrite: true });
  return target;
}

export function deleteFile(relativePath: string): void {
  try {
    const file = fileFor(relativePath);
    if (file.exists) file.delete();
  } catch {
    // Missing files are not an error for the caller.
  }
}

export function discardPendingAttachments(pending: PendingAttachment[]): void {
  for (const item of pending) deleteFile(item.relativePath);
}

/** Remove photos left behind by forms that were abandoned (app killed, etc.). Called at start-up. */
export function cleanupInbox(): void {
  try {
    const inbox = new Directory(Paths.document, RECEIPTS_DIR, INBOX_DIR);
    if (inbox.exists) inbox.delete();
  } catch {
    // ignore
  }
}

export function deleteAllReceiptFiles(): void {
  try {
    const root = new Directory(Paths.document, RECEIPTS_DIR);
    if (root.exists) root.delete();
  } catch {
    // ignore
  }
}

export function receiptsStorageBytes(): number {
  try {
    const root = new Directory(Paths.document, RECEIPTS_DIR);
    return root.exists ? (root.size ?? 0) : 0;
  } catch {
    return 0;
  }
}

export async function readFileBytes(relativePath: string): Promise<Uint8Array | null> {
  try {
    const file = fileFor(relativePath);
    if (!file.exists) return null;
    return await file.bytes();
  } catch {
    return null;
  }
}

export function writeFileBytes(relativePath: string, bytes: Uint8Array): void {
  const segments = relativePath.split('/');
  const name = segments.pop();
  if (!name) throw new Error(`Invalid path ${relativePath}`);
  const dir = ensureDirectory(...segments);
  const file = new File(dir, name);
  file.create({ overwrite: true, intermediates: true });
  file.write(bytes);
}

/**
 * Render a down-sized JPEG of a stored photo as base64 (used to embed receipts in PDF reports).
 * Returns null when the file is missing.
 */
export async function renderBase64Jpeg(
  relativePath: string,
  options: { maxWidth: number; quality: number; knownWidth?: number | null },
): Promise<string | null> {
  const file = fileFor(relativePath);
  if (!file.exists) return null;
  let context = ImageManipulator.manipulate(file.uri);
  if (!options.knownWidth || options.knownWidth > options.maxWidth) {
    context = context.resize({ width: options.maxWidth });
  }
  const image = await context.renderAsync();
  try {
    const result = await image.saveAsync({ compress: options.quality, format: SaveFormat.JPEG, base64: true });
    try {
      new File(result.uri).delete();
    } catch {
      // temp file cleanup is best effort
    }
    return result.base64 ?? null;
  } finally {
    try {
      image.release();
    } catch {
      // ignore
    }
  }
}

/** Scratch folder for files we hand to the share sheet. */
export function exportsDirectory(): Directory {
  const dir = new Directory(Paths.cache, 'exports');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export function writeExportText(fileName: string, text: string): File {
  const file = new File(exportsDirectory(), fileName);
  file.create({ overwrite: true });
  file.write(text);
  return file;
}

export function writeExportBytes(fileName: string, bytes: Uint8Array): File {
  const file = new File(exportsDirectory(), fileName);
  file.create({ overwrite: true });
  file.write(bytes);
  return file;
}
