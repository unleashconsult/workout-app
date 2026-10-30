import { DEFAULT_PROGRAM, PROGRAM_REVISION } from './defaultProgram';
import { applyProgramUpdates } from './programUpdates';
import { dateKey, isDateKey } from './dates';
import { SCHEMA_VERSION, type AppState, type DayLog, type Exercise, type Program, type Settings, type Weekday } from './types';

export class ValidationError extends Error {}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const isStr = (v: unknown, max = 500): v is string => typeof v === 'string' && v.length <= max;

function fail(path: string): never {
  throw new ValidationError(`Ugyldige data: ${path}`);
}

export const DEFAULT_SETTINGS: Settings = { reminderTime: '18:00', soundEnabled: true };

export function createInitialState(today: Date = new Date()): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    startedOn: dateKey(today),
    programRevision: PROGRAM_REVISION,
    program: structuredClone(DEFAULT_PROGRAM),
    log: {},
    settings: { ...DEFAULT_SETTINGS },
  };
}

function parseExercise(v: unknown, path: string): Exercise {
  if (!isObj(v)) fail(path);
  const { id, name, category, sets, reps, holdSeconds, perSide, restSeconds, days, cues, needsConfirmation } = v;
  if (!isStr(id, 80) || id.length === 0) fail(`${path}.id`);
  if (!isStr(name, 120) || name.trim().length === 0) fail(`${path}.name`);
  if (category !== 'stretch' && category !== 'strength') fail(`${path}.category`);
  if (!isInt(sets, 1, 20)) fail(`${path}.sets`);
  if (reps !== undefined && !(isObj(reps) && isInt(reps.min, 1, 200) && isInt(reps.max, reps.min as number, 200)))
    fail(`${path}.reps`);
  if (holdSeconds !== undefined && !isInt(holdSeconds, 1, 600)) fail(`${path}.holdSeconds`);
  if (typeof perSide !== 'boolean') fail(`${path}.perSide`);
  if (!isInt(restSeconds, 0, 900)) fail(`${path}.restSeconds`);
  if (!Array.isArray(days) || !days.every((d) => isInt(d, 0, 6))) fail(`${path}.days`);
  if (!Array.isArray(cues) || !cues.every((c) => isStr(c))) fail(`${path}.cues`);
  if (typeof needsConfirmation !== 'boolean') fail(`${path}.needsConfirmation`);
  return {
    id,
    name,
    category,
    sets,
    ...(reps ? { reps: { min: (reps as Obj).min as number, max: (reps as Obj).max as number } } : {}),
    ...(holdSeconds !== undefined ? { holdSeconds } : {}),
    perSide,
    restSeconds,
    days: [...new Set(days as Weekday[])].sort(),
    cues: [...(cues as string[])],
    needsConfirmation,
  };
}

function parseProgram(v: unknown): Program {
  if (!isObj(v)) fail('program');
  const { title, coach, principles, exercises } = v;
  if (!isStr(title, 120)) fail('program.title');
  if (!isStr(coach, 120)) fail('program.coach');
  if (!Array.isArray(principles) || !principles.every((p) => isStr(p))) fail('program.principles');
  if (!Array.isArray(exercises) || exercises.length > 50) fail('program.exercises');
  const parsed = exercises.map((e, i) => parseExercise(e, `program.exercises[${i}]`));
  if (new Set(parsed.map((e) => e.id)).size !== parsed.length) fail('program.exercises (dubletter)');
  return { title, coach, principles: [...(principles as string[])], exercises: parsed };
}

function parseDayLog(v: unknown, path: string): DayLog {
  if (!isObj(v) || !isObj(v.done)) fail(path);
  const done: Record<string, number> = {};
  for (const [id, n] of Object.entries(v.done)) {
    if (!isInt(n, 0, 100)) fail(`${path}.done.${id}`);
    done[id] = n;
  }
  const log: DayLog = { done };
  if (v.pain !== undefined) {
    if (!isInt(v.pain, 0, 10)) fail(`${path}.pain`);
    log.pain = v.pain;
  }
  if (v.note !== undefined) {
    if (!isStr(v.note, 2000)) fail(`${path}.note`);
    log.note = v.note;
  }
  return log;
}

function parseSettings(v: unknown): Settings {
  if (!isObj(v)) return { ...DEFAULT_SETTINGS };
  const reminderTime =
    isStr(v.reminderTime, 5) && /^([01]\d|2[0-3]):[0-5]\d$/.test(v.reminderTime)
      ? v.reminderTime
      : DEFAULT_SETTINGS.reminderTime;
  const soundEnabled = typeof v.soundEnabled === 'boolean' ? v.soundEnabled : DEFAULT_SETTINGS.soundEnabled;
  return { reminderTime, soundEnabled };
}

/** Migrerer ældre skemaversioner. Udvides når SCHEMA_VERSION hæves. */
function migrate(raw: Obj): Obj {
  const version = raw.schemaVersion;
  if (version === SCHEMA_VERSION) return raw;
  if (typeof version === 'number' && version > SCHEMA_VERSION) {
    throw new ValidationError('Data er fra en nyere version af appen. Opdatér appen først.');
  }
  fail('schemaVersion');
}

export function parseState(input: unknown): AppState {
  if (!isObj(input)) fail('rod');
  const raw = migrate(input);
  if (!isObj(raw.log)) fail('log');
  const log: Record<string, DayLog> = {};
  for (const [key, value] of Object.entries(raw.log)) {
    if (!isDateKey(key)) fail(`log.${key}`);
    log[key] = parseDayLog(value, `log.${key}`);
  }
  const startedOn =
    typeof raw.startedOn === 'string' && isDateKey(raw.startedOn)
      ? raw.startedOn
      : (Object.keys(log).sort()[0] ?? dateKey(new Date()));
  const programRevision = isInt(raw.programRevision, 1, 1000) ? raw.programRevision : 1;
  return applyProgramUpdates({
    schemaVersion: SCHEMA_VERSION,
    startedOn,
    programRevision,
    program: parseProgram(raw.program),
    log,
    settings: parseSettings(raw.settings),
  });
}
