/**
 * Web-only stand-in for the native file system (expo-file-system's File/Directory classes are empty stubs on web).
 * Every stored file is a data URL kept in memory and persisted in IndexedDB. Good enough for the web preview and for
 * screenshots; phones use real files (see receipt-files.ts).
 */
const DB_NAME = 'pocket-ledger-files';
const STORE = 'files';

let memory = new Map<string, string>();
let loading: Promise<void> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run(mode: IDBTransactionMode, action: (store: IDBObjectStore) => void): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  } catch {
    // IndexedDB can be unavailable (private mode); the in-memory map still works for the session.
  }
}

/** Load everything into memory once. Resolves immediately on later calls. */
export function loadWebFiles(): Promise<void> {
  if (!loading) {
    loading = (async () => {
      if (typeof indexedDB === 'undefined') return;
      const db = await openDatabase();
      const entries = await new Promise<[string, string][]>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const store = tx.objectStore(STORE);
        const keys = store.getAllKeys();
        const values = store.getAll();
        tx.oncomplete = () => resolve(keys.result.map((key, i) => [String(key), values.result[i] as string]));
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      memory = new Map(entries);
    })().catch(() => {
      memory = new Map();
    });
  }
  return loading;
}

export function webGet(path: string): string | undefined {
  return memory.get(path);
}

export function webHas(path: string): boolean {
  return memory.has(path);
}

export function webList(prefix: string): string[] {
  return Array.from(memory.keys()).filter((key) => key.startsWith(prefix));
}

export async function webPut(path: string, dataUrl: string): Promise<void> {
  memory.set(path, dataUrl);
  await run('readwrite', (store) => store.put(dataUrl, path));
}

export async function webDelete(path: string): Promise<void> {
  memory.delete(path);
  await run('readwrite', (store) => store.delete(path));
}

export async function webMove(from: string, to: string): Promise<void> {
  const value = memory.get(from);
  if (value === undefined) return;
  memory.set(to, value);
  memory.delete(from);
  await run('readwrite', (store) => {
    store.put(value, to);
    store.delete(from);
  });
}

export async function webClear(): Promise<void> {
  memory = new Map();
  await run('readwrite', (store) => store.clear());
}

/** Approximate stored bytes (base64 inflates by 4/3). */
export function webSize(): number {
  let total = 0;
  for (const value of memory.values()) total += Math.floor((value.length * 3) / 4);
  return total;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function uriToDataUrl(uri: string): Promise<string> {
  if (uri.startsWith('data:')) return uri;
  const response = await fetch(uri);
  return blobToDataUrl(await response.blob());
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToDataUrl(bytes: Uint8Array, mimeType: string): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

export function dataUrlByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const payload = dataUrl.slice(comma + 1);
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.floor((payload.length * 3) / 4) - padding;
}
