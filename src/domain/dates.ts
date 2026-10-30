import type { Weekday } from './types';

export const WEEKDAY_SHORT = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'] as const;
export const WEEKDAY_LONG = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'] as const;

const pad = (n: number): string => String(n).padStart(2, '0');

/** "YYYY-MM-DD" i lokal tid. */
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(parseDateKey(value)) === value;
}

export function weekday(date: Date): Weekday {
  return ((date.getDay() + 6) % 7) as Weekday;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function startOfWeek(date: Date): Date {
  return addDays(date, -weekday(date));
}

export function formatLongDate(date: Date): string {
  return `${WEEKDAY_LONG[weekday(date)]} ${date.getDate()}. ${date.toLocaleDateString('da-DK', { month: 'long' })}`;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}:${pad(s % 60)}` : `${s}`;
}
