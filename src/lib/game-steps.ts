// The steps of the "add a game" form (a wizard: one part per screen, ADR-52) and what each step needs before Next lets the Game Master on. The server checks
// everything again (worker/src/rules.ts); these checks only catch the plain mistakes early, on the step where they happen. Pure module.
import { SUMMARY_MAX } from "./areas.ts";
import { OTHER_SYSTEM } from "./systems.ts";

export const STEPS = ["game", "when", "players", "safety", "review"] as const;
export type StepKey = (typeof STEPS)[number];

/** The form's answers, as the inputs hold them (numbers as text until they are sent). */
export type GameFormValues = {
  title: string; system: string; otherSystem: string; summary: string; description: string; format: string; locationType: string; platform: string;
  cities: string[]; venueName: string; venueMapsRaw: string; onDemand: boolean; date: string; time: string; zone: string; scheduleNote: string; keepUntil: string;
  priceIdr: string; seats: string; language: string; level: string; minAge: string; contentWarnings: string; safetyTools: string;
  genres: string[]; styles: string[]; mechanics: string[]; coverKey: string; consent: boolean;
  sessionHours: string; characters: string; needs: string[]; safetyKeys: string[]; noWarnings: boolean;
};

/** Which step shows a field: an error the server sends back opens that step. */
export const STEP_OF: Record<string, number> = {
  title: 0, system: 0, otherSystem: 0, summary: 0, description: 0, genres: 0, styles: 0, mechanics: 0,
  format: 1, onDemand: 1, date: 1, time: 1, zone: 1, keepUntil: 1, scheduleNote: 1, locationType: 1, platform: 1, cities: 1, city: 1, venueName: 1, venueMapsRaw: 1,
  priceIdr: 2, seats: 2, minAge: 2, language: 2, level: 2, sessionHours: 2, characters: 2, needs: 2,
  contentWarnings: 3, noWarnings: 3, safetyKeys: 3, safetyTools: 3,
  coverKey: 4, consent: 4,
};

/** The first step that has one of these errors (the step to open), or null. */
export function firstStepWith(errors: Record<string, string>): number | null {
  const steps = Object.keys(errors).map((k) => STEP_OF[k] ?? 4);
  return steps.length ? Math.min(...steps) : null;
}

/** What is missing or wrong on one step, as field -> error code (the codes the server uses, so the messages are the same). */
export function stepErrors(v: GameFormValues, step: number): Record<string, string> {
  const e: Record<string, string> = {};
  const need = (key: string, ok: boolean, code = "required") => { if (!ok) e[key] = code; };
  const whole = (s: string, min: number, max: number) => /^\d+$/.test(s.trim()) && Number(s) >= min && Number(s) <= max;
  if (step === 0) {
    need("title", v.title.trim().length >= 3);
    need("system", v.system === OTHER_SYSTEM ? v.otherSystem.trim().length > 0 : v.system.trim().length > 0);
    need("summary", v.summary.trim().length > 0);
    if (v.summary.trim().length > SUMMARY_MAX) e.summary = "too_long";
    need("description", v.description.trim().length >= 20);
  }
  if (step === 1) {
    need("format", Boolean(v.format), "choose_one");
    if (!v.onDemand) need("date", /^\d{4}-\d{2}-\d{2}$/.test(v.date), "invalid_date");
    need("locationType", Boolean(v.locationType), "choose_one");
    if (v.locationType === "in_person") need("cities", v.cities.length > 0, "choose_one");
  }
  if (step === 2) {
    need("priceIdr", whole(v.priceIdr, 0, 10_000_000), "invalid_number");
    need("seats", whole(v.seats, 1, 20), "invalid_number");
    if (v.minAge.trim()) need("minAge", whole(v.minAge, 0, 99), "invalid_number");
    need("language", Boolean(v.language), "choose_one");
    need("level", Boolean(v.level), "choose_one");
  }
  if (step === 3) {
    need("contentWarnings", v.noWarnings || v.contentWarnings.trim() !== "");
    need("safetyTools", v.safetyKeys.length > 0 || v.safetyTools.trim() !== "");
  }
  if (step === 4) need("consent", v.consent);
  return e;
}
