/**
 * Videoer og billeder gemmes kun lokalt på telefonen (IndexedDB) og sendes aldrig nogen steder hen.
 */
export interface MediaItem {
  id: string;
  exerciseId: string;
  name: string;
  type: string;
  createdAt: number;
  blob: Blob;
}

const DB_NAME = 'skulder-genoptraening-media';
const DB_VERSION = 1;
const STORE = 'media';
const MAX_BYTES = 200 * 1024 * 1024;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('Lokal lagring af medier understøttes ikke i denne browser.'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('exerciseId', 'exerciseId', { unique: false });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Kunne ikke åbne mediedatabasen.'));
    }).catch((err: unknown) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error ?? request.error ?? new Error('Databasefejl'));
        tx.onabort = () => reject(tx.error ?? new Error('Handlingen blev afbrudt (evt. ikke nok plads).'));
      }),
  );
}

export async function listMedia(exerciseId: string): Promise<MediaItem[]> {
  const items = await run<MediaItem[]>('readonly', (s) => s.index('exerciseId').getAll(exerciseId));
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

export async function addMedia(exerciseId: string, file: File): Promise<MediaItem> {
  if (!file.type.startsWith('video/') && !file.type.startsWith('image/')) {
    throw new Error(`${file.name} er hverken video eller billede.`);
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`${file.name} er for stor (maks. ${MAX_BYTES / 1024 / 1024} MB).`);
  }
  const item: MediaItem = {
    id: crypto.randomUUID(),
    exerciseId,
    name: file.name,
    type: file.type,
    createdAt: Date.now(),
    blob: file,
  };
  await requestPersistence();
  await run('readwrite', (s) => s.put(item));
  return item;
}

export async function deleteMedia(id: string): Promise<void> {
  await run('readwrite', (s) => s.delete(id));
}

/** Beder browseren om ikke at rydde data automatisk. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch {
    return false;
  }
}
