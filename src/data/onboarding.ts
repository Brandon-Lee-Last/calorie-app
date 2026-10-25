import type { ActivityLevel, GoalType, Sex } from './goals';
import { parseNumber } from './entryForm';

export const GOALS: readonly { value: GoalType; title: string; hint: string }[] = [
  { value: 'lose', title: 'Lose weight', hint: 'A steady deficit, never crash diets' },
  { value: 'maintain', title: 'Stay where I am', hint: 'Keep eating well and build habits' },
  { value: 'gain', title: 'Build muscle', hint: 'Enough fuel and protein to grow' },
];

export const ACTIVITY: readonly { value: ActivityLevel; title: string; hint: string }[] = [
  { value: 'sedentary', title: 'Mostly sitting', hint: 'Desk job, little exercise' },
  { value: 'light', title: 'Lightly active', hint: 'On your feet a bit, or exercise 1 to 3 days a week' },
  { value: 'moderate', title: 'Active', hint: 'Exercise 3 to 5 days a week' },
  { value: 'active', title: 'Very active', hint: 'Hard exercise 6 or 7 days a week' },
  { value: 'very_active', title: 'Athlete', hint: 'Physical job plus training, or two sessions a day' },
];

/** Weekly pace choices for a goal (kg per week). The first marked `default` is chosen to start with. */
export const RATES: Record<GoalType, readonly { value: number; label: string; default?: boolean }[]> = {
  lose: [
    { value: 0.25, label: '¼ kg' },
    { value: 0.5, label: '½ kg', default: true },
    { value: 0.75, label: '¾ kg' },
  ],
  maintain: [],
  gain: [
    { value: 0.25, label: '¼ kg', default: true },
    { value: 0.5, label: '½ kg' },
  ],
};

export const defaultRate = (goal: GoalType) => RATES[goal].find((r) => r.default)?.value ?? 0;

export type AboutForm = { sex: Sex | 'unsaid'; birthYear: string; heightCm: string; weightKg: string };
export type AboutErrors = Partial<Record<keyof AboutForm, string>>;
export type About = { sex: Sex | null; birthYear: number; heightCm: number; weightKg: number };

/** Checks the "about you" answers. Limits sit inside the server's (birth year 1900+, 50-260 cm, 20-400 kg). */
export function parseAbout(form: AboutForm, now: number = Date.now()): { ok: true; value: About } | { ok: false; errors: AboutErrors } {
  const errors: AboutErrors = {};
  const year = new Date(now).getFullYear();
  const birthYear = parseNumber(form.birthYear);
  if (birthYear === null) errors.birthYear = 'Enter the year you were born.';
  else if (!Number.isInteger(birthYear) || birthYear < year - 110 || birthYear > year - 13) errors.birthYear = 'Pango is for ages 13 and up. Check the year.';
  const heightCm = parseNumber(form.heightCm);
  if (heightCm === null) errors.heightCm = 'Enter your height.';
  else if (Number.isNaN(heightCm) || heightCm < 100 || heightCm > 250) errors.heightCm = 'Enter centimetres, from 100 to 250.';
  const weightKg = parseNumber(form.weightKg);
  if (weightKg === null) errors.weightKg = 'Enter your weight.';
  else if (Number.isNaN(weightKg) || weightKg < 30 || weightKg > 300) errors.weightKg = 'Enter kilograms, from 30 to 300.';
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: { sex: form.sex === 'unsaid' ? null : form.sex, birthYear: birthYear!, heightCm: Math.round(heightCm! * 10) / 10, weightKg: Math.round(weightKg! * 10) / 10 },
  };
}

/** "lose about 0.5 kg a week" for the plan summary. */
export function paceText(goal: GoalType, rate: number): string {
  if (goal === 'maintain') return 'stay about where you are';
  const kg = rate.toLocaleString('en-ZA', { maximumFractionDigits: 2 });
  return `${goal === 'lose' ? 'lose' : 'gain'} about ${kg} kg a week`;
}
