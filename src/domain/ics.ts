import { addDays, dateKey, weekday } from './dates';
import type { Exercise, Program, Weekday } from './types';

const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;

export interface ReminderGroup {
  days: Weekday[];
  exercises: Exercise[];
}

/** Grupperer ugedage der har præcis samme øvelser, så hver gruppe bliver én gentagende kalenderbegivenhed. */
export function reminderGroups(program: Program): ReminderGroup[] {
  const groups = new Map<string, ReminderGroup>();
  for (let d = 0; d < 7; d++) {
    const day = d as Weekday;
    const exercises = program.exercises.filter((e) => e.days.includes(day));
    if (exercises.length === 0) continue;
    const key = exercises.map((e) => e.id).join('|');
    const group = groups.get(key) ?? { days: [], exercises };
    group.days.push(day);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
}

/** Folder linjer til maks. 75 oktetter jf. RFC 5545 uden at splitte multibyte-tegn. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function stamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export interface IcsOptions {
  reminderTime: string;
  appUrl: string;
  now: Date;
  durationMinutes?: number;
}

export function buildIcs(program: Program, options: IcsOptions): string {
  const [hh = '18', mm = '00'] = options.reminderTime.split(':');
  const duration = options.durationMinutes ?? 20;
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Skulder genoptraening//DA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const group of reminderGroups(program)) {
    const first = nextOccurrence(options.now, group.days);
    const hasStrength = group.exercises.some((e) => e.category === 'strength');
    const summary = hasStrength ? 'Skulder: stræk + styrke' : 'Skulder: stræk';
    const description = [
      ...group.exercises.map((e) => `• ${e.name}`),
      '',
      `Åbn appen og sæt flueben: ${options.appUrl}`,
    ].join('\n');
    const start = `${dateKey(first).replace(/-/g, '')}T${hh.padStart(2, '0')}${mm.padStart(2, '0')}00`;

    lines.push(
      'BEGIN:VEVENT',
      `UID:skulder-${group.days.map((d) => BYDAY[d]).join('')}@skulder-genoptraening`,
      `DTSTAMP:${stamp(options.now)}`,
      `DTSTART:${start}`,
      `DURATION:PT${duration}M`,
      `RRULE:FREQ=WEEKLY;BYDAY=${group.days.map((d) => BYDAY[d]).join(',')}`,
      `SUMMARY:${escapeText(summary)}`,
      `DESCRIPTION:${escapeText(description)}`,
      `URL:${options.appUrl}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(summary)}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

function nextOccurrence(from: Date, days: Weekday[]): Date {
  for (let i = 0; i < 7; i++) {
    const date = addDays(from, i);
    if (days.includes(weekday(date))) return date;
  }
  return from;
}
