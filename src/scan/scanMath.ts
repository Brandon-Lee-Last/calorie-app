import type { MealType } from '../data/dates';
import type { NewEntry, ScanRecord } from '../data/repo';
import { MODEL_VERSION, TYPICAL_ERROR, roundForDisplay, type Nutrition } from '../model/contract';

export const MIN_PORTION = 0.5;
export const MAX_PORTION = 2;
export const PORTION_STEP = 0.25;

export const stepPortion = (p: number, dir: 1 | -1) => Math.min(MAX_PORTION, Math.max(MIN_PORTION, Math.round((p + dir * PORTION_STEP) * 100) / 100));

const FRACTIONS: Record<number, string> = { 0: '', 0.25: '¼', 0.5: '½', 0.75: '¾' };

/** "¾ plate", "1 plate", "1½ plates". */
export function portionLabel(p: number): string {
  const whole = Math.floor(p);
  const frac = FRACTIONS[Math.round((p - whole) * 100) / 100] ?? '';
  const text = `${whole || ''}${frac}` || '0';
  return `${text} ${p > 1 ? 'plates' : 'plate'}`;
}

/** The numbers shown and saved for a portion, rounded no finer than the model can tell. */
export type Shown = { calories: number; massG: number; proteinG: number; carbG: number; fatG: number };

export function shownFor(n: Nutrition, portion: number): Shown {
  return {
    calories: roundForDisplay('calories', n.calories * portion),
    massG: roundForDisplay('mass', n.mass * portion),
    proteinG: roundForDisplay('protein', n.protein * portion),
    carbG: roundForDisplay('carb', n.carb * portion),
    fatG: roundForDisplay('fat', n.fat * portion),
  };
}

/** "usually within 80 kcal" (the model's average error on its test photos, scaled with the portion). */
export const typicalErrorKcal = (portion: number) => roundForDisplay('calories', TYPICAL_ERROR.calories * portion);

export function entryFromScan(shown: Shown, opts: { scanId: string; name: string; mealType: MealType }): NewEntry {
  return {
    name: opts.name.trim() || 'Scanned meal',
    calories: shown.calories,
    proteinG: shown.proteinG,
    carbG: shown.carbG,
    fatG: shown.fatG,
    quantityG: shown.massG > 0 ? shown.massG : null,
    mealType: opts.mealType,
    source: 'scan',
    scanId: opts.scanId,
  };
}

const raw = (n: Nutrition) => ({ calories: n.calories, massG: n.mass, fatG: n.fat, carbG: n.carb, proteinG: n.protein });
const clampNutrition = (v: ReturnType<typeof raw>) =>
  Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Math.max(0, Math.min(k === 'calories' ? 20000 : 5000, x))])) as ReturnType<typeof raw>;

/** What is sent to the server about a scan: the model's raw output, and what the person did with it. */
export function scanRecord(opts: {
  nutrition: Nutrition | null;
  food: number | null;
  outcome: ScanRecord['outcome'];
  saved?: Shown | null;
  portion?: number | null;
  at: number;
}): ScanRecord {
  return {
    modelVersion: MODEL_VERSION,
    foodProbability: opts.food,
    predicted: opts.nutrition && opts.outcome !== 'not_food' ? clampNutrition(raw(opts.nutrition)) : null,
    outcome: opts.outcome,
    final: opts.saved ? clampNutrition(opts.saved) : null,
    portion: opts.portion ?? null,
    contributeConsent: false,
    clientCreatedAt: opts.at,
  };
}
