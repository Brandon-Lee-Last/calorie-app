import { ApiError } from '../api/errors';
import type { components } from '../api/schema';
import type { MealType } from './dates';
import type { NewEntry } from './repo';

export type CoachMessage = components['schemas']['CoachMessage'];
export type PantryRecipe = components['schemas']['PantryMeals']['recipes'][number];
/** A food on the phone's grocery list: the food list's id (so the server can count it) and a name to show. */
export type PantryItem = { id: string; name: string; brand: string | null };

/** Meta key: the grocery list, kept on the phone. */
export const PANTRY_KEY = 'pantry.items';
export const MAX_PANTRY = 30;
export const MAX_MESSAGE = 1000;

export const SUGGESTIONS = ['What should I eat tonight?', 'How much protein do I need?', 'I skipped the gym again. Motivate me!', 'Ideas for a cheap healthy lunch?'];

/**
 * Pango's replies type out on screen. The server only releases an answer once it has passed every safety check, so the
 * phone has the whole reply and plays it out: a steady 10 ms a letter, never under 0.5 s or over 3 s in all.
 */
export const typingMs = (length: number) => Math.min(3000, Math.max(500, length * 10));

/** How many letters of a reply `length` long are showing `elapsed` ms after it started typing. Pure. */
export const typedAt = (length: number, elapsed: number) => Math.min(length, Math.max(0, Math.ceil((length * elapsed) / typingMs(length))));

/**
 * Helplines in Pango's crisis replies, to show as call buttons. Only the fixed numbers the server's crisis replies use,
 * never a number from an ordinary answer.
 */
const HELPLINES = ['0800 567 567', '0800 456 789', '0861 322 322', '112', '10111'];
export const helplinesIn = (m: CoachMessage) => (m.kind === 'crisis' ? HELPLINES.filter((n) => new RegExp(`(^|\\D)${n}(\\D|$)`).test(m.content)) : []);
export const telUrl = (n: string) => `tel:${n.replace(/\s/g, '')}`;

/** What to tell the person when a message did not go through. */
export function coachProblem(e: unknown): { title: string; body: string; plus: boolean } {
  const err = e instanceof ApiError ? e : null;
  if (err?.code === 'quota_exceeded') return { title: "That's today's questions", body: 'Pango Plus gives you many more each day. Or come back tomorrow.', plus: true };
  if (err?.code === 'feature_disabled' || err?.status === 503) return { title: 'Pango is resting', body: 'Ask Pango is switched off for a moment. Try again a bit later.', plus: false };
  if (!err || err.status === 0) return { title: 'Pango needs a connection', body: 'Check your internet and try again.', plus: false };
  if (err.status === 429) return { title: 'Slow down a little', body: 'Give Pango a minute, then try again.', plus: false };
  return { title: 'Pango could not answer', body: err.message, plus: false };
}

/** A recipe from the groceries, as a diary entry. */
export const recipeEntry = (r: PantryRecipe, mealType: MealType): NewEntry => ({
  name: r.title,
  calories: r.nutrition.calories,
  proteinG: r.nutrition.proteinG,
  carbG: r.nutrition.carbG,
  fatG: r.nutrition.fatG,
  quantityG: Math.round(r.ingredients.reduce((s, i) => s + i.grams, 0)),
  mealType,
  source: 'food',
});

export const addToPantry = (items: PantryItem[], item: PantryItem): PantryItem[] => (items.some((i) => i.id === item.id) ? items : [...items, item].slice(-MAX_PANTRY));
