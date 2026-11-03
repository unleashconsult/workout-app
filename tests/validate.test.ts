import { describe, expect, it } from 'vitest';
import { createInitialState, parseState, ValidationError } from '../src/domain/validate';
import { Store } from '../src/storage/store';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(k: string) { return this.data.get(k) ?? null; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  removeItem(k: string) { this.data.delete(k); }
  setItem(k: string, v: string) { this.data.set(k, v); }
}

describe('validering', () => {
  it('accepterer standardtilstanden gennem JSON', () => {
    const state = createInitialState();
    expect(parseState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('afviser ugyldige data', () => {
    const bad = createInitialState() as unknown as { program: { exercises: Array<{ sets: number }> } };
    bad.program.exercises[0]!.sets = 0;
    expect(() => parseState(bad)).toThrow(ValidationError);
    expect(() => parseState({ ...createInitialState(), log: { 'ikke-en-dato': { done: {} } } })).toThrow(ValidationError);
    expect(() => parseState({ ...createInitialState(), schemaVersion: 99 })).toThrow(/nyere version/);
  });

  it('retter ugyldige indstillinger til standard', () => {
    const state = parseState({ ...createInitialState(), settings: { reminderTime: '18:00', soundEnabled: 'ja' } });
    expect(state.settings).toEqual({ soundEnabled: true, keepScreenOn: true });
  });
});

describe('Store', () => {
  it('gemmer og indlæser', () => {
    const storage = new MemoryStorage();
    const a = new Store(storage);
    a.update((s) => void (s.log['2026-10-30'] = { done: { 'lower-traps': 2 }, pain: 3 }));
    const b = new Store(storage);
    expect(b.get().log['2026-10-30']).toEqual({ done: { 'lower-traps': 2 }, pain: 3 });
  });

  it('gemmer korrupte data til side i stedet for at slette dem', () => {
    const storage = new MemoryStorage();
    storage.setItem('skulder-genoptraening:state', '{ødelagt');
    const store = new Store(storage);
    expect(store.loadError).not.toBeNull();
    expect(storage.getItem('skulder-genoptraening:state:corrupt-backup')).toBe('{ødelagt');
    expect(store.get()).toEqual(createInitialState());
  });

  it('afviser ugyldig opdatering uden at ændre state', () => {
    const store = new Store(new MemoryStorage());
    const before = store.get();
    expect(() => store.update((s) => void (s.program.exercises[0]!.sets = -1))).toThrow();
    expect(store.get()).toBe(before);
  });
});

describe('programopdateringer', () => {
  const legacy = () => {
    const state = createInitialState() as unknown as Record<string, unknown> & { program: { exercises: Array<Record<string, unknown>> } };
    delete state.programRevision;
    for (const e of state.program.exercises) {
      if (String(e.id).startsWith('stretch-')) Object.assign(e, { sets: 2, holdSeconds: 45, needsConfirmation: true });
    }
    return state;
  };

  it('opdaterer uændret overhead-stræk til 2 minutter og lader bryststræk være', () => {
    const state = parseState(JSON.parse(JSON.stringify(legacy())));
    const byId = (id: string) => state.program.exercises.find((e) => e.id === id)!;
    expect(byId('stretch-overhead')).toMatchObject({ sets: 1, holdSeconds: 120, needsConfirmation: false });
    expect(byId('stretch-chest')).toMatchObject({ sets: 2, holdSeconds: 60, needsConfirmation: true });
    expect(state.programRevision).toBe(8);
  });

  it('retter bryststræk tilbage på installationer der fik revision 2', () => {
    const raw = legacy();
    raw.programRevision = 2;
    for (const e of raw.program.exercises) {
      if (String(e.id).startsWith('stretch-')) Object.assign(e, { sets: 1, holdSeconds: 120, needsConfirmation: false });
    }
    const state = parseState(JSON.parse(JSON.stringify(raw)));
    expect(state.program.exercises.find((e) => e.id === 'stretch-overhead')).toMatchObject({ sets: 1, holdSeconds: 120 });
    expect(state.program.exercises.find((e) => e.id === 'stretch-chest')).toMatchObject({ sets: 2, holdSeconds: 60, needsConfirmation: true });
  });

  it('bevarer øvelser brugeren selv har ændret', () => {
    const raw = legacy();
    Object.assign(raw.program.exercises[0]!, { holdSeconds: 60 });
    const state = parseState(JSON.parse(JSON.stringify(raw)));
    expect(state.program.exercises[0]).toMatchObject({ sets: 2, holdSeconds: 60 });
  });
});

describe('lower traps opdatering', () => {
  it('får 2–3 sæt på eksisterende installationer', () => {
    const raw = createInitialState() as unknown as Record<string, unknown> & { program: { exercises: Array<Record<string, unknown>> } };
    raw.programRevision = 4;
    const lt = raw.program.exercises.find((e) => e.id === 'lower-traps')!;
    delete lt.minSets;
    lt.needsConfirmation = true;
    const state = parseState(JSON.parse(JSON.stringify(raw)));
    expect(state.program.exercises.find((e) => e.id === 'lower-traps')).toMatchObject({ sets: 3, minSets: 2, needsConfirmation: false });
  });

  it('afviser minSets større end sets', () => {
    const raw = createInitialState() as unknown as { program: { exercises: Array<Record<string, unknown>> } };
    raw.program.exercises[2]!.minSets = 5;
    expect(() => parseState(raw)).toThrow(ValidationError);
  });
});

describe('stræk-dage opdatering', () => {
  it('flytter stræk fra hver dag til man, ons, fre', () => {
    const raw = createInitialState() as unknown as Record<string, unknown> & { program: { exercises: Array<Record<string, unknown>> } };
    raw.programRevision = 5;
    for (const e of raw.program.exercises) if (String(e.id).startsWith('stretch-')) e.days = [0, 1, 2, 3, 4, 5, 6];
    const state = parseState(JSON.parse(JSON.stringify(raw)));
    for (const e of state.program.exercises) expect(e.days).toEqual([0, 2, 4]);
  });
});

describe('ugemål opdatering', () => {
  it('giver eksisterende installationer 3 træninger om ugen', () => {
    const raw = createInitialState() as unknown as Record<string, unknown> & { program: Record<string, unknown> };
    raw.programRevision = 6;
    delete raw.program.timesPerWeek;
    const state = parseState(JSON.parse(JSON.stringify(raw)));
    expect(state.program.timesPerWeek).toBe(3);
  });

  it('afviser ugyldigt ugemål', () => {
    const raw = createInitialState() as unknown as { program: Record<string, unknown> };
    raw.program.timesPerWeek = 9;
    expect(() => parseState(raw)).toThrow(ValidationError);
  });
});

describe('rotator cuff opdatering', () => {
  it('slår sider sammen og opdaterer uændrede instruktioner', () => {
    const raw = createInitialState() as unknown as Record<string, unknown> & { program: { exercises: Array<Record<string, unknown>> } };
    raw.programRevision = 7;
    const cuff = raw.program.exercises.find((e) => e.id === 'rotator-cuff-er')!;
    Object.assign(cuff, { perSide: true, cues: ['Elastikken fastgjort i albuehøjde ved siden af dig.', 'x'] });
    const state = parseState(JSON.parse(JSON.stringify(raw)));
    const e = state.program.exercises.find((x) => x.id === 'rotator-cuff-er')!;
    expect(e.perSide).toBe(false);
    expect(e.cues[0]).toMatch(/begge hænder/);
  });
});
