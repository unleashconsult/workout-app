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
  /** Forhåndsbillede (JPEG) af videoens første billede. iOS viser ellers sort indtil afspilning. */
  poster?: Blob;
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
  const poster = file.type.startsWith('video/') ? await createPoster(file) : null;
  const item: MediaItem = {
    id: crypto.randomUUID(),
    exerciseId,
    name: file.name,
    type: file.type,
    createdAt: Date.now(),
    blob: file,
    ...(poster ? { poster } : {}),
  };
  await requestPersistence();
  await run('readwrite', (s) => s.put(item));
  return item;
}

/** Gemmer forhåndsbillede på en eksisterende video (bruges til videoer tilføjet før funktionen fandtes). */
export async function savePoster(item: MediaItem, poster: Blob): Promise<void> {
  await run('readwrite', (s) => s.put({ ...item, poster }));
}

const POSTER_MAX_WIDTH = 720;
const POSTER_TIMEOUT_MS = 10_000;

/** Tegner et billede fra starten af videoen til et JPEG. Returnerer null hvis det ikke lykkes. */
export function createPoster(video: Blob): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(video);
    const el = document.createElement('video');
    let settled = false;
    const finish = (result: Blob | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      el.removeAttribute('src');
      el.load();
      URL.revokeObjectURL(url);
      resolve(result);
    };
    const timeout = setTimeout(() => finish(null), POSTER_TIMEOUT_MS);

    el.muted = true;
    el.playsInline = true;
    el.preload = 'auto';
    el.addEventListener('error', () => finish(null));
    el.addEventListener('loadeddata', () => {
      // Lidt inde i videoen undgår et sort første billede.
      el.currentTime = Math.min(0.5, (el.duration || 1) / 4);
    });
    el.addEventListener('seeked', () => {
      try {
        const scale = Math.min(1, POSTER_MAX_WIDTH / (el.videoWidth || POSTER_MAX_WIDTH));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(el.videoWidth * scale);
        canvas.height = Math.round(el.videoHeight * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx || canvas.width === 0) return finish(null);
        ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => finish(blob), 'image/jpeg', 0.8);
      } catch {
        finish(null);
      }
    });
    el.src = url;
    el.load();
  });
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
