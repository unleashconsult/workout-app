import { createInitialState, parseState } from '../domain/validate';
import type { AppState } from '../domain/types';

const STORAGE_KEY = 'skulder-genoptraening:state';
const BACKUP_KEY = 'skulder-genoptraening:state:corrupt-backup';

type Listener = (state: AppState) => void;

/**
 * Lille, synkron state-store med persistens i localStorage.
 * Ugyldige data kasseres aldrig stille: de gemmes under BACKUP_KEY så de kan reddes.
 */
export class Store {
  private state: AppState;
  private listeners = new Set<Listener>();
  /** Sat hvis gemte data ikke kunne indlæses. */
  readonly loadError: string | null = null;
  persistError: string | null = null;

  constructor(private readonly storage: Storage | null = safeLocalStorage()) {
    const raw = this.read();
    if (raw === null) {
      this.state = createInitialState();
      return;
    }
    try {
      this.state = parseState(JSON.parse(raw));
      // Gem straks, så migreringer og programopdateringer kun køres én gang.
      this.persist();
    } catch (err) {
      this.loadError = err instanceof Error ? err.message : String(err);
      try {
        this.storage?.setItem(BACKUP_KEY, raw);
      } catch {
        /* backup er best effort */
      }
      this.state = createInitialState();
    }
  }

  get(): AppState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Opdatering sker på en kopi, så en fejlende mutation ikke efterlader halvfærdig state. */
  update(mutator: (draft: AppState) => void): void {
    const draft = structuredClone(this.state);
    mutator(draft);
    this.replace(draft);
  }

  replace(next: AppState): void {
    this.state = parseState(next);
    this.persist();
    for (const listener of this.listeners) listener(this.state);
  }

  private read(): string | null {
    try {
      return this.storage?.getItem(STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  private persist(): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.persistError = null;
    } catch (err) {
      this.persistError = err instanceof Error ? err.message : 'Kunne ikke gemme';
    }
  }
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
