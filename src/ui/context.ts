import type { Store } from '../storage/store';
import type { Timer } from './timer';

export interface ViewContext {
  store: Store;
  timer: Timer;
  navigate(path: string): void;
  now(): Date;
  /** Registrerer oprydning der køres når visningen udskiftes (fx object URLs). */
  onCleanup(fn: () => void): void;
}
