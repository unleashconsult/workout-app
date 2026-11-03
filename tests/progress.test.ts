import { describe, expect, it } from 'vitest';
import { addDays, dateKey, isDateKey, weekday } from '../src/domain/dates';
import {
  adherence,
  currentStreak,
  dayProgress,
  describeDose,
  exercisesForDate,
  toggleUnit,
  unitLabel,
  unitsFor,
  weekStatus,
  weekStreak,
  weeklyAdherence,
} from '../src/domain/progress';
import { createInitialState } from '../src/domain/validate';
import type { AppState } from '../src/domain/types';

const MONDAY = new Date(2026, 9, 26); // mandag 26. okt 2026
const TUESDAY = addDays(MONDAY, 1);
const START = addDays(MONDAY, -60);

/** Programmet med faste dage (uden ugemål), til test af dagsbaseret logik. */
function fixedDays(state: AppState): AppState {
  delete state.program.timesPerWeek;
  return state;
}

function completeDay(state: AppState, date: Date): void {
  const done: Record<string, number> = {};
  for (const e of exercisesForDate(state.program, date)) done[e.id] = unitsFor(e);
  state.log[dateKey(date)] = { done };
}

describe('dates', () => {
  it('bruger mandag som ugens første dag', () => {
    expect(weekday(MONDAY)).toBe(0);
    expect(weekday(addDays(MONDAY, 6))).toBe(6);
  });
  it('validerer datonøgler', () => {
    expect(isDateKey('2026-10-26')).toBe(true);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('26-10-2026')).toBe(false);
  });
});

describe('program fra Nickys seddel', () => {
  const state = createInitialState(START);
  const byId = (id: string) => state.program.exercises.find((e) => e.id === id)!;

  it('rotator cuff: 3 sæt × 8 reps, begge arme samtidig, 90 sek pause', () => {
    const e = byId('rotator-cuff-er');
    expect(describeDose(e)).toBe('3 sæt × 8 reps');
    expect(e.restSeconds).toBe(90);
    expect(unitsFor(e)).toBe(3);
  });

  it('lower traps: 10–12 reps, 2 min pause, 3 gange om ugen', () => {
    const e = byId('lower-traps');
    expect(e.reps).toEqual({ min: 10, max: 12 });
    expect(e.restSeconds).toBe(120);
    expect(e.days).toEqual([0, 2, 4]);
  });

  it('ugemål på 3 træninger, alle øvelser tilgængelige hver dag', () => {
    expect(state.program.timesPerWeek).toBe(3);
    expect(exercisesForDate(state.program, MONDAY)).toHaveLength(4);
    expect(exercisesForDate(state.program, TUESDAY)).toHaveLength(4);
  });

  it('med faste dage: man, ons, fre og hviledage imellem', () => {
    const fixed = fixedDays(createInitialState(START));
    expect(exercisesForDate(fixed.program, MONDAY)).toHaveLength(4);
    expect(exercisesForDate(fixed.program, TUESDAY)).toHaveLength(0);
  });
});

describe('afkrydsning', () => {
  it('krydser op til og med den valgte enhed', () => {
    expect(toggleUnit(0, 2)).toBe(3);
  });
  it('fjerner valgt enhed og efterfølgende', () => {
    expect(toggleUnit(4, 1)).toBe(1);
    expect(toggleUnit(1, 0)).toBe(0);
  });
  it('mærker sider H/V for øvelser pr. side', () => {
    const e = createInitialState(START).program.exercises.find((x) => x.perSide)!;
    expect(unitLabel(e, 0)).toEqual({ set: 1, side: 'H' });
    expect(unitLabel(e, 3)).toEqual({ set: 2, side: 'V' });
  });
});

describe('fremskridt', () => {
  it('beregner dagens andel', () => {
    const state = createInitialState(START);
    expect(dayProgress(state, MONDAY)).toMatchObject({ done: 0, complete: false });
    completeDay(state, MONDAY);
    expect(dayProgress(state, MONDAY)).toMatchObject({ ratio: 1, complete: true });
  });

  it('ignorerer for mange afkrydsninger', () => {
    const state = createInitialState(START);
    state.log[dateKey(MONDAY)] = { done: { 'rotator-cuff-er': 99 } };
    expect(dayProgress(state, MONDAY).done).toBe(3);
  });

  it('stribe tæller fuldførte dage og bryder ikke på en igangværende dag', () => {
    const state = fixedDays(createInitialState(START));
    // Fredag: man og ons klaret, fredag i gang. Hviledage springes over.
    const today = addDays(MONDAY, 4);
    completeDay(state, MONDAY);
    completeDay(state, addDays(MONDAY, 2));
    expect(currentStreak(state, today)).toBe(2);
    completeDay(state, today);
    expect(currentStreak(state, today)).toBe(3);
  });

  it('stribe brydes af en mistet dag', () => {
    const state = fixedDays(createInitialState(START));
    // Fredag: onsdag klaret, mandag mistet.
    const today = addDays(MONDAY, 4);
    completeDay(state, addDays(MONDAY, 2));
    expect(currentStreak(state, today)).toBe(1);
  });

  it('beregner gennemførelse over periode', () => {
    const state = createInitialState(START);
    expect(adherence(state, MONDAY, 7)).toBe(0);
    for (let i = 0; i < 7; i++) completeDay(state, addDays(MONDAY, -i));
    expect(adherence(state, MONDAY, 7)).toBe(1);
  });
});

describe('startdato', () => {
  it('dage før forløbet startede tæller ikke som mistede', () => {
    const state = createInitialState(MONDAY);
    expect(dayProgress(state, addDays(MONDAY, -1)).planned).toBe(0);
    expect(adherence(state, MONDAY, 28)).toBe(0);
    completeDay(state, MONDAY);
    expect(adherence(state, MONDAY, 28)).toBe(1);
  });
});

describe('stræk', () => {
  it('holdes 2 minutter pr. side', () => {
    const e = createInitialState(START).program.exercises.find((x) => x.id === 'stretch-overhead')!;
    expect(describeDose(e)).toBe('1 × 2 min pr. side');
    expect(unitsFor(e)).toBe(2);
  });
});

describe('lower traps 2–3 sæt', () => {
  it('vises som 2–3 sæt og er klaret efter 2', () => {
    const state = createInitialState(START);
    const e = state.program.exercises.find((x) => x.id === 'lower-traps')!;
    expect(describeDose(e)).toBe('2–3 sæt × 10–12 reps');
    state.log[dateKey(MONDAY)] = { done: { 'lower-traps': 2 } };
    const twoSets = dayProgress(state, MONDAY).done;
    expect(twoSets).toBe(2);
    state.log[dateKey(MONDAY)] = { done: { 'lower-traps': 3 } };
    expect(dayProgress(state, MONDAY).done).toBe(2);
  });
});

describe('ugemål', () => {
  const SUNDAY = addDays(MONDAY, 6);

  it('tæller træninger i ugen uanset dag', () => {
    const state = createInitialState(START);
    completeDay(state, TUESDAY);
    completeDay(state, addDays(MONDAY, 5)); // lørdag
    expect(weekStatus(state, SUNDAY)).toEqual({ sessions: 2, target: 3, reached: false, daysLeft: 1 });
    completeDay(state, SUNDAY);
    expect(weekStatus(state, SUNDAY).reached).toBe(true);
  });

  it('en delvis dag tæller ikke som træning', () => {
    const state = createInitialState(START);
    state.log[dateKey(MONDAY)] = { done: { 'lower-traps': 2 } };
    expect(weekStatus(state, MONDAY).sessions).toBe(0);
  });

  it('uger i træk: igangværende uge bryder ikke rækken', () => {
    const state = createInitialState(START);
    for (const w of [1, 2]) for (const d of [0, 2, 4]) completeDay(state, addDays(MONDAY, d - 7 * w));
    expect(weekStreak(state, MONDAY)).toBe(2);
    for (const d of [0, 1, 2]) completeDay(state, addDays(MONDAY, d));
    expect(weekStreak(state, addDays(MONDAY, 2))).toBe(3);
  });

  it('gennemførelse regnes kun på afsluttede uger efter start', () => {
    const state = createInitialState(MONDAY);
    expect(weeklyAdherence(state, addDays(MONDAY, 3), 4)).toBeNull();
    for (const d of [0, 2]) completeDay(state, addDays(MONDAY, d));
    expect(weeklyAdherence(state, addDays(MONDAY, 7), 4)).toBeCloseTo(2 / 3);
  });
});
