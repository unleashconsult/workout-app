import { dateKey } from '../domain/dates';
import { createInitialState, parseState } from '../domain/validate';
import type { ViewContext } from './context';
import { h, saveFile, toast } from './dom';
import { ScreenWakeLock } from './wakeLock';

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function settingsView(ctx: ViewContext): HTMLElement {
  const state = ctx.store.get();

  const exportBackup = async (): Promise<void> => {
    try {
      await saveFile(`skulder-backup-${dateKey(ctx.now())}.json`, 'application/json', JSON.stringify(ctx.store.get(), null, 2));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Eksport fejlede', 'error');
    }
  };

  const fileInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onchange: async (ev: Event) => {
      const input = ev.target as HTMLInputElement;
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      try {
        const next = parseState(JSON.parse(await file.text()));
        if (!confirm('Erstat alle nuværende data med backuppen?')) return;
        ctx.store.replace(next);
        toast('Backup indlæst');
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Filen kunne ikke læses', 'error');
      }
    },
  });

  return h(
    'main',
    { class: 'view' },
    h('header', null, h('h1', null, 'Indstillinger')),
    !isStandalone()
      ? h(
          'section',
          { class: 'card callout' },
          h('h2', { class: 'card-title' }, 'Installér på hjemmeskærmen'),
          h('ol', { class: 'cues' }, h('li', null, 'Åbn siden i Safari.'), h('li', null, 'Tryk på Del-knappen.'), h('li', null, 'Vælg "Føj til hjemmeskærm".')),
        )
      : null,
    h(
      'section',
      { class: 'card' },
      h('h2', { class: 'card-title' }, 'Påmindelse'),
      h('p', { class: 'muted' }, 'Holdtræning giver typisk 2 af ugens træninger. Sæt én påmindelse til den 3. Sig til Siri:'),
      h('p', { class: 'quote' }, '"Mind mig om skuldertræning hver lørdag klokken 10"'),
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', { class: 'card-title' }, 'Lyd'),
      h(
        'label',
        { class: 'check' },
        h('input', {
          type: 'checkbox',
          checked: state.settings.soundEnabled,
          onchange: (ev: Event) => {
            const on = (ev.target as HTMLInputElement).checked;
            ctx.store.update((s) => void (s.settings.soundEnabled = on));
          },
        }),
        'Bip når pause eller stræk er slut',
      ),
      h('p', { class: 'muted small' }, 'Lyden spiller også på lydløs (iOS 17 eller nyere). Skru op for medielyden.'),
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', { class: 'card-title' }, 'Skærm'),
      h(
        'label',
        { class: 'check' },
        h('input', {
          type: 'checkbox',
          checked: state.settings.keepScreenOn,
          disabled: !ScreenWakeLock.supported,
          onchange: (ev: Event) => {
            const on = (ev.target as HTMLInputElement).checked;
            ctx.store.update((s) => void (s.settings.keepScreenOn = on));
          },
        }),
        'Hold skærmen tændt mens appen er åben',
      ),
      h(
        'p',
        { class: 'muted small' },
        ScreenWakeLock.supported
          ? 'Virker ikke i strømsparetilstand.'
          : 'Understøttes ikke på denne enhed. Opdatér iOS for at bruge det.',
      ),
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', { class: 'card-title' }, 'Data'),
      h('p', { class: 'muted' }, 'Alt gemmes kun på din telefon. Tag en backup en gang imellem, fx til iCloud Drive.'),
      h('button', { class: 'btn btn-secondary btn-block', type: 'button', onclick: exportBackup }, 'Gem backup'),
      fileInput,
      h('button', { class: 'btn btn-secondary btn-block', type: 'button', onclick: () => fileInput.click() }, 'Indlæs backup'),
      h(
        'button',
        {
          class: 'btn btn-danger btn-block',
          type: 'button',
          onclick: () => {
            if (!confirm('Slet al historik og nulstil programmet til Nickys version? Videoer bevares.')) return;
            ctx.store.replace(createInitialState(ctx.now()));
            toast('Nulstillet');
          },
        },
        'Nulstil alt',
      ),
    ),
    h('p', { class: 'muted small center' }, `Version ${__BUILD_ID__.slice(0, 16).replace('T', ' ')}`),
  );
}
