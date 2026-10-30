import { dateKey } from '../domain/dates';
import { buildIcs, reminderGroups } from '../domain/ics';
import { createInitialState, parseState } from '../domain/validate';
import type { ViewContext } from './context';
import { downloadBlob, h, saveFile, toast } from './dom';
import { formatDays } from './programView';

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function settingsView(ctx: ViewContext): HTMLElement {
  const state = ctx.store.get();
  const appUrl = new URL('./', location.href).href;
  const groups = reminderGroups(state.program);

  const addToCalendar = (): void => {
    const ics = buildIcs(state.program, { reminderTime: state.settings.reminderTime, appUrl, now: ctx.now() });
    // Direkte download åbner iOS' "Tilføj til kalender"-dialog. Delingsarket gør ikke.
    downloadBlob('skulder-paamindelser.ics', new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  };

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
      h('h2', { class: 'card-title' }, 'Påmindelser'),
      h('p', { class: 'muted' }, 'Påmindelserne lægges i din iPhone-kalender som gentagende begivenheder med alarm. De virker også når appen er lukket.'),
      h(
        'label',
        { class: 'field' },
        h('span', { class: 'label' }, 'Tidspunkt'),
        h('input', {
          class: 'input',
          type: 'time',
          value: state.settings.reminderTime,
          onchange: (ev: Event) => {
            const value = (ev.target as HTMLInputElement).value;
            if (/^\d{2}:\d{2}$/.test(value)) ctx.store.update((s) => void (s.settings.reminderTime = value));
          },
        }),
      ),
      h(
        'ul',
        { class: 'reminder-list' },
        groups.map((g) =>
          h(
            'li',
            null,
            h('strong', null, formatDays(g.days)),
            h('span', { class: 'muted' }, ` · ${g.exercises.some((e) => e.category === 'strength') ? 'stræk + styrke' : 'stræk'}`),
          ),
        ),
      ),
      h('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: addToCalendar }, '📅 Tilføj påmindelser til kalender'),
      h('p', { class: 'muted small' }, 'Ændrer du tidspunkt eller dage: slet de gamle begivenheder i Kalender og tilføj igen. Åbner kalenderen ikke fra hjemmeskærms-appen, så gør det fra Safari.'),
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
      h('p', { class: 'muted small' }, 'Lydløs-knappen på telefonen skal være slået fra.'),
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
