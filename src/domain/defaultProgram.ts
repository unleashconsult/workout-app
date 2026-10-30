import type { Program, Weekday } from './types';

/** Hæves når programmet ændres, så eksisterende installationer opdateres (se programUpdates.ts). */
export const PROGRAM_REVISION = 3;

const EVERY_DAY: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
/** Seddel: "2–3 x ugentlig". Mandag, onsdag, fredag som udgangspunkt. */
const STRENGTH_DAYS: Weekday[] = [0, 2, 4];

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
  exercises: [
    {
      id: 'stretch-overhead',
      name: 'Overhead stræk med elastik',
      category: 'stretch',
      sets: 1,
      holdSeconds: 120,
      perSide: true,
      restSeconds: 15,
      days: EVERY_DAY,
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
      holdSeconds: 45,
      perSide: true,
      restSeconds: 15,
      days: EVERY_DAY,
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
      reps: { min: 10, max: 12 },
      perSide: false,
      restSeconds: 120,
      days: STRENGTH_DAYS,
      cues: [
        'Hænderne bag hovedet, albuerne ud til siden.',
        'Træk skulderbladene ned og sammen, mod baglommerne.',
        'Hold 1–2 sek. i bund. Langsomt tilbage.',
        'Ingen løft af skuldrene mod ørerne.',
      ],
      needsConfirmation: true,
    },
    {
      id: 'rotator-cuff-er',
      name: 'Rotator cuff udadrotation',
      category: 'strength',
      sets: 3,
      reps: { min: 8, max: 8 },
      perSide: true,
      restSeconds: 90,
      days: STRENGTH_DAYS,
      cues: [
        'Elastikken fastgjort i albuehøjde ved siden af dig.',
        'Albuen ind til siden, underarmen vandret, 90° i albuen.',
        'Drej underarmen udad uden at albuen slipper kroppen.',
        'Mærk det bag på skulderen. Langsomt tilbage.',
      ],
      needsConfirmation: false,
    },
  ],
};
