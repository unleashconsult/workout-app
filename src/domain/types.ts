/** 0 = mandag ... 6 = søndag (dansk ugestart). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Category = 'stretch' | 'strength';

export interface RepRange {
  min: number;
  max: number;
}

export interface Exercise {
  id: string;
  name: string;
  category: Category;
  sets: number;
  /** Gentagelser pr. sæt (styrke). */
  reps?: RepRange;
  /** Holdetid pr. sæt i sekunder (stræk). */
  holdSeconds?: number;
  /** Udføres på både højre og venstre side. */
  perSide: boolean;
  restSeconds: number;
  days: Weekday[];
  cues: string[];
  /** Doseringen står ikke på trænerens seddel og bør bekræftes. */
  needsConfirmation: boolean;
}

export interface Program {
  title: string;
  coach: string;
  principles: string[];
  exercises: Exercise[];
}

export interface DayLog {
  /** Antal afkrydsede enheder (sæt × sider) pr. øvelse. */
  done: Record<string, number>;
  /** Smerte/ubehag 0–10. */
  pain?: number;
  note?: string;
}

export interface Settings {
  /** "HH:MM", lokal tid. */
  reminderTime: string;
  soundEnabled: boolean;
}

export const SCHEMA_VERSION = 1;

export interface AppState {
  schemaVersion: typeof SCHEMA_VERSION;
  /** Første dag i forløbet ("YYYY-MM-DD"). Dage før tæller ikke med i statistik. */
  startedOn: string;
  program: Program;
  /** Nøgle: "YYYY-MM-DD" i lokal tid. */
  log: Record<string, DayLog>;
  settings: Settings;
}
