import { addDays, dateKey, startOfWeek, WEEKDAY_SHORT } from '../domain/dates';
import { adherence, currentStreak, dayProgress } from '../domain/progress';
import type { ViewContext } from './context';
import { h, ring } from './dom';

const WEEKS = 6;

export function historyView(ctx: ViewContext): HTMLElement {
  const state = ctx.store.get();
  const today = ctx.now();
  const todayKey = dateKey(today);
  const firstWeek = addDays(startOfWeek(today), -7 * (WEEKS - 1));

  const weeks = Array.from({ length: WEEKS }, (_, w) => {
    const monday = addDays(firstWeek, w * 7);
    return h(
      'div',
      { class: 'week-row' },
      h('div', { class: 'week-label muted' }, `Uge ${isoWeek(monday)}`),
      Array.from({ length: 7 }, (_, d) => {
        const date = addDays(monday, d);
        const key = dateKey(date);
        const future = key > todayKey;
        const p = dayProgress(state, date);
        const status = future || p.planned === 0 ? 'none' : p.complete ? 'done' : p.done > 0 ? 'partial' : key === todayKey ? 'none' : 'missed';
        return h(
          'button',
          {
            class: `day-cell day-${status}${key === todayKey ? ' day-today' : ''}`,
            type: 'button',
            'aria-label': `${key}: ${p.done} af ${p.planned}`,
            onclick: () => ctx.navigate(key === todayKey ? '/' : `/day/${key}`),
          },
          h('span', null, String(date.getDate())),
        );
      }),
    );
  });

  const painDays = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const notes = Object.entries(state.log)
    .filter(([, l]) => l.note)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 10);

  return h(
    'main',
    { class: 'view' },
    h('header', null, h('h1', null, 'Overblik')),
    h(
      'div',
      { class: 'stats' },
      stat('Dage i træk', String(currentStreak(state, today))),
      stat('Seneste 7 dage', pct(adherence(state, today, 7)), adherence(state, today, 7)),
      stat('Seneste 28 dage', pct(adherence(state, today, 28)), adherence(state, today, 28)),
    ),
    h(
      'section',
      { class: 'card' },
      h('div', { class: 'week-row week-head' }, h('div', null), WEEKDAY_SHORT.map((d) => h('div', { class: 'muted' }, d))),
      weeks,
      h(
        'div',
        { class: 'legend muted' },
        h('span', null, h('i', { class: 'dot day-done' }), 'Klaret'),
        h('span', null, h('i', { class: 'dot day-partial' }), 'Delvist'),
        h('span', null, h('i', { class: 'dot day-missed' }), 'Mistet'),
      ),
    ),
    h(
      'section',
      { class: 'section' },
      h('div', { class: 'section-head' }, h('h2', null, 'Smerte seneste 14 dage')),
      h(
        'div',
        { class: 'card pain-chart', role: 'img', 'aria-label': 'Smerteniveau pr. dag' },
        painDays.map((date) => {
          const pain = state.log[dateKey(date)]?.pain;
          return h(
            'div',
            { class: 'pain-col', title: `${dateKey(date)}: ${pain ?? 'ingen registrering'}` },
            h('div', { class: 'pain-value' }, pain === undefined ? '' : String(pain)),
            h('div', {
              class: `pain-bar ${pain === undefined ? 'pain-none' : pain <= 3 ? 'pain-low' : pain <= 6 ? 'pain-mid' : 'pain-high'}`,
              style: `height: ${pain === undefined ? 4 : 8 + pain * 9}px`,
            }),
            h('div', { class: 'pain-day muted' }, WEEKDAY_SHORT[(date.getDay() + 6) % 7]?.charAt(0) ?? ''),
          );
        }),
      ),
    ),
    notes.length > 0
      ? h(
          'section',
          { class: 'section' },
          h('div', { class: 'section-head' }, h('h2', null, 'Noter')),
          h(
            'div',
            { class: 'card list' },
            notes.map(([key, l]) =>
              h('button', { class: 'list-item', type: 'button', onclick: () => ctx.navigate(`/day/${key}`) },
                h('div', { class: 'muted' }, key, l.pain !== undefined ? ` · smerte ${l.pain}` : ''),
                h('div', null, l.note ?? ''),
              ),
            ),
          ),
        )
      : null,
  );
}

function stat(label: string, value: string, ratio?: number): HTMLElement {
  return h(
    'div',
    { class: 'card stat' },
    ratio !== undefined ? ring(ratio, 36, 4) : null,
    h('div', { class: 'stat-value' }, value),
    h('div', { class: 'stat-label muted' }, label),
  );
}

const pct = (ratio: number): string => `${Math.round(ratio * 100)}%`;

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}
