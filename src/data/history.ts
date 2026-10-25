import type { MealType } from './dates';
import { QUICK_ADD_NAME } from './entryForm';
import type { DiaryEntry, NewEntry } from './repo';

/** A meal the person keeps coming back to, with the numbers from the latest time they logged it. */
export type Usual = {
  key: string;
  name: string;
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  quantityG: number | null;
  mealType: MealType;
  times: number;
  lastDate: string;
};

const keyOf = (name: string) => name.trim().toLowerCase();

/** Every distinct meal in `entries` (quick adds left out), most logged first, then most recent. */
export function mealsFrom(entries: DiaryEntry[]): Usual[] {
  const groups = new Map<string, DiaryEntry[]>();
  for (const e of entries) {
    if (e.name === QUICK_ADD_NAME) continue;
    const k = keyOf(e.name);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  const meals = [...groups.entries()].map(([key, list]): Usual => {
    const latest = list.reduce((a, b) => (b.loggedAt > a.loggedAt ? b : a));
    const counts = new Map<MealType, number>();
    for (const e of list) counts.set(e.mealType, (counts.get(e.mealType) ?? 0) + 1);
    const mealType = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return {
      key,
      name: latest.name,
      calories: latest.calories,
      proteinG: latest.proteinG,
      carbG: latest.carbG,
      fatG: latest.fatG,
      quantityG: latest.quantityG,
      mealType,
      times: list.length,
      lastDate: latest.localDate,
    };
  });
  return meals.sort((a, b) => b.times - a.times || b.lastDate.localeCompare(a.lastDate));
}

/** Meals logged at least twice: the "usuals" row. */
export const learnUsuals = (entries: DiaryEntry[], limit = 6) => mealsFrom(entries).filter((m) => m.times >= 2).slice(0, limit);

/** The same moment of the day as `from`, on `date` (YYYY-MM-DD). */
export function atDate(date: string, from: number): number {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(from);
  return new Date(y, m - 1, d, t.getHours(), t.getMinutes(), t.getSeconds()).getTime();
}

const MEAL_HOUR: Record<MealType, [number, number]> = { breakfast: [8, 0], lunch: [13, 0], snack: [15, 30], dinner: [19, 0] };

/** A usual time for a meal on `date`, for entries added to a past day. */
export function mealTimeOn(date: string, meal: MealType): number {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = MEAL_HOUR[meal];
  return new Date(y, m - 1, d, h, min).getTime();
}

/** A logged meal as a new entry on another day (copying a meal, adding a usual). */
export function entryLike(e: Pick<Usual, 'name' | 'calories' | 'proteinG' | 'carbG' | 'fatG' | 'quantityG'>, mealType: MealType, loggedAt: number): NewEntry {
  return { name: e.name, calories: e.calories, proteinG: e.proteinG, carbG: e.carbG, fatG: e.fatG, quantityG: e.quantityG, mealType, loggedAt, source: 'manual' };
}

const SOURCE_TEXT: Record<DiaryEntry['source'], string> = {
  scan: 'scanned',
  barcode: 'barcode',
  manual: 'typed',
  quick_add: 'quick add',
  food: 'from your foods',
  ai_text: 'described',
};

export const sourceText = (s: DiaryEntry['source']) => SOURCE_TEXT[s] ?? s;
