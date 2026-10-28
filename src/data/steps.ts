import { shiftDate } from './dates';
import type { ActivityLevel } from './goals';

/**
 * Steps and the energy they use. Pure functions.
 *
 * Distance comes from stride length, about 41% of height. Energy is the net cost of walking on the flat from the ACSM
 * walking equation (0.1 mL of oxygen per kg per metre, about 0.5 kcal per kg per km): what walking burns on top of
 * resting, which the calorie goal already covers. Both are estimates and shown as "about".
 */
export const DEFAULT_STEP_GOAL = 8000;
export const DEFAULT_BURN_GOAL = 300;
export const STEP_GOAL_RANGE = { min: 2000, max: 30000, step: 500 } as const;
export const BURN_GOAL_RANGE = { min: 100, max: 1500, step: 50 } as const;

/** Used when the profile has no height or weight yet: round adult figures, not a claim about anyone. */
const DEFAULT_HEIGHT_CM = 170;
const DEFAULT_WEIGHT_KG = 70;

export type Body = { heightCm?: number | null; weightKg?: number | null };

export const kmForSteps = (steps: number, body: Body = {}) => (steps * (body.heightCm ?? DEFAULT_HEIGHT_CM) * 0.414) / 100 / 1000;

export const kcalForSteps = (steps: number, body: Body = {}) => Math.round(0.5 * (body.weightKg ?? DEFAULT_WEIGHT_KG) * kmForSteps(steps, body));

/**
 * The steps a usual day at each activity level already counts in the calorie goal, from the step bands of
 * Tudor-Locke and Bassett (under 5,000 a day is sedentary, 7,500 somewhat active, 10,000 active, 12,500 highly active).
 */
export const USUAL_STEPS: Record<ActivityLevel, number> = { sedentary: 5000, light: 7500, moderate: 10000, active: 12500, very_active: 15000 };

/** Steps beyond a usual day for the activity level (light when unknown): only these add to the food budget. */
export const extraSteps = (steps: number, level: ActivityLevel | null | undefined) => Math.max(0, steps - USUAL_STEPS[level ?? 'light']);

/**
 * A typed step count. Steps are whole, so spaces, commas and points are only thousands separators ("12 000", "12,000"
 * and "12.000" are all twelve thousand). Null when it is not a count from 1 to 100,000. Pure.
 */
export function parseSteps(text: string): number | null {
  const t = text.trim();
  if (!/^\d[\d\s,.\u00a0]*$/.test(t)) return null;
  const n = Number(t.replace(/[^\d]/g, ''));
  return n >= 1 && n <= 100000 ? n : null;
}

/** Days in a row on which the goal was reached, counting back from today (or from yesterday while today is not there yet). */
export function goalStreak(byDay: ReadonlyMap<string, number>, goal: number, today: string): number {
  let day = (byDay.get(today) ?? 0) >= goal ? today : shiftDate(today, -1);
  let n = 0;
  while ((byDay.get(day) ?? 0) >= goal) {
    n++;
    day = shiftDate(day, -1);
  }
  return n;
}

/** Streak lengths worth a word of their own. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 365];

export type Celebration = { key: string; title: string; lines: string[] };

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/**
 * What to celebrate today, given today's steps and energy burned, the goals, the streak (including today) and the best
 * earlier day. Each has a key, so each is shown once a day; several at once are folded into one celebration. Pure.
 */
export function celebrationFor(input: {
  today: string;
  steps: number;
  stepGoal: number;
  burned: number;
  burnGoal: number;
  streak: number;
  best: number | null;
  shown: ReadonlySet<string>;
}): Celebration | null {
  const { today, steps, stepGoal, burned, burnGoal, streak, best, shown } = input;
  const due: { key: string; title: string; line: string }[] = [];
  if (steps >= stepGoal) due.push({ key: `steps:${today}`, title: `${fmt(steps)} steps!`, line: `You reached your ${fmt(stepGoal)}-step goal.` });
  if (burned >= burnGoal) due.push({ key: `burn:${today}`, title: `${fmt(burned)} kcal burned!`, line: `You reached your goal of ${fmt(burnGoal)} kcal burned.` });
  // A best only counts once there is something to beat and the goal is met, so a first day is not a "record".
  if (best !== null && steps > best && steps >= stepGoal) due.push({ key: `best:${today}`, title: 'A new personal best!', line: `${fmt(steps)} steps beats your best of ${fmt(best)}.` });
  if (STREAK_MILESTONES.includes(streak) && steps >= stepGoal) due.push({ key: `streak:${today}`, title: `${streak} days in a row!`, line: `That's ${streak} days in a row on your step goal.` });
  const fresh = due.filter((d) => !shown.has(d.key));
  if (!fresh.length) return null;
  // The biggest news leads: a streak milestone, then a best, then the goals.
  const order = ['streak', 'best', 'steps', 'burn'];
  fresh.sort((a, b) => order.indexOf(a.key.split(':')[0]) - order.indexOf(b.key.split(':')[0]));
  return { key: fresh.map((d) => d.key).join('|'), title: fresh[0].title, lines: fresh.map((d) => d.line) };
}
