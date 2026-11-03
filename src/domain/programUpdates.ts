import { PROGRAM_REVISION } from './defaultProgram';
import type { AppState, Exercise, Program } from './types';

interface ProgramUpdate {
  revision: number;
  /** Opdaterer kun øvelser brugeren ikke selv har ændret. */
  apply?(exercise: Exercise): Exercise | null;
  /** Opdatering af selve programmet. */
  applyProgram?(program: Program): Program;
}

const STRETCH_IDS = new Set(['stretch-overhead', 'stretch-chest']);

const ROTATOR_CUFF_V1_CUES = [
  'Elastikken fastgjort i albuehøjde ved siden af dig.',
  'Albuen ind til siden, underarmen vandret, 90° i albuen.',
  'Drej underarmen udad uden at albuen slipper kroppen.',
  'Mærk det bag på skulderen. Langsomt tilbage.',
];
const ROTATOR_CUFF_V1_FIRST_CUE = ROTATOR_CUFF_V1_CUES[0];
const ROTATOR_CUFF_CUES = [
  'Elastikken i begge hænder. Begge arme arbejder samtidig.',
  'Albuerne ind til siden, underarmene vandret, 90° i albuerne.',
  'Drej underarmene udad uden at albuerne slipper kroppen.',
  'Mærk det bag på skulderen. Langsomt tilbage.',
];

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
  {
    // Stræk laves 2–3 gange om ugen sammen med styrke, ikke hver dag.
    revision: 6,
    apply: (e) => (STRETCH_IDS.has(e.id) && e.days.length === 7 ? { ...e, days: [0, 2, 4] } : null),
  },
  {
    // Ugemål i stedet for faste dage: 3 træninger om ugen, uanset hvilke dage.
    revision: 7,
    applyProgram: (p) => (p.timesPerWeek === undefined ? { ...p, timesPerWeek: 3 } : p),
  },
  {
    // Rotator cuff laves med begge arme samtidig ("H+V" på sedlen), så sæt deles ikke op i sider.
    revision: 8,
    apply: (e) =>
      e.id === 'rotator-cuff-er' && e.perSide
        ? {
            ...e,
            perSide: false,
            cues: e.cues[0] === ROTATOR_CUFF_V1_FIRST_CUE ? [...ROTATOR_CUFF_CUES] : e.cues,
          }
        : null,
  },
  {
    // Fortrudt: rotator cuff laves én side ad gangen (højre og venstre), som før revision 8.
    revision: 9,
    apply: (e) =>
      e.id === 'rotator-cuff-er' && !e.perSide
        ? {
            ...e,
            perSide: true,
            cues: e.cues[0] === ROTATOR_CUFF_CUES[0] ? [...ROTATOR_CUFF_V1_CUES] : e.cues,
          }
        : null,
  },
];

export function applyProgramUpdates(state: AppState): AppState {
  if (state.programRevision >= PROGRAM_REVISION) return state;
  let program = state.program;
  for (const update of UPDATES) {
    if (update.revision <= state.programRevision) continue;
    const { apply, applyProgram } = update;
    if (apply) program = { ...program, exercises: program.exercises.map((e) => apply(e) ?? e) };
    if (applyProgram) program = applyProgram(program);
  }
  return { ...state, programRevision: PROGRAM_REVISION, program };
}
