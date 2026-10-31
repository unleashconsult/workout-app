import { DEFAULT_PROGRAM } from '../domain/defaultProgram';
import { WEEKDAY_SHORT } from '../domain/dates';
import { describeDose } from '../domain/progress';
import type { Exercise, Weekday } from '../domain/types';
import { addMedia, createPoster, deleteMedia, listMedia, savePoster, type MediaItem } from '../storage/media';
import type { ViewContext } from './context';
import { h, toast } from './dom';

export function programView(ctx: ViewContext): HTMLElement {
  const { program } = ctx.store.get();
  return h(
    'main',
    { class: 'view' },
    h('header', null, h('h1', null, program.title), h('p', { class: 'muted' }, `Fra ${program.coach}`)),
    h(
      'section',
      { class: 'card' },
      h('h2', { class: 'card-title' }, 'Principper'),
      h('ol', { class: 'principles' }, program.principles.map((p) => h('li', null, p))),
    ),
    exerciseGroup(ctx, '1 · Stræk', 'Først, hver gang', program.exercises.filter((e) => e.category === 'stretch')),
    exerciseGroup(ctx, '2 · Styrke', 'Efter strækket', program.exercises.filter((e) => e.category === 'strength')),
    h('button', { class: 'btn btn-secondary btn-block', type: 'button', onclick: () => ctx.navigate('/exercise/new') }, '+ Tilføj øvelse'),
  );
}

function exerciseGroup(ctx: ViewContext, title: string, subtitle: string, exercises: Exercise[]): HTMLElement | null {
  if (exercises.length === 0) return null;
  return h(
    'section',
    { class: 'section' },
    h('div', { class: 'section-head' }, h('h2', null, title), h('span', { class: 'muted' }, subtitle)),
    h(
      'div',
      { class: 'card list' },
      exercises.map((e) =>
        h(
          'button',
          { class: 'list-item list-item-row', type: 'button', onclick: () => ctx.navigate(`/exercise/${e.id}`) },
          h(
            'div',
            null,
            h('div', { class: 'list-title' }, e.name),
            h('div', { class: 'muted' }, `${describeDose(e)} · ${formatDays(e.days)}`),
          ),
          h('span', { class: 'chevron', 'aria-hidden': 'true' }, '›'),
        ),
      ),
    ),
  );
}

export function formatDays(days: Weekday[]): string {
  if (days.length === 7) return 'Hver dag';
  if (days.length === 0) return 'Ingen dage';
  return days.map((d) => WEEKDAY_SHORT[d]).join(', ');
}

export function exerciseView(ctx: ViewContext, id: string): HTMLElement {
  const exercise = ctx.store.get().program.exercises.find((e) => e.id === id);
  if (!exercise) {
    return h('main', { class: 'view' }, h('h1', null, 'Øvelsen findes ikke'), backButton(ctx));
  }
  const original = DEFAULT_PROGRAM.exercises.find((e) => e.id === id);

  return h(
    'main',
    { class: 'view' },
    backButton(ctx),
    h('header', null, h('h1', null, exercise.name), h('p', { class: 'muted' }, `${describeDose(exercise)} · ${formatDays(exercise.days)}`)),
    exercise.needsConfirmation
      ? h('p', { class: 'badge badge-warn' }, 'Doseringen står ikke på sedlen. Bekræft med Nicky og ret under "Redigér".')
      : null,
    exercise.cues.length > 0
      ? h(
          'section',
          { class: 'card' },
          h('h2', { class: 'card-title' }, 'Sådan gør du'),
          h('ol', { class: 'cues' }, exercise.cues.map((c) => h('li', null, c))),
        )
      : null,
    mediaSection(ctx, exercise),
    h(
      'details',
      { class: 'card edit' },
      h('summary', null, 'Redigér øvelse'),
      exerciseForm(ctx, exercise, original),
    ),
  );
}

export function newExerciseView(ctx: ViewContext): HTMLElement {
  const blank: Exercise = {
    id: `custom-${crypto.randomUUID().slice(0, 8)}`,
    name: '',
    category: 'strength',
    sets: 3,
    reps: { min: 10, max: 10 },
    perSide: false,
    restSeconds: 60,
    days: [0, 2, 4],
    cues: [],
    needsConfirmation: false,
  };
  return h('main', { class: 'view' }, backButton(ctx), h('h1', null, 'Ny øvelse'), h('div', { class: 'card' }, exerciseForm(ctx, blank, undefined, true)));
}

function backButton(ctx: ViewContext): HTMLElement {
  return h('button', { class: 'back', type: 'button', onclick: () => (history.length > 1 ? history.back() : ctx.navigate('/program')) }, '‹ Tilbage');
}

function mediaSection(ctx: ViewContext, exercise: Exercise): HTMLElement {
  const grid = h('div', { class: 'media-grid' }, h('p', { class: 'muted' }, 'Indlæser…'));
  let disposed = false;
  const urls: string[] = [];
  ctx.onCleanup(() => {
    disposed = true;
    urls.forEach((u) => URL.revokeObjectURL(u));
  });

  const load = async (): Promise<void> => {
    try {
      const items = await listMedia(exercise.id);
      if (disposed) return;
      urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
      grid.replaceChildren(
        ...(items.length === 0
          ? [h('p', { class: 'muted' }, 'Ingen video endnu. Tilføj Nickys video fra din Fotos-app.')]
          : items.map((item) => {
              const url = URL.createObjectURL(item.blob);
              urls.push(url);
              return h(
                'figure',
                { class: 'media' },
                item.type.startsWith('video/')
                  ? videoElement(item, url, urls, () => disposed)
                  : h('img', { src: url, alt: exercise.name, loading: 'lazy' }),
                h(
                  'button',
                  {
                    class: 'btn btn-ghost btn-small',
                    type: 'button',
                    onclick: async () => {
                      if (!confirm('Slet denne fil fra appen?')) return;
                      await deleteMedia(item.id);
                      void load();
                    },
                  },
                  'Slet',
                ),
              );
            })),
      );
    } catch (err) {
      if (!disposed) grid.replaceChildren(h('p', { class: 'error' }, err instanceof Error ? err.message : 'Kunne ikke indlæse medier.'));
    }
  };
  void load();

  const input = h('input', {
    type: 'file',
    accept: 'video/*,image/*',
    multiple: true,
    hidden: true,
    onchange: async (ev: Event) => {
      const files = [...((ev.target as HTMLInputElement).files ?? [])];
      for (const file of files) {
        try {
          await addMedia(exercise.id, file);
        } catch (err) {
          toast(err instanceof Error ? err.message : 'Kunne ikke gemme filen.', 'error');
        }
      }
      (ev.target as HTMLInputElement).value = '';
      void load();
    },
  });

  return h(
    'section',
    { class: 'card' },
    h('h2', { class: 'card-title' }, 'Video og billeder'),
    grid,
    input,
    h('button', { class: 'btn btn-secondary btn-block', type: 'button', onclick: () => input.click() }, '+ Tilføj video eller billede'),
    h('p', { class: 'muted small' }, 'Gemmes kun på denne telefon.'),
  );
}

function videoElement(item: MediaItem, url: string, urls: string[], isDisposed: () => boolean): HTMLVideoElement {
  const video = h('video', { src: url, controls: true, playsinline: true, preload: 'metadata', loop: true });
  const applyPoster = (poster: Blob): void => {
    const posterUrl = URL.createObjectURL(poster);
    urls.push(posterUrl);
    video.poster = posterUrl;
  };
  if (item.poster) {
    applyPoster(item.poster);
  } else {
    // Ældre videoer uden forhåndsbillede: lav det nu og gem det til næste gang.
    void createPoster(item.blob).then(async (poster) => {
      if (!poster) return;
      if (!isDisposed()) applyPoster(poster);
      try {
        await savePoster(item, poster);
      } catch {
        /* vises stadig; gemmes igen næste gang */
      }
    });
  }
  return video;
}

function exerciseForm(ctx: ViewContext, exercise: Exercise, original: Exercise | undefined, isNew = false): HTMLElement {
  const num = (name: string, label: string, value: number | undefined, min: number, max: number): HTMLElement =>
    h(
      'label',
      { class: 'field' },
      h('span', { class: 'label' }, label),
      h('input', { class: 'input', name, type: 'number', inputmode: 'numeric', min, max, required: true, value: value ?? '' }),
    );

  const form = h(
    'form',
    {
      class: 'form',
      onsubmit: (ev: Event) => {
        ev.preventDefault();
        const data = new FormData(ev.target as HTMLFormElement);
        const n = (k: string): number => Number(data.get(k));
        const category = data.get('category') === 'stretch' ? 'stretch' : 'strength';
        const days = data.getAll('days').map(Number) as Weekday[];
        const next: Exercise = {
          id: exercise.id,
          name: String(data.get('name') ?? '').trim(),
          category,
          sets: Math.max(n('sets'), n('minSets')),
          ...(n('minSets') < n('sets') ? { minSets: n('minSets') } : {}),
          perSide: data.get('perSide') === 'on',
          restSeconds: n('restSeconds'),
          days,
          cues: String(data.get('cues') ?? '')
            .split('\n')
            .map((c) => c.trim())
            .filter(Boolean),
          needsConfirmation: data.get('needsConfirmation') === 'on',
          ...(category === 'stretch'
            ? { holdSeconds: n('holdSeconds') }
            : { reps: { min: n('repsMin'), max: Math.max(n('repsMin'), n('repsMax')) } }),
        };
        try {
          ctx.store.update((s) => {
            const i = s.program.exercises.findIndex((e) => e.id === exercise.id);
            if (i >= 0) s.program.exercises[i] = next;
            else s.program.exercises.push(next);
          });
          toast('Gemt');
          if (isNew) ctx.navigate(`/exercise/${next.id}`);
        } catch (err) {
          toast(err instanceof Error ? err.message : 'Kunne ikke gemme.', 'error');
        }
      },
    },
    h('label', { class: 'field' }, h('span', { class: 'label' }, 'Navn'), h('input', { class: 'input', name: 'name', required: true, maxlength: 120, value: exercise.name })),
    h(
      'label',
      { class: 'field' },
      h('span', { class: 'label' }, 'Type'),
      h(
        'select',
        { class: 'input', name: 'category' },
        h('option', { value: 'stretch', selected: exercise.category === 'stretch' }, 'Stræk (holdetid)'),
        h('option', { value: 'strength', selected: exercise.category === 'strength' }, 'Styrke (gentagelser)'),
      ),
    ),
    h(
      'div',
      { class: 'field-row' },
      num('minSets', 'Sæt fra', exercise.minSets ?? exercise.sets, 1, 20),
      num('sets', 'Sæt til', exercise.sets, 1, 20),
      num('restSeconds', 'Pause (sek)', exercise.restSeconds, 0, 900),
    ),
    h(
      'div',
      { class: 'field-row' },
      num('repsMin', 'Reps fra', exercise.reps?.min ?? 10, 1, 200),
      num('repsMax', 'Reps til', exercise.reps?.max ?? 10, 1, 200),
      num('holdSeconds', 'Hold (sek)', exercise.holdSeconds ?? 30, 1, 600),
    ),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'perSide', checked: exercise.perSide }), 'Både højre og venstre side'),
    h(
      'fieldset',
      { class: 'field' },
      h('legend', { class: 'label' }, 'Dage'),
      h(
        'div',
        { class: 'days' },
        WEEKDAY_SHORT.map((d, i) =>
          h('label', { class: 'day-toggle' }, h('input', { type: 'checkbox', name: 'days', value: i, checked: exercise.days.includes(i as Weekday) }), h('span', null, d)),
        ),
      ),
    ),
    h(
      'label',
      { class: 'field' },
      h('span', { class: 'label' }, 'Sådan gør du (én linje pr. punkt)'),
      h('textarea', { class: 'input', name: 'cues', rows: 4, value: exercise.cues.join('\n') }),
    ),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'needsConfirmation', checked: exercise.needsConfirmation }), 'Skal bekræftes med træner'),
    h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, isNew ? 'Opret øvelse' : 'Gem ændringer'),
    !isNew && original
      ? h(
          'button',
          {
            class: 'btn btn-ghost btn-block',
            type: 'button',
            onclick: () => {
              if (!confirm('Nulstil til Nickys oprindelige opsætning?')) return;
              ctx.store.update((s) => {
                const i = s.program.exercises.findIndex((e) => e.id === exercise.id);
                if (i >= 0) s.program.exercises[i] = structuredClone(original);
              });
              toast('Nulstillet');
            },
          },
          'Nulstil til Nickys version',
        )
      : null,
    !isNew
      ? h(
          'button',
          {
            class: 'btn btn-danger btn-block',
            type: 'button',
            onclick: () => {
              if (!confirm(`Slet "${exercise.name}" fra programmet? Historik bevares.`)) return;
              ctx.store.update((s) => {
                s.program.exercises = s.program.exercises.filter((e) => e.id !== exercise.id);
              });
              ctx.navigate('/program');
            },
          },
          'Slet øvelse',
        )
      : null,
  );
  return form;
}
