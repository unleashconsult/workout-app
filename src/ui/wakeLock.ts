/**
 * Holder skærmen tændt mens appen er åben (Screen Wake Lock API).
 * Browseren slipper låsen når appen går i baggrunden, så den hentes igen når appen bliver synlig.
 */
export class ScreenWakeLock {
  private sentinel: WakeLockSentinel | null = null;
  private pending = false;

  constructor(private readonly enabled: () => boolean) {
    document.addEventListener('visibilitychange', () => void this.sync());
    // Nogle browsere kræver en brugerhandling før første lås.
    document.addEventListener('pointerdown', () => void this.sync(), { passive: true });
  }

  static get supported(): boolean {
    return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  }

  get active(): boolean {
    return this.sentinel !== null && !this.sentinel.released;
  }

  async sync(): Promise<void> {
    const want = this.enabled() && document.visibilityState === 'visible';
    if (!want) {
      await this.release();
      return;
    }
    if (this.active || this.pending || !ScreenWakeLock.supported) return;
    this.pending = true;
    try {
      this.sentinel = await navigator.wakeLock.request('screen');
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
      });
    } catch {
      // Fx lav batteritilstand eller ingen brugerhandling endnu. Prøves igen ved næste tryk.
      this.sentinel = null;
    } finally {
      this.pending = false;
    }
  }

  private async release(): Promise<void> {
    const sentinel = this.sentinel;
    this.sentinel = null;
    try {
      await sentinel?.release();
    } catch {
      /* allerede sluppet */
    }
  }
}
