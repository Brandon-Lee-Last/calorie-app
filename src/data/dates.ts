/** A calendar date in the phone's own time zone, written YYYY-MM-DD (what the server calls `localDate`). */
export function localDate(at: number | Date = Date.now()): string {
  const d = typeof at === 'number' ? new Date(at) : at;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `date` moved by `delta` days (negative goes back), both YYYY-MM-DD. */
export function shiftDate(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return localDate(new Date(y, m - 1, d + delta));
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** A sensible default meal for the time of day. */
export function mealForTime(at: number | Date = Date.now()): MealType {
  const h = (typeof at === 'number' ? new Date(at) : at).getHours();
  if (h >= 4 && h < 11) return 'breakfast';
  if (h >= 11 && h < 15) return 'lunch';
  if (h >= 17 && h < 22) return 'dinner';
  return 'snack';
}

/**
 * Days in a row with something logged, counting back from today. A day with nothing logged yet does not break the
 * streak until it is over, so the count starts from yesterday when today is still empty.
 */
export function streak(loggedDates: Iterable<string>, today: string = localDate()): number {
  const days = new Set(loggedDates);
  let day = days.has(today) ? today : shiftDate(today, -1);
  let n = 0;
  while (days.has(day)) {
    n++;
    day = shiftDate(day, -1);
  }
  return n;
}
