import { dateAt, shiftDate, weekStart } from './dates';
import type { WeightRecord } from './tables';

export type Range = 'week' | 'month' | 'quarter' | 'year';
export const RANGE_DAYS: Record<Range, number> = { week: 7, month: 30, quarter: 91, year: 365 };
export const RANGES: { value: Range; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: '3 mo' },
  { value: 'year', label: 'Year' },
];

const shortDate = (d: string) => dateAt(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });

/** The weight trend over a range: the day's last weigh-in for each day, the change, and three axis labels. */
export function weightSeries(weights: WeightRecord[], today: string, range: Range) {
  const from = shiftDate(today, -(RANGE_DAYS[range] - 1));
  const byDay = new Map<string, WeightRecord>();
  for (const w of weights) if (w.localDate >= from && w.localDate <= today) byDay.set(w.localDate, w); // oldest first, so the last one wins
  const days = [...byDay.keys()].sort();
  const points = days.map((d) => ({ x: dateAt(d).getTime(), y: byDay.get(d)!.weightKg }));
  const first = days[0];
  const latest = days.length ? byDay.get(days[days.length - 1])!.weightKg : null;
  const delta = days.length > 1 ? Math.round((points[points.length - 1].y - points[0].y) * 10) / 10 : null;
  const since = first ? (range === 'week' ? `since ${dateAt(first).toLocaleDateString('en-ZA', { weekday: 'long' })}` : `since ${shortDate(first)}`) : '';
  const mid = shiftDate(from, Math.floor(RANGE_DAYS[range] / 2));
  return { points, latest, delta, since, ticks: [shortDate(from), shortDate(mid), 'Today'] as const };
}

export const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('en-ZA', { maximumFractionDigits: 1 })}`;

export type DayMark = 'on' | 'logged' | 'missed' | 'future' | 'today-empty';

/** How a day went: on target is 80% to 105% of the calorie goal. */
export function dayMark(date: string, kcal: number | undefined, goal: number, today: string): DayMark {
  if (date > today) return 'future';
  if (kcal === undefined) return date === today ? 'today-empty' : 'missed';
  return kcal >= goal * 0.8 && kcal <= goal * 1.05 ? 'on' : 'logged';
}

/** The month holding `date` as Monday-first weeks; null pads the first week. */
export function monthGrid(date: string): (string | null)[] {
  const first = `${date.slice(0, 7)}-01`;
  const lead = Math.round((dateAt(first).getTime() - dateAt(weekStart(first)).getTime()) / 86_400_000);
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = first; d.slice(0, 7) === first.slice(0, 7); d = shiftDate(d, 1)) cells.push(d);
  return cells;
}

/** Monday to Sunday of the week before the one holding `today`. */
export function lastWeek(today: string): { start: string; end: string } {
  const start = shiftDate(weekStart(today), -7);
  return { start, end: shiftDate(start, 6) };
}

/** "12 to 18 October" or "28 September to 4 October". */
export function rangeText(start: string, end: string): string {
  const s = dateAt(start);
  const e = dateAt(end);
  const month = (d: Date) => d.toLocaleDateString('en-ZA', { month: 'long' });
  return s.getMonth() === e.getMonth() ? `${s.getDate()} to ${e.getDate()} ${month(e)}` : `${s.getDate()} ${month(s)} to ${e.getDate()} ${month(e)}`;
}
