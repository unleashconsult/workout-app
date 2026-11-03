import type { Program, Weekday } from './types';

/** Hæves når programmet ændres, så eksisterende installationer opdateres (se programUpdates.ts). */
export const PROGRAM_REVISION = 8;

/** Seddel: "2–3 x ugentlig". Gælder både stræk og styrke. Mandag, onsdag, fredag som udgangspunkt. */
const TRAINING_DAYS: Weekday[] = [0, 2, 4];

/**
 * Programmet fra Coach Nickys håndskrevne seddel, billeder og videoer.
 * Felter markeret needsConfirmation står ikke på sedlen og er sat ud fra gængs praksis.
 */
export const DEFAULT_PROGRAM: Program = {
  title: 'Skulder genoptræning',
  coach: 'Coach Nicky',
  principles: [
    'Start med at strække det væv der binder',
    'Træn de muskler der skal bruges til korrekt bevægelse',
    'Muskelstyrke',
  ],
  // Seddel: "2–3 x ugentlig". Fleksible dage, da træningen følger holdtræning.
  timesPerWeek: 3,
  exercises: [
    {
      id: 'stretch-overhead',
      name: 'Overhead stræk med elastik',
      category: 'stretch',
      sets: 1,
      holdSeconds: 120,
      perSide: true,
      restSeconds: 15,
      days: TRAINING_DAYS,
      cues: [
        'Halv knæstående. Elastikken fastgjort højt foran dig.',
        'Strak arm op og frem, lad elastikken trække armen.',
        'Læn overkroppen let væk og træk vejret roligt.',
        'Mærk strækket i siden af ryggen og under skulderen.',
      ],
      needsConfirmation: false,
    },
    {
      id: 'stretch-chest',
      name: 'Brystræk med elastik (arm bagud)',
      category: 'stretch',
      sets: 2,
      holdSeconds: 60,
      perSide: true,
      restSeconds: 15,
      days: TRAINING_DAYS,
      cues: [
        'Elastikken fastgjort i hoftehøjde bag dig.',
        'Strak arm ud til siden og let bagud, håndfladen frem.',
        'Drej langsomt kroppen væk fra armen.',
        'Mærk strækket foran på skulder og bryst.',
      ],
      needsConfirmation: true,
    },
    {
      id: 'lower-traps',
      name: 'Lower traps',
      category: 'strength',
      sets: 3,
      minSets: 2,
      reps: { min: 10, max: 12 },
      perSide: false,
      restSeconds: 120,
      days: TRAINING_DAYS,
      cues: [
        'Hænderne bag hovedet, albuerne ud til siden.',
        'Træk skulderbladene ned og sammen, mod baglommerne.',
        'Hold 1–2 sek. i bund. Langsomt tilbage.',
        'Ingen løft af skuldrene mod ørerne.',
      ],
      needsConfirmation: false,
    },
    {
      id: 'rotator-cuff-er',
      name: 'Rotator cuff udadrotation',
      category: 'strength',
      sets: 3,
      reps: { min: 8, max: 8 },
      perSide: false,
      restSeconds: 90,
      days: TRAINING_DAYS,
      cues: [
        'Elastikken i begge hænder. Begge arme arbejder samtidig.',
        'Albuerne ind til siden, underarmene vandret, 90° i albuerne.',
        'Drej underarmene udad uden at albuerne slipper kroppen.',
        'Mærk det bag på skulderen. Langsomt tilbage.',
      ],
      needsConfirmation: false,
    },
  ],
};
