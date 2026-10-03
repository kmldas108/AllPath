// On-device storage. Everything v3 keeps — the review queue, the log, the output cache and
// the source media awaiting a decision — lives in IndexedDB on the device and never leaves it
// (spec C5). The profile and account list use localStorage instead: small, synchronous, read
// on every render. Nothing here talks to a server.

const DB_NAME = 'samaveshi';
const DB_VERSION = 1;

export const STORE = {
  queue: 'queue',
  log: 'log',
  cache: 'cache',
  media: 'media',
} as const;

export type StoreName = (typeof STORE)[keyof typeof STORE];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of Object.values(STORE)) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

function run<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  work: (objectStore: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const request = work(tx.objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
  );
}

export function put<T>(store: StoreName, key: string, value: T): Promise<unknown> {
  return run(store, 'readwrite', (s) => s.put(value as unknown as never, key));
}

export function get<T>(store: StoreName, key: string): Promise<T | undefined> {
  return run<T | undefined>(store, 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>);
}

export function del(store: StoreName, key: string): Promise<unknown> {
  return run(store, 'readwrite', (s) => s.delete(key));
}

export function keys(store: StoreName): Promise<string[]> {
  return run<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys()).then((k) =>
    k.map(String)
  );
}

export function values<T>(store: StoreName): Promise<T[]> {
  return run<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
}

export function clear(store: StoreName): Promise<unknown> {
  return run(store, 'readwrite', (s) => s.clear());
}

/** Wipe every store. Used by the test setup, and by sign-out-and-forget-this-device. */
export async function resetDeviceStorage(): Promise<void> {
  for (const name of Object.values(STORE)) {
    await clear(name);
  }
}
