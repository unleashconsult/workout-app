import { formatDuration } from '../domain/dates';
import { h } from './dom';

export type TimerKind = 'rest' | 'hold';

interface ActiveTimer {
  kind: TimerKind;
  label: string;
  endsAt: number;
  total: number;
  onDone?: () => void;
}

/**
 * Pause- og holdetimer. Baseret på sluttidspunkt, så den er korrekt selv hvis appen
 * har været i baggrunden. Bipper ved afslutning hvis lyd er slået til.
 */
export class Timer {
  private active: ActiveTimer | null = null;
  private interval: number | undefined;
  private audio: AudioContext | null = null;

  constructor(
    private readonly host: HTMLElement,
    private readonly soundEnabled: () => boolean,
  ) {
    document.addEventListener('visibilitychange', () => this.tick());
  }

  /** Skal kaldes fra en brugerhandling, så iOS tillader lyd senere. */
  unlockAudio(): void {
    if (!this.soundEnabled()) return;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.audio ??= new Ctx();
      if (this.audio.state === 'suspended') void this.audio.resume();
    } catch {
      this.audio = null;
    }
  }

  start(kind: TimerKind, seconds: number, label: string, onDone?: () => void): void {
    if (seconds <= 0) {
      onDone?.();
      return;
    }
    this.unlockAudio();
    this.active = { kind, label, total: seconds, endsAt: Date.now() + seconds * 1000, onDone };
    window.clearInterval(this.interval);
    this.interval = window.setInterval(() => this.tick(), 250);
    this.tick();
  }

  stop(): void {
    window.clearInterval(this.interval);
    this.active = null;
    this.render();
  }

  get isRunning(): boolean {
    return this.active !== null;
  }

  private tick(): void {
    const active = this.active;
    if (!active) return;
    if (Date.now() >= active.endsAt) {
      this.stop();
      this.beep(active.kind === 'hold' ? 2 : 3);
      active.onDone?.();
      return;
    }
    this.render();
  }

  private render(): void {
    const active = this.active;
    this.host.replaceChildren();
    this.host.hidden = !active;
    if (!active) return;
    const remaining = (active.endsAt - Date.now()) / 1000;
    const ratio = 1 - remaining / active.total;
    this.host.append(
      h(
        'div',
        { class: `timer timer-${active.kind}`, role: 'timer', 'aria-live': 'off' },
        h('div', { class: 'timer-bar', style: `transform: scaleX(${ratio.toFixed(4)})` }),
        h(
          'div',
          { class: 'timer-body' },
          h(
            'div',
            null,
            h('div', { class: 'timer-kind' }, active.kind === 'rest' ? 'Pause' : 'Hold strækket'),
            h('div', { class: 'timer-label' }, active.label),
          ),
          h('div', { class: 'timer-time' }, formatDuration(remaining)),
          h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => this.stop() }, active.kind === 'rest' ? 'Spring over' : 'Stop'),
        ),
      ),
    );
  }

  private beep(count: number): void {
    if (!this.soundEnabled()) return;
    try {
      navigator.vibrate?.(200);
    } catch {
      /* ikke understøttet på iOS */
    }
    const ctx = this.audio;
    if (!ctx) return;
    const start = ctx.currentTime + 0.05;
    for (let i = 0; i < count; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, start + i * 0.3);
      gain.gain.exponentialRampToValueAtTime(0.4, start + i * 0.3 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + i * 0.3 + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start + i * 0.3);
      osc.stop(start + i * 0.3 + 0.22);
    }
  }
}
