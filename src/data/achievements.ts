import { dateAt, shiftDate, streak, weekStart } from './dates';
import type { DiaryEntry } from './repo';
import type { Goals } from './settings';

/**
 * What the person has done, worked out from data that syncs (diary, water, workouts), so what they have earned
 * follows them to a new phone. Only `sharedRecap` is kept on the phone.
 */
export type Stats = {
  /** Longest run of days with something logged, ever. */
  bestStreak: number;
  currentStreak: number;
  daysLogged: number;
  meals: number;
  /** Meals typed in by hand (not scanned or from a barcode). */
  typedMeals: number;
  scans: number;
  workouts: number;
  /** Weekends (Saturday or Sunday) with something logged. */
  weekends: number;
  /** Finished weeks (Monday to Sunday) with something logged: each one had a weekly recap. */
  recaps: number;
  /** Days where protein reached the goal. */
  proteinDays: number;
  /** Finished days that landed between 80% and 105% of the calorie goal. */
  goalDays: number;
  /** Longest run of days reaching the water goal. */
  waterRun: number;
  rooibos: number;
  /** Entries that sound like vegetables (salad, spinach, butternut...). */
  veg: number;
  sharedRecap: number;
};

export type StatKey = keyof Stats;

const VEG = ['salad', 'veg', 'spinach', 'broccoli', 'carrot', 'cabbage', 'bean', 'pea', 'pumpkin', 'butternut', 'tomato', 'lettuce', 'greens', 'morogo', 'chakalaka', 'cucumber', 'pepper', 'onion', 'beetroot', 'sweet potato', 'cauli', 'kale', 'mushroom', 'courgette', 'baby marrow', 'gem squash'];

/** Longest run of consecutive dates. */
export function longestRun(dates: Iterable<string>): number {
  const sorted = [...new Set(dates)].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev !== null && shiftDate(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export function computeStats(input: {
  entries: DiaryEntry[];
  waterByDay: Map<string, number>;
  workouts: number;
  goals: Goals;
  waterGoalMl: number;
  today: string;
  sharedRecap: boolean;
}): Stats {
  const { entries, goals, today } = input;
  const days = new Map<string, { kcal: number; protein: number }>();
  for (const e of entries) {
    const d = days.get(e.localDate) ?? { kcal: 0, protein: 0 };
    d.kcal += e.calories;
    d.protein += e.proteinG;
    days.set(e.localDate, d);
  }
  const dates = [...days.keys()];
  const thisWeek = weekStart(today);
  const weekends = new Set<string>();
  const weeks = new Set<string>();
  for (const d of dates) {
    const dow = dateAt(d).getDay();
    if (dow === 6) weekends.add(d);
    if (dow === 0) weekends.add(shiftDate(d, -1)); // a Sunday belongs to the Saturday before it
    const w = weekStart(d);
    if (w < thisWeek) weeks.add(w);
  }
  const lower = (s: string) => s.toLowerCase();
  return {
    bestStreak: longestRun(dates),
    currentStreak: streak(dates, today),
    daysLogged: dates.length,
    meals: entries.length,
    typedMeals: entries.filter((e) => e.source === 'manual' || e.source === 'quick_add').length,
    scans: entries.filter((e) => e.source === 'scan').length,
    workouts: input.workouts,
    weekends: weekends.size,
    recaps: weeks.size,
    proteinDays: [...days.values()].filter((d) => goals.proteinG > 0 && d.protein >= goals.proteinG).length,
    goalDays: [...days.entries()].filter(([d, v]) => d < today && v.kcal >= goals.calories * 0.8 && v.kcal <= goals.calories * 1.05).length,
    waterRun: longestRun([...input.waterByDay.entries()].filter(([, ml]) => ml >= input.waterGoalMl).map(([d]) => d)),
    rooibos: entries.filter((e) => lower(e.name).includes('rooibos')).length,
    veg: entries.filter((e) => VEG.some((v) => lower(e.name).includes(v))).length,
    sharedRecap: input.sharedRecap ? 1 : 0,
  };
}
