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
