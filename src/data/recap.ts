import { dateAt, shiftDate, weekStart } from './dates';
import type { DiaryEntry } from './repo';
import type { Goals } from './settings';

export type Recap = {
  start: string;
  end: string;
  daysLogged: number;
  /** Days logged the week before (null when there was nothing before this week). */
  previousDays: number | null;
  /** True when no earlier week had more days logged. */
  bestYet: boolean;
  /** Protein per day, Monday to Sunday. */
  protein: number[];
  proteinHero: { date: string; grams: number } | null;
  mostLogged: { name: string; times: number } | null;
  streak: number;
  tip: string;
};

/**
 * The weekly recap, worked out on the phone from the diary. `history` is every entry before `start`, for comparing
 * with earlier weeks.
 */
export function buildRecap(input: {
  start: string;
  week: DiaryEntry[];
  history: DiaryEntry[];
  waterByDay: Map<string, number>;
  goals: Goals;
  waterGoalMl: number;
  streak: number;
}): Recap {
  const { start, week, goals } = input;
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(start, i));
  const kcal = new Map<string, number>();
  const protein = new Map<string, number>();
  const names = new Map<string, { name: string; times: number }>();
  for (const e of week) {
    kcal.set(e.localDate, (kcal.get(e.localDate) ?? 0) + e.calories);
    protein.set(e.localDate, (protein.get(e.localDate) ?? 0) + e.proteinG);
    const k = e.name.trim().toLowerCase();
    if (e.name !== 'Quick add') names.set(k, { name: e.name, times: (names.get(k)?.times ?? 0) + 1 });
  }
  const logged = days.filter((d) => kcal.has(d));
  const perWeek = new Map<string, Set<string>>();
  for (const e of input.history) {
    const w = weekStart(e.localDate);
    perWeek.set(w, (perWeek.get(w) ?? new Set()).add(e.localDate));
  }
  const previous = perWeek.get(shiftDate(start, -7));
  const best = Math.max(0, ...[...perWeek.values()].map((s) => s.size));
  const heroDay = logged.reduce<string | null>((b, d) => ((protein.get(d) ?? 0) > (b ? (protein.get(b) ?? 0) : -1) ? d : b), null);
  const top = [...names.values()].sort((a, b) => b.times - a.times)[0];

  const lowProtein = logged.filter((d) => (protein.get(d) ?? 0) < goals.proteinG).length;
  const over = logged.filter((d) => (kcal.get(d) ?? 0) > goals.calories * 1.1).length;
  const waterDays = days.filter((d) => (input.waterByDay.get(d) ?? 0) >= input.waterGoalMl).length;
  let tip = 'A strong week. Keep doing what you are doing.';
  if (logged.length < 4) tip = 'Log something every day, even a quick add. A streak starts with one day.';
  else if (lowProtein >= 4) tip = `Protein was under your goal on ${lowProtein} days. Add eggs, yoghurt, beans or chicken to one more meal.`;
  else if (over >= 3) tip = `You went over your calorie goal on ${over} days. "What fits?" can help plan the evening meal.`;
  else if (waterDays < 3) tip = 'Water was under your goal most days. Keep a bottle where you can see it.';

  return {
    start,
    end: days[6],
    daysLogged: logged.length,
    previousDays: perWeek.size ? (previous?.size ?? 0) : null,
    bestYet: perWeek.size > 0 && logged.length > 0 && logged.length >= best,
    protein: days.map((d) => Math.round(protein.get(d) ?? 0)),
    proteinHero: heroDay ? { date: heroDay, grams: Math.round(protein.get(heroDay) ?? 0) } : null,
    mostLogged: top && top.times > 1 ? top : null,
    streak: input.streak,
    tip,
  };
}

/** The sentence under "N of 7 days logged". */
export function consistencyLine(r: Recap): string {
  if (r.daysLogged === 0) return 'A quiet week. Next week is a fresh start.';
  if (r.daysLogged === 7) return 'Every single day. Brilliant.';
  if (r.bestYet) return 'Your most consistent week yet.';
  if (r.previousDays !== null && r.daysLogged > r.previousDays) return `${r.daysLogged - r.previousDays} more than the week before.`;
  return 'Every day logged counts.';
}

/** Text for sharing: numbers only, nothing about weight or food. */
export function shareText(r: Recap, rangeLabel: string): string {
  const streak = r.streak > 1 ? ` and a ${r.streak}-day streak` : '';
  return `My week with Pango (${rangeLabel}): ${r.daysLogged} of 7 days logged${streak}.`;
}

export const weekdayName = (d: string) => dateAt(d).toLocaleDateString('en-ZA', { weekday: 'long' });
