import { PROGRAM_REVISION } from './defaultProgram';
import type { AppState, Exercise } from './types';

interface ProgramUpdate {
  revision: number;
  /** Opdaterer kun øvelser brugeren ikke selv har ændret. */
  apply(exercise: Exercise): Exercise | null;
}

const STRETCH_IDS = new Set(['stretch-overhead', 'stretch-chest']);

const UPDATES: ProgramUpdate[] = [
  {
    // Stræk holdes 2 minutter pr. side, ikke 2 × 45 sek.
    revision: 2,
    apply: (e) =>
      STRETCH_IDS.has(e.id) && e.sets === 2 && e.holdSeconds === 45 && e.perSide
        ? { ...e, sets: 1, holdSeconds: 120, needsConfirmation: false }
        : null,
  },
  {
    // Rettelse: kun overhead-strækket er 2 minutter. Bryststræk tilbage til 2 × 45 sek (ubekræftet).
    revision: 3,
    apply: (e) =>
      e.id === 'stretch-chest' && e.sets === 1 && e.holdSeconds === 120 && e.perSide
        ? { ...e, sets: 2, holdSeconds: 45, needsConfirmation: true }
        : null,
  },
  {
    // Bryststræk holdes 1 minut ad gangen. Antal gange er stadig ubekræftet.
    revision: 4,
    apply: (e) =>
      e.id === 'stretch-chest' && e.sets === 2 && e.holdSeconds === 45 && e.perSide ? { ...e, holdSeconds: 60 } : null,
  },
  {
    // Lower traps: 2–3 sæt (bekræftet). 2 sæt tæller som klaret, 3. sæt er valgfrit.
    revision: 5,
    apply: (e) =>
      e.id === 'lower-traps' && e.sets === 3 && e.minSets === undefined
        ? { ...e, minSets: 2, needsConfirmation: false }
        : null,
  },
];

export function applyProgramUpdates(state: AppState): AppState {
  if (state.programRevision >= PROGRAM_REVISION) return state;
  let exercises = state.program.exercises;
  for (const update of UPDATES) {
    if (update.revision <= state.programRevision) continue;
    exercises = exercises.map((e) => update.apply(e) ?? e);
  }
  return { ...state, programRevision: PROGRAM_REVISION, program: { ...state.program, exercises } };
}
