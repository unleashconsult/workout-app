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
    // Stræk holdes 2 minutter pr. side (bekræftet), ikke 2 × 45 sek.
    revision: 2,
    apply: (e) =>
      STRETCH_IDS.has(e.id) && e.sets === 2 && e.holdSeconds === 45 && e.perSide
        ? { ...e, sets: 1, holdSeconds: 120, needsConfirmation: false }
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
