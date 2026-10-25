import { parseNumber } from './entryForm';
import type { Goals } from './settings';

export type GoalForm = Record<keyof Goals, string>;
export type GoalErrors = Partial<Record<keyof Goals, string>>;

/** Checks typed goals against the server's limits (800 to 10 000 kcal, 0 to 1 500 g per macro). */
export function parseGoals(form: GoalForm): { ok: true; value: Goals } | { ok: false; errors: GoalErrors } {
  const errors: GoalErrors = {};
  const read = (k: keyof Goals, min: number, max: number, text: string) => {
    const n = parseNumber(form[k]);
    if (n === null || Number.isNaN(n) || n < min || n > max) errors[k] = text;
    return Math.round(n ?? 0);
  };
  const value = {
    calories: read('calories', 800, 10000, 'Enter calories from 800 to 10 000.'),
    proteinG: read('proteinG', 0, 1500, 'Enter grams from 0 to 1 500.'),
    carbG: read('carbG', 0, 1500, 'Enter grams from 0 to 1 500.'),
    fatG: read('fatG', 0, 1500, 'Enter grams from 0 to 1 500.'),
  };
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}
