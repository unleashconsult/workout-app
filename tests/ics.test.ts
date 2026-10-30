import { describe, expect, it } from 'vitest';
import { buildIcs, escapeText, foldLine, reminderGroups } from '../src/domain/ics';
import { createInitialState } from '../src/domain/validate';

const now = new Date(2026, 9, 30, 12, 0); // fredag

describe('kalenderpåmindelser', () => {
  const { program } = createInitialState();

  it('grupperer styrkedage og strækdage hver for sig', () => {
    const groups = reminderGroups(program);
    expect(groups.map((g) => g.days)).toEqual([[0, 2, 4], [1, 3, 5, 6]]);
  });

  it('bygger gyldig iCalendar med gentagelse og alarm', () => {
    const ics = buildIcs(program, { reminderTime: '07:30', appUrl: 'https://example.com/app/', now });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=TU,TH,SA,SU');
    expect(ics).toContain('DTSTART:20261030T073000');
    expect(ics).toContain('DTSTART:20261031T073000');
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(2);
    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it('escaper specialtegn', () => {
    expect(escapeText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });

  it('folder lange linjer uden at splitte æøå', () => {
    const line = 'DESCRIPTION:' + 'æ'.repeat(100);
    const folded = foldLine(line);
    expect(folded.split('\r\n ').join('')).toBe(line);
  });
});
