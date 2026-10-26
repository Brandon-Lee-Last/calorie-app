import type { MealType } from './dates';
import type { DiaryEntry, NewEntry } from './repo';

/** The add/edit form as typed: every number is still text. */
export type EntryForm = { name: string; calories: string; proteinG: string; carbG: string; fatG: string; mealType: MealType };
export type EntryFormErrors = Partial<Record<keyof EntryForm, string>>;

export const MEALS: readonly { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

export const mealLabel = (m: MealType) => MEALS.find((x) => x.value === m)?.label ?? m;

/** Name used when the form leaves it empty. */
export const QUICK_ADD_NAME = 'Quick add';

export function emptyForm(mealType: MealType): EntryForm {
  return { name: '', calories: '', proteinG: '', carbG: '', fatG: '', mealType };
}

export function formFromEntry(e: DiaryEntry): EntryForm {
  const text = (n: number) => (n ? String(n) : '');
  return { name: e.name, calories: String(e.calories), proteinG: text(e.proteinG), carbG: text(e.carbG), fatG: text(e.fatG), mealType: e.mealType };
}

/** Reads a typed number. Accepts a decimal comma (12,5), as South African keyboards type it. Empty is null. */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  return /^\d*\.?\d+$|^\d+\.$/.test(t) ? Number(t) : NaN;
}

/** Checks the form against the server's limits, so a saved entry is never rejected when it syncs. */
export function parseEntryForm(form: EntryForm): { ok: true; value: NewEntry } | { ok: false; errors: EntryFormErrors } {
  const errors: EntryFormErrors = {};
  const name = form.name.trim();
  if (name.length > 200) errors.name = 'Keep the name under 200 characters.';

  const calories = parseNumber(form.calories);
  if (calories === null) errors.calories = 'Enter the calories.';
  else if (Number.isNaN(calories) || calories > 20000) errors.calories = 'Enter a number from 0 to 20 000.';

  const macro = (key: 'proteinG' | 'carbG' | 'fatG') => {
    const n = parseNumber(form[key]);
    if (n !== null && (Number.isNaN(n) || n > 5000)) errors[key] = 'Enter grams from 0 to 5 000.';
    return n ?? 0;
  };
  const proteinG = macro('proteinG');
  const carbG = macro('carbG');
  const fatG = macro('fatG');

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: { name: name || QUICK_ADD_NAME, calories: calories!, proteinG, carbG, fatG, mealType: form.mealType, source: name ? 'manual' : 'quick_add' },
  };
}

const fmtG = (n: number) => Math.round(n).toLocaleString('en-ZA');
const servingsText = (n: number) => {
  const whole = Math.floor(n);
  const part = ({ 0.25: '¼', 0.5: '½', 0.75: '¾' } as Record<number, string>)[Math.round((n - whole) * 100) / 100];
  const text = part === undefined ? String(Math.round(n * 100) / 100) : `${whole || ''}${part}`;
  return `${text} serving${n === 1 ? '' : 's'}`;
};

/** How much was eaten, for a diary row: "172 g", "1 serving (30 g)", or null when only the calories were typed. Pure. */
export function portionText(e: Pick<DiaryEntry, 'quantityG' | 'servings'>): string | null {
  if (!e.quantityG) return null;
  return e.servings ? `${servingsText(e.servings)} (${fmtG(e.quantityG)} g)` : `${fmtG(e.quantityG)} g`;
}

/** Calories in 100 g of what was logged, when its weight is known: the figure that tells two same-named foods apart. Pure. */
export const kcalPer100g = (e: Pick<DiaryEntry, 'quantityG' | 'calories'>) => (e.quantityG ? Math.round((e.calories * 100) / e.quantityG) : null);

/** The form for `entry` eaten in a different amount: every number scales with the grams. Pure. */
export function formForGrams(form: EntryForm, entry: Pick<DiaryEntry, 'quantityG' | 'calories' | 'proteinG' | 'carbG' | 'fatG'>, grams: number): EntryForm {
  if (!entry.quantityG || !(grams > 0)) return form;
  const f = grams / entry.quantityG;
  const tenth = (n: number) => String(Math.round(n * f * 10) / 10);
  return { ...form, calories: String(Math.round(entry.calories * f)), proteinG: tenth(entry.proteinG), carbG: tenth(entry.carbG), fatG: tenth(entry.fatG) };
}

