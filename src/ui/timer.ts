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
  /** Lydløs tone der holder lydkanalen vågen under timeren, så iOS ikke suspenderer den. */
  private keepAlive: OscillatorNode | null = null;

  constructor(
    private readonly host: HTMLElement,
    private readonly soundEnabled: () => boolean,
  ) {
    document.addEventListener('visibilitychange', () => this.tick());
  }

  /** Skal kaldes fra en brugerhandling, så iOS tillader lyd senere. */
  unlockAudio(): void {
    if (!this.soundEnabled()) return;
    // iOS 17+: afspil som "medie", så lyden også høres når telefonen står på lydløs.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
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
    this.startKeepAlive();
    this.active = { kind, label, total: seconds, endsAt: Date.now() + seconds * 1000, onDone };
    window.clearInterval(this.interval);
    this.interval = window.setInterval(() => this.tick(), 250);
    this.tick();
  }

  stop(): void {
    window.clearInterval(this.interval);
    this.active = null;
    this.stopKeepAlive();
    this.render();
  }

  private startKeepAlive(): void {
    const ctx = this.audio;
    if (!ctx || this.keepAlive) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      this.keepAlive = osc;
    } catch {
      this.keepAlive = null;
    }
  }

  private stopKeepAlive(): void {
    try {
      this.keepAlive?.stop();
    } catch {
      /* allerede stoppet */
    }
    this.keepAlive = null;
  }

  get isRunning(): boolean {
    return this.active !== null;
  }

  private tick(): void {
    const active = this.active;
    if (!active) return;
    if (Date.now() >= active.endsAt) {
      // Bip før keep-alive stoppes, så lydkanalen stadig er aktiv.
      this.beep(active.kind === 'hold' ? 2 : 3);
      this.flash();
      this.stop();
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

  /** Kort blink på hele skærmen, så slut på timeren også ses uden lyd. */
  private flash(): void {
    document.body.classList.remove('timer-flash');
    void document.body.offsetWidth;
    document.body.classList.add('timer-flash');
    window.setTimeout(() => document.body.classList.remove('timer-flash'), 1600);
  }

  private beep(count: number): void {
    if (!this.soundEnabled()) return;
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      /* ikke understøttet på iOS */
    }
    const ctx = this.audio;
    if (!ctx) return;
    const play = (): void => {
      const start = ctx.currentTime + 0.05;
      for (let i = 0; i < count; i++) {
        const t = start + i * 0.35;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 1000;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.6, t + 0.02);
        gain.gain.setValueAtTime(0.6, t + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.28);
      }
    };
    if (ctx.state === 'running') play();
    else void ctx.resume().then(play, () => undefined);
  }
}
