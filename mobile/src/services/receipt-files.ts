import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

import type { PendingAttachment } from '@/types';

import {
  bytesToDataUrl,
  dataUrlByteLength,
  dataUrlToBytes,
  loadWebFiles,
  uriToDataUrl,
  webClear,
  webDelete,
  webGet,
  webHas,
  webList,
  webMove,
  webPut,
  webSize,
} from './web-file-store';

/**
 * Receipt photos live under the app's private document directory:
 *
 *   <documents>/receipts/<YYYY-MM>/<uuid>.jpg   one folder per month of the entry's date
 *   <documents>/receipts/_inbox/<uuid>.jpg      photos taken while a form is open but not yet saved
 *
 * The database stores paths relative to the document directory (`receipts/2026-10/<uuid>.jpg`) because
 * the absolute location can change between app installs/updates on iOS.
 *
 * On web (preview / screenshots only) the same relative paths are kept in IndexedDB as data URLs,
 * see web-file-store.ts.
 */
export const RECEIPTS_DIR = 'receipts';
const INBOX_DIR = '_inbox';

/** Longest side of a stored receipt photo. Plenty for reading a receipt, keeps files around 200-400 KB. */
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.75;

const isWeb = Platform.OS === 'web';

/** Must run once before anything renders photos. No-op on phones. */
export async function prepareFileStorage(): Promise<void> {
  if (isWeb) await loadWebFiles();
}

function ensureDirectory(...segments: string[]): Directory {
  const dir = new Directory(Paths.document, ...segments);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
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

function mimeTypeFor(relativePath: string): string {
  return relativePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
}

/** URI usable in <Image source={{ uri }} /> for a stored relative path. */
export function absoluteUri(relativePath: string): string {
  if (isWeb) return webGet(relativePath) ?? '';
  return fileFor(relativePath).uri;
}

export function fileExists(relativePath: string): boolean {
  if (isWeb) return webHas(relativePath);
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
    result = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG, base64: isWeb });
  } finally {
    try {
      image.release();
    } catch {
      // ignore
    }
  }

  const id = Crypto.randomUUID();
  const relativePath = `${RECEIPTS_DIR}/${INBOX_DIR}/${id}.jpg`;

  if (isWeb) {
    const dataUrl = result.base64 ? `data:image/jpeg;base64,${result.base64}` : await uriToDataUrl(result.uri);
    await webPut(relativePath, dataUrl);
    return {
      id,
      relativePath,
      mimeType: 'image/jpeg',
      width: result.width,
      height: result.height,
      sizeBytes: dataUrlByteLength(dataUrl),
    };
  }

  const destination = new File(inboxDirectory(), `${id}.jpg`);
  await new File(result.uri).move(destination, { overwrite: true });
  return {
    id,
    relativePath,
    mimeType: 'image/jpeg',
    width: result.width,
    height: result.height,
    sizeBytes: destination.size,
  };
}

/** Copy an existing picture (bundled demo asset, restored backup…) straight into a monthly folder. */
export async function importFileToPath(sourceUri: string, relativePath: string): Promise<number | null> {
  if (isWeb) {
    const dataUrl = await uriToDataUrl(sourceUri);
    await webPut(relativePath, dataUrl);
    return dataUrlByteLength(dataUrl);
  }
  const segments = relativePath.split('/');
  const name = segments.pop();
  if (!name) throw new Error(`Invalid path ${relativePath}`);
  const destination = new File(ensureDirectory(...segments), name);
  await new File(sourceUri).copy(destination, { overwrite: true });
  return destination.size;
}

/** Move an inbox photo into its final monthly folder. Returns the new relative path. */
export async function commitPendingAttachment(pending: PendingAttachment, month: string): Promise<string> {
  const target = `${RECEIPTS_DIR}/${month}/${pending.id}.jpg`;
  if (pending.relativePath === target) return target;
  if (isWeb) {
    await webMove(pending.relativePath, target);
    return target;
  }
  const destination = new File(monthDirectory(month), `${pending.id}.jpg`);
  await fileFor(pending.relativePath).move(destination, { overwrite: true });
  return target;
}

/** When an entry's date moves to another month, its photos follow. Returns the (possibly unchanged) relative path. */
export async function moveAttachmentToMonth(relativePath: string, month: string): Promise<string> {
  const name = relativePath.split('/').pop();
  if (!name) return relativePath;
  const target = `${RECEIPTS_DIR}/${month}/${name}`;
  if (target === relativePath) return relativePath;
  if (isWeb) {
    if (!webHas(relativePath)) return relativePath;
    await webMove(relativePath, target);
    return target;
  }
  const source = fileFor(relativePath);
  if (!source.exists) return relativePath;
  await source.move(new File(monthDirectory(month), name), { overwrite: true });
  return target;
}

export function deleteFile(relativePath: string): void {
  if (isWeb) {
    void webDelete(relativePath);
    return;
  }
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
  if (isWeb) {
    for (const key of webList(`${RECEIPTS_DIR}/${INBOX_DIR}/`)) void webDelete(key);
    return;
  }
  try {
    const inbox = new Directory(Paths.document, RECEIPTS_DIR, INBOX_DIR);
    if (inbox.exists) inbox.delete();
  } catch {
    // ignore
  }
}

export function deleteAllReceiptFiles(): void {
  if (isWeb) {
    void webClear();
    return;
  }
  try {
    const root = new Directory(Paths.document, RECEIPTS_DIR);
    if (root.exists) root.delete();
  } catch {
    // ignore
  }
}

export function receiptsStorageBytes(): number {
  if (isWeb) return webSize();
  try {
    const root = new Directory(Paths.document, RECEIPTS_DIR);
    return root.exists ? (root.size ?? 0) : 0;
  } catch {
    return 0;
  }
}

export async function readFileBytes(relativePath: string): Promise<Uint8Array | null> {
  if (isWeb) {
    const dataUrl = webGet(relativePath);
    return dataUrl ? dataUrlToBytes(dataUrl) : null;
  }
  try {
    const file = fileFor(relativePath);
    if (!file.exists) return null;
    return await file.bytes();
  } catch {
    return null;
  }
}

export async function writeFileBytes(relativePath: string, bytes: Uint8Array): Promise<void> {
  if (isWeb) {
    await webPut(relativePath, bytesToDataUrl(bytes, mimeTypeFor(relativePath)));
    return;
  }
  const segments = relativePath.split('/');
  const name = segments.pop();
  if (!name) throw new Error(`Invalid path ${relativePath}`);
  const file = new File(ensureDirectory(...segments), name);
  file.create({ overwrite: true, intermediates: true });
  file.write(bytes);
}

/** Read any picked/downloaded URI (file://, blob:, data:) as bytes. */
export async function readUriBytes(uri: string): Promise<Uint8Array> {
  if (isWeb) {
    const response = await fetch(uri);
    return new Uint8Array(await response.arrayBuffer());
  }
  return new File(uri).bytes();
}

/**
 * Render a down-sized JPEG of a stored photo as base64 (used to embed receipts in PDF reports).
 * Returns null when the file is missing.
 */
export async function renderBase64Jpeg(
  relativePath: string,
  options: { maxWidth: number; quality: number; knownWidth?: number | null },
): Promise<string | null> {
  const sourceUri = absoluteUri(relativePath);
  if (!sourceUri || !fileExists(relativePath)) return null;
  let context = ImageManipulator.manipulate(sourceUri);
  if (!options.knownWidth || options.knownWidth > options.maxWidth) {
    context = context.resize({ width: options.maxWidth });
  }
  const image = await context.renderAsync();
  try {
    const result = await image.saveAsync({ compress: options.quality, format: SaveFormat.JPEG, base64: true });
    if (!isWeb) {
      try {
        new File(result.uri).delete();
      } catch {
        // temp file cleanup is best effort
      }
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

/* ------------------------------------------------------------------ */
/* Export files (handed to the share sheet, or downloaded on web)     */
/* ------------------------------------------------------------------ */

export interface ExportFile {
  uri: string;
  name: string;
  mimeType: string;
}

function exportsDirectory(): Directory {
  const dir = new Directory(Paths.cache, 'exports');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export function writeExportText(name: string, text: string, mimeType: string): ExportFile {
  if (isWeb) {
    const blob = new Blob([text], { type: mimeType });
    return { uri: URL.createObjectURL(blob), name, mimeType };
  }
  const file = new File(exportsDirectory(), name);
  file.create({ overwrite: true });
  file.write(text);
  return { uri: file.uri, name, mimeType };
}

export function writeExportBytes(name: string, bytes: Uint8Array, mimeType: string): ExportFile {
  if (isWeb) {
    const blob = new Blob([bytes as BlobPart], { type: mimeType });
    return { uri: URL.createObjectURL(blob), name, mimeType };
  }
  const file = new File(exportsDirectory(), name);
  file.create({ overwrite: true });
  file.write(bytes);
  return { uri: file.uri, name, mimeType };
}

/** Move a file produced elsewhere (e.g. expo-print's PDF) into the exports folder under a nice name. Native only. */
export async function moveToExports(sourceUri: string, name: string, mimeType: string): Promise<ExportFile> {
  const target = new File(exportsDirectory(), name);
  await new File(sourceUri).move(target, { overwrite: true });
  return { uri: target.uri, name, mimeType };
}
