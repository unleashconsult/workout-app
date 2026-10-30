import { describe, expect, it } from 'vitest';
import { addDays, dateKey, isDateKey, weekday } from '../src/domain/dates';
import { adherence, currentStreak, dayProgress, describeDose, exercisesForDate, toggleUnit, unitLabel, unitsFor } from '../src/domain/progress';
import { createInitialState } from '../src/domain/validate';
import type { AppState } from '../src/domain/types';

const MONDAY = new Date(2026, 9, 26); // mandag 26. okt 2026
const TUESDAY = addDays(MONDAY, 1);
const START = addDays(MONDAY, -60);

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

  it('rotator cuff: 3 sæt × 8 reps, højre og venstre, 90 sek pause', () => {
    const e = byId('rotator-cuff-er');
    expect(describeDose(e)).toBe('3 sæt × 8 reps pr. side');
    expect(e.restSeconds).toBe(90);
    expect(unitsFor(e)).toBe(6);
  });

  it('lower traps: 10–12 reps, 2 min pause, 3 gange om ugen', () => {
    const e = byId('lower-traps');
    expect(e.reps).toEqual({ min: 10, max: 12 });
    expect(e.restSeconds).toBe(120);
    expect(e.days).toEqual([0, 2, 4]);
  });

  it('stræk hver dag, styrke kun på styrkedage', () => {
    expect(exercisesForDate(state.program, MONDAY).map((e) => e.category)).toContain('strength');
    expect(exercisesForDate(state.program, TUESDAY).every((e) => e.category === 'stretch')).toBe(true);
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
    expect(dayProgress(state, MONDAY).done).toBe(6);
  });

  it('stribe tæller fuldførte dage og bryder ikke på en igangværende dag', () => {
    const state = createInitialState(START);
    const today = addDays(MONDAY, 3);
    for (let i = 1; i <= 3; i++) completeDay(state, addDays(today, -i));
    expect(currentStreak(state, today)).toBe(3);
    completeDay(state, today);
    expect(currentStreak(state, today)).toBe(4);
  });

  it('stribe brydes af en mistet dag', () => {
    const state = createInitialState(START);
    const today = addDays(MONDAY, 3);
    completeDay(state, addDays(today, -1));
    completeDay(state, addDays(today, -3));
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
