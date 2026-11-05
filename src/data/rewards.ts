import { ApiError } from '../api/errors';
import type { components } from '../api/schema';
import { parseNumber } from './entryForm';

export type Rewards = components['schemas']['Rewards'];
export type FoodInput = components['schemas']['FoodInput'];

/** What a line in the points history was for. */
export const REASON_LABEL: Record<string, string> = {
  food: 'Added a food to the food list',
  food_removed: 'A food you added was deleted',
  invited_friend: 'A friend you invited joined in',
  joined_with_invite: 'Joined with a friend’s invite',
  partner_welcome: 'Joined with your gym’s code',
  redeemed: 'A month of Plus',
  adjustment: 'Adjusted by Pango',
};

/** What to say when a code did not work, from the server's reason. */
export function codeProblem(e: unknown): string {
  const reason = e instanceof ApiError ? (e.details as { reason?: string } | undefined)?.reason : undefined;
  switch (reason) {
    case 'unknown_code':
      return 'No code like that. Check the spelling and try again.';
    case 'own_code':
      return 'That is your own code. Share it with friends instead.';
    case 'invite_already_used':
      return 'You have already used a friend’s code.';
    case 'partner_already_set':
      return 'You have already joined with a gym’s code.';
    case 'code_inactive':
      return 'That code is no longer running.';
    case 'code_window_closed':
      return 'Codes can only be entered in the first 30 days after joining.';
  }
  if (e instanceof ApiError && e.status === 0) return 'Pango needs a connection to check a code.';
  if (e instanceof ApiError && e.status === 429) return 'Too many tries. Wait a little and try again.';
  return e instanceof ApiError ? e.message : 'That did not work. Try again.';
}

/** The message friends get when someone shares their code. */
export const inviteMessage = (code: string) =>
  `Join me on Pango, the calorie tracker with a pangolin coach. Enter my code ${code} in the app (Me, then Pango Points) in your first 30 days and we both get Pango Points towards free Plus.`;

/** How far points are towards a month of Plus, 0 to 1. Pure. */
export const towardsMonth = (r: Pick<Rewards, 'points' | 'monthCost'>) => Math.min(1, Math.max(0, r.points / r.monthCost));

export type FoodForm = { name: string; brand: string; barcode: string; calories: string; protein: string; carbs: string; fat: string; serving: string };
export type FoodFormErrors = Partial<Record<keyof FoodForm, string>>;

/** Whether the numbers hang together: energy close to 4 kcal a gram of protein and carbs and 9 of fat (as the server checks). */
export function addsUp(n: { calories: number; protein: number; carbs: number; fat: number }): boolean {
  if (n.calories <= 0 || n.protein + n.carbs + n.fat > 100) return false;
  return Math.abs(4 * n.protein + 4 * n.carbs + 9 * n.fat - n.calories) <= Math.max(30, n.calories * 0.35);
}

/** Reads the form; numbers are per 100 g as printed on the pack. */
export function parseFoodForm(f: FoodForm): { ok: true; value: { name: string; brand: string | null; barcode: string | null; calories100g: number; protein100g: number; carb100g: number; fat100g: number; servingG: number | null } } | { ok: false; errors: FoodFormErrors } {
  const errors: FoodFormErrors = {};
  if (!f.name.trim()) errors.name = 'What is it called?';
  const barcode = f.barcode.replace(/\s/g, '');
  if (barcode && !/^\d{8}$|^\d{12,14}$/.test(barcode)) errors.barcode = 'A barcode is 8, 12, 13 or 14 digits.';
  const num = (key: 'calories' | 'protein' | 'carbs' | 'fat', max: number, required = true) => {
    const n = parseNumber(f[key]);
    if (n === null) {
      if (required) errors[key] = 'From the label, per 100 g.';
      return 0;
    }
    if (Number.isNaN(n) || n < 0 || n > max) errors[key] = `0 to ${max}.`;
    return n;
  };
  const calories = num('calories', 900);
  const protein = num('protein', 100);
  const carbs = num('carbs', 100);
  const fat = num('fat', 100);
  const serving = parseNumber(f.serving);
  if (serving !== null && (Number.isNaN(serving) || serving <= 0 || serving > 2000)) errors.serving = 'Grams in one serving, 1 to 2 000.';
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name: f.name.trim(), brand: f.brand.trim() || null, barcode: barcode || null, calories100g: calories, protein100g: protein, carb100g: carbs, fat100g: fat, servingG: serving } };
}

