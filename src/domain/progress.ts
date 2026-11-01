import { addDays, dateKey, parseDateKey, startOfWeek, weekday } from './dates';
import type { AppState, DayLog, Exercise, Program } from './types';

/** Antal afkrydsningsenheder: sæt × sider. */
export function unitsFor(exercise: Exercise): number {
  return exercise.sets * (exercise.perSide ? 2 : 1);
}

/** Enheder der skal til for at øvelsen tæller som gennemført. */
export function requiredUnitsFor(exercise: Exercise): number {
  return (exercise.minSets ?? exercise.sets) * (exercise.perSide ? 2 : 1);
}

export function isWeeklyMode(program: Program): boolean {
  return program.timesPerWeek !== undefined;
}

export function exercisesForDate(program: Program, date: Date): Exercise[] {
  if (isWeeklyMode(program)) return program.exercises;
  const day = weekday(date);
  return program.exercises.filter((e) => e.days.includes(day));
}

export function doneUnits(log: DayLog | undefined, exercise: Exercise): number {
  return Math.min(log?.done[exercise.id] ?? 0, unitsFor(exercise));
}

/**
 * Afkrydsning sker i rækkefølge. Tryk på en allerede afkrydset enhed fjerner den og alle efterfølgende,
 * tryk på en ikke-afkrydset enhed krydser op til og med den.
 */
export function toggleUnit(currentDone: number, index: number): number {
  return index < currentDone ? index : index + 1;
}

export interface DayProgress {
  planned: number;
  done: number;
  /** 0–1. Dage uden plan regnes som 1. */
  ratio: number;
  complete: boolean;
}

export function dayProgress(state: AppState, date: Date): DayProgress {
  const key = dateKey(date);
  const log = state.log[key];
  const exercises = key < state.startedOn ? [] : exercisesForDate(state.program, date);
  // Valgfrie ekstra sæt tæller ikke med, så "2–3 sæt" er klaret efter 2.
  const planned = exercises.reduce((sum, e) => sum + requiredUnitsFor(e), 0);
  const done = exercises.reduce((sum, e) => sum + Math.min(doneUnits(log, e), requiredUnitsFor(e)), 0);
  const ratio = planned === 0 ? 1 : done / planned;
  return { planned, done, ratio, complete: planned > 0 && done >= planned };
}

/**
 * Antal dage i træk med fuldført program. Dage uden plan springes over.
 * Dagen i dag tæller kun med hvis den er fuldført, så en igangværende dag ikke bryder rækken.
 */
export function currentStreak(state: AppState, today: Date, maxLookbackDays = 366): number {
  let streak = 0;
  for (let i = 0; i < maxLookbackDays; i++) {
    const date = addDays(today, -i);
    const p = dayProgress(state, date);
    if (p.planned === 0) continue;
    if (p.complete) streak++;
    else if (i === 0) continue;
    else break;
  }
  return streak;
}

/** Andel af planlagte enheder gennemført over de seneste n dage (inkl. i dag). */
export function adherence(state: AppState, today: Date, days: number): number {
  let planned = 0;
  let done = 0;
  for (let i = 0; i < days; i++) {
    const p = dayProgress(state, addDays(today, -i));
    planned += p.planned;
    done += Math.min(p.done, p.planned);
  }
  return planned === 0 ? 1 : done / planned;
}

export function describeDose(e: Exercise): string {
  const side = e.perSide ? ' pr. side' : '';
  if (e.category === 'stretch' && e.holdSeconds) {
    return `${e.sets} × ${formatHold(e.holdSeconds)}${side}`;
  }
  const reps = e.reps ? (e.reps.min === e.reps.max ? `${e.reps.min}` : `${e.reps.min}–${e.reps.max}`) : '?';
  const sets = e.minSets !== undefined && e.minSets < e.sets ? `${e.minSets}–${e.sets}` : `${e.sets}`;
  return `${sets} sæt × ${reps} reps${side}`;
}

/** Etiket for enhed nr. index, fx "Sæt 2 · H". */
export function unitLabel(e: Exercise, index: number): { set: number; side?: 'H' | 'V' } {
  if (!e.perSide) return { set: index + 1 };
  return { set: Math.floor(index / 2) + 1, side: index % 2 === 0 ? 'H' : 'V' };
}

/** 120 → "2 min", 90 → "90 sek". */
export function formatHold(seconds: number): string {
  return seconds >= 60 && seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} sek`;
}

export interface WeekStatus {
  /** Antal fuldførte træninger i ugen (man–søn). */
  sessions: number;
  target: number;
  reached: boolean;
  /** Dage tilbage af ugen inkl. i dag. */
  daysLeft: number;
}

/** Træninger i den uge (man–søn) som `date` ligger i. En træning = en dag med hele programmet klaret. */
export function weekStatus(state: AppState, date: Date): WeekStatus {
  const monday = startOfWeek(date);
  let sessions = 0;
  for (let i = 0; i < 7; i++) {
    if (dayProgress(state, addDays(monday, i)).complete) sessions++;
  }
  const target = state.program.timesPerWeek ?? 0;
  return { sessions, target, reached: sessions >= target, daysLeft: 7 - weekday(date) };
}

/**
 * Antal uger i træk hvor ugemålet er nået. Den igangværende uge tæller kun med hvis målet er nået,
 * så en uge der ikke er slut endnu ikke bryder rækken. Uger før forløbet startede tæller ikke.
 */
export function weekStreak(state: AppState, today: Date, maxWeeks = 104): number {
  const firstWeek = dateKey(startOfWeek(parseDateKey(state.startedOn)));
  let streak = 0;
  for (let w = 0; w < maxWeeks; w++) {
    const monday = addDays(startOfWeek(today), -7 * w);
    if (dateKey(monday) < firstWeek) break;
    const status = weekStatus(state, monday);
    if (status.reached) streak++;
    else if (w === 0) continue;
    else break;
  }
  return streak;
}

/** Andel af ugemålet nået i de seneste `weeks` afsluttede uger. Null hvis ingen uge er afsluttet endnu. */
export function weeklyAdherence(state: AppState, today: Date, weeks: number): number | null {
  const firstWeek = dateKey(startOfWeek(parseDateKey(state.startedOn)));
  let target = 0;
  let done = 0;
  for (let w = 1; w <= weeks; w++) {
    const monday = addDays(startOfWeek(today), -7 * w);
    if (dateKey(monday) < firstWeek) break;
    const status = weekStatus(state, monday);
    target += status.target;
    done += Math.min(status.sessions, status.target);
  }
  return target === 0 ? null : done / target;
}

