import { addDays, dateKey, formatLongDate, parseDateKey } from '../domain/dates';
import {
  currentStreak,
  dayProgress,
  describeDose,
  doneUnits,
  exercisesForDate,
  formatHold,
  toggleUnit,
  unitLabel,
  unitsFor,
} from '../domain/progress';
import type { DayLog, Exercise } from '../domain/types';
import type { ViewContext } from './context';
import { h, ring } from './dom';

export function dayView(ctx: ViewContext, key?: string): HTMLElement {
  const today = ctx.now();
  const date = key ? parseDateKey(key) : today;
  const dk = dateKey(date);
  const isToday = dk === dateKey(today);
  const isFuture = date > today && !isToday;
  const state = ctx.store.get();
  const log = state.log[dk];
  const exercises = exercisesForDate(state.program, date);
  const progress = dayProgress(state, date);
  const streak = currentStreak(state, today);

  const setDone = (exercise: Exercise, value: number): void => {
    ctx.store.update((s) => {
      const day: DayLog = s.log[dk] ?? { done: {} };
      day.done[exercise.id] = Math.max(0, Math.min(value, unitsFor(exercise)));
      s.log[dk] = day;
    });
  };

  const onUnit = (exercise: Exercise, index: number): void => {
    ctx.timer.unlockAudio();
    const before = doneUnits(log, exercise);
    const after = toggleUnit(before, index);
    setDone(exercise, after);
    const sides = exercise.perSide ? 2 : 1;
    const setCompleted = after > before && after % sides === 0;
    if (isToday && setCompleted && after < unitsFor(exercise)) {
      ctx.timer.start('rest', exercise.restSeconds, `Næste: ${unitText(exercise, after)} · ${exercise.name}`);
    } else if (after > before && ctx.timer.isRunning) {
      ctx.timer.stop();
    }
  };

  const startHold = (exercise: Exercise): void => {
    const current = doneUnits(ctx.store.get().log[dk], exercise);
    if (current >= unitsFor(exercise) || !exercise.holdSeconds) return;
    const label = unitText(exercise, current);
    ctx.timer.start('hold', exercise.holdSeconds, `${exercise.name} · ${label}`, () => {
      const latest = doneUnits(ctx.store.get().log[dk], exercise);
      setDone(exercise, latest + 1);
      if (latest + 1 < unitsFor(exercise)) {
        ctx.timer.start('rest', exercise.restSeconds, `Næste: ${unitText(exercise, latest + 1)}`);
      }
    });
  };

  const stretches = exercises.filter((e) => e.category === 'stretch');
  const strength = exercises.filter((e) => e.category === 'strength');

  return h(
    'main',
    { class: 'view' },
    h(
      'header',
      { class: 'day-header' },
      h(
        'div',
        { class: 'day-nav' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Forrige dag', onclick: () => ctx.navigate(`/day/${dateKey(addDays(date, -1))}`) }, '‹'),
        h(
          'div',
          { class: 'day-title' },
          h('h1', null, isToday ? 'I dag' : formatLongDate(date)),
          h('p', { class: 'muted' }, isToday ? formatLongDate(date) : isFuture ? 'Kommende dag' : 'Tidligere dag'),
        ),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Næste dag', onclick: () => ctx.navigate(`/day/${dateKey(addDays(date, 1))}`) }, '›'),
      ),
      h(
        'div',
        { class: 'summary card' },
        h('div', { class: 'summary-ring' }, ring(progress.ratio, 64, 7), h('span', null, `${Math.round(progress.ratio * 100)}%`)),
        h(
          'div',
          null,
          h('div', { class: 'summary-main' }, progress.complete ? 'Alt er klaret 💪' : `${progress.done} af ${progress.planned} afkrydset`),
          h('div', { class: 'muted' }, streak > 0 ? `${streak} ${streak === 1 ? 'dag' : 'dage'} i træk` : 'Start din stribe i dag'),
        ),
      ),
      !isToday ? h('button', { class: 'btn btn-ghost btn-block', type: 'button', onclick: () => ctx.navigate('/') }, 'Gå til i dag') : null,
    ),
    exercises.length === 0
      ? h('section', { class: 'card empty' }, h('h2', null, 'Ingen øvelser'), h('p', { class: 'muted' }, 'Der er ikke planlagt øvelser denne dag.'))
      : null,
    section('1 · Stræk først', 'Stræk det væv der binder', stretches, log, onUnit, startHold, ctx, isFuture),
    section('2 · Styrke', '2–3 gange om ugen', strength, log, onUnit, startHold, ctx, isFuture),
    exercises.length > 0 && !isFuture ? checkIn(ctx, dk, log) : null,
  );
}

function unitText(exercise: Exercise, index: number): string {
  const u = unitLabel(exercise, index);
  return `Sæt ${u.set}${u.side ? ` · ${u.side === 'H' ? 'højre' : 'venstre'}` : ''}`;
}

function section(
  title: string,
  subtitle: string,
  exercises: Exercise[],
  log: DayLog | undefined,
  onUnit: (e: Exercise, i: number) => void,
  startHold: (e: Exercise) => void,
  ctx: ViewContext,
  disabled: boolean,
): HTMLElement | null {
  if (exercises.length === 0) return null;
  return h(
    'section',
    { class: 'section' },
    h('div', { class: 'section-head' }, h('h2', null, title), h('span', { class: 'muted' }, subtitle)),
    exercises.map((e) => exerciseCard(e, log, onUnit, startHold, ctx, disabled)),
  );
}

function exerciseCard(
  exercise: Exercise,
  log: DayLog | undefined,
  onUnit: (e: Exercise, i: number) => void,
  startHold: (e: Exercise) => void,
  ctx: ViewContext,
  disabled: boolean,
): HTMLElement {
  const total = unitsFor(exercise);
  const done = doneUnits(log, exercise);
  const complete = done >= total;

  const units = Array.from({ length: total }, (_, i) => {
    const u = unitLabel(exercise, i);
    const checked = i < done;
    return h(
      'button',
      {
        class: `unit${checked ? ' unit-done' : ''}${i === done ? ' unit-next' : ''}`,
        type: 'button',
        role: 'checkbox',
        'aria-checked': checked ? 'true' : 'false',
        'aria-label': `${exercise.name}, ${unitText(exercise, i)}`,
        disabled,
        onclick: () => onUnit(exercise, i),
      },
      h('span', { class: 'unit-check' }, checked ? '✓' : String(u.set)),
      u.side ? h('span', { class: 'unit-side' }, u.side) : null,
    );
  });

  return h(
    'article',
    { class: `card exercise${complete ? ' exercise-done' : ''}` },
    h(
      'button',
      { class: 'exercise-head', type: 'button', onclick: () => ctx.navigate(`/exercise/${exercise.id}`) },
      h(
        'div',
        null,
        h('h3', null, exercise.name),
        h(
          'p',
          { class: 'muted' },
          describeDose(exercise),
          exercise.restSeconds > 0 ? ` · ${exercise.restSeconds} sek pause` : '',
        ),
      ),
      h('span', { class: 'chevron', 'aria-hidden': 'true' }, 'ⓘ'),
    ),
    exercise.needsConfirmation ? h('p', { class: 'badge badge-warn' }, 'Dosering ikke på sedlen · bekræft med Nicky') : null,
    h('div', { class: 'units', role: 'group', 'aria-label': 'Sæt' }, units),
    exercise.category === 'stretch' && exercise.holdSeconds && !complete && !disabled
      ? h(
          'button',
          { class: 'btn btn-secondary btn-block', type: 'button', onclick: () => startHold(exercise) },
          `▶ Start ${formatHold(exercise.holdSeconds)} · ${unitText(exercise, done)}`,
        )
      : null,
  );
}

function checkIn(ctx: ViewContext, dk: string, log: DayLog | undefined): HTMLElement {
  const setPain = (value: number | undefined): void =>
    ctx.store.update((s) => {
      const day: DayLog = s.log[dk] ?? { done: {} };
      if (value === undefined) delete day.pain;
      else day.pain = value;
      s.log[dk] = day;
    });

  return h(
    'section',
    { class: 'section' },
    h('div', { class: 'section-head' }, h('h2', null, 'Skulderen i dag'), h('span', { class: 'muted' }, 'Til opfølgning med Nicky')),
    h(
      'div',
      { class: 'card' },
      h('p', { class: 'label' }, 'Smerte / ubehag (0 = intet, 10 = værst)'),
      h(
        'div',
        { class: 'pain-scale', role: 'radiogroup', 'aria-label': 'Smerte' },
        Array.from({ length: 11 }, (_, n) =>
          h(
            'button',
            {
              type: 'button',
              role: 'radio',
              'aria-checked': log?.pain === n ? 'true' : 'false',
              class: `pain pain-${n <= 3 ? 'low' : n <= 6 ? 'mid' : 'high'}${log?.pain === n ? ' pain-active' : ''}`,
              onclick: () => setPain(log?.pain === n ? undefined : n),
            },
            String(n),
          ),
        ),
      ),
      h('label', { class: 'label', for: 'note' }, 'Note'),
      h('textarea', {
        id: 'note',
        class: 'input',
        rows: 2,
        maxlength: 2000,
        placeholder: 'Fx "stramt i forreste skulder ved udadrotation"',
        value: log?.note ?? '',
        onchange: (ev: Event) => {
          const value = (ev.target as HTMLTextAreaElement).value.trim();
          ctx.store.update((s) => {
            const day: DayLog = s.log[dk] ?? { done: {} };
            if (value) day.note = value;
            else delete day.note;
            s.log[dk] = day;
          });
        },
      }),
    ),
  );
}
