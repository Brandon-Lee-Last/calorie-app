import { computeStats, longestRun, type Stats } from '../src/data/achievements';
import { atDate } from '../src/data/history';
import { parseGoals } from '../src/data/goalForm';
import { dayMark, lastWeek, monthGrid, rangeText, signed, weightSeries } from '../src/data/progress';
import { buildRecap, consistencyLine, shareText } from '../src/data/recap';
import type { DiaryEntry } from '../src/data/repo';
import type { WeightRecord } from '../src/data/tables';
import { CLASSIC_LOOK, WARDROBE, blockerFor, describeLook, earnedIds, lookForOutfit, stateOf } from '../src/pango/wardrobe';
import { BUILT_IN, caloriesBurned, fromServer, usesWeight } from '../src/train/library';
import { setText, startSets, targetText, toSetLogs } from '../src/train/session';

const goals = { calories: 2000, proteinG: 120, carbG: 220, fatG: 65 };
let n = 0;
const entry = (date: string, calories: number, extra: Partial<DiaryEntry> = {}): DiaryEntry =>
  ({ id: `e${++n}`, name: 'Meal', localDate: date, loggedAt: atDate(date, new Date(2026, 0, 1, 12).getTime()), calories, proteinG: 30, carbG: 50, fatG: 10, quantityG: null, mealType: 'lunch', source: 'manual', ...extra }) as DiaryEntry;
const stats = (patch: Partial<Stats> = {}): Stats => ({
  bestStreak: 0, currentStreak: 0, daysLogged: 0, meals: 0, typedMeals: 0, scans: 0, workouts: 0, weekends: 0, recaps: 0, proteinDays: 0, goalDays: 0, waterRun: 0, rooibos: 0, veg: 0, sharedRecap: 0, ...patch,
});

describe('achievements', () => {
  it('finds the longest run of days', () => {
    expect(longestRun(['2026-10-01', '2026-10-02', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-06'])).toBe(3);
    expect(longestRun([])).toBe(0);
  });

  it('works out stats from the diary, water and workouts', () => {
    const today = '2026-10-25'; // a Sunday
    const entries = [
      entry('2026-10-17', 1800, { name: 'Rooibos with milk', source: 'scan' }), // Saturday, last week
      entry('2026-10-18', 1900, { proteinG: 130, name: 'Greek salad' }), // Sunday, same weekend
      entry('2026-10-19', 2600, { source: 'barcode' }),
      entry('2026-10-24', 1500, { name: 'Butternut soup' }), // Saturday, this week
      entry('2026-10-25', 400),
    ];
    const s = computeStats({ entries, waterByDay: new Map([['2026-10-20', 2600], ['2026-10-21', 2500], ['2026-10-23', 3000]]), workouts: 2, goals, waterGoalMl: 2500, today, sharedRecap: true });
    expect(s).toEqual({
      bestStreak: 3, currentStreak: 2, daysLogged: 5, meals: 5, typedMeals: 3, scans: 1, workouts: 2, weekends: 2, recaps: 1,
      proteinDays: 1, goalDays: 2, waterRun: 2, rooibos: 1, veg: 2, sharedRecap: 1,
    });
  });
});

describe('wardrobe', () => {
  it('opens items as the stats reach them, with progress while locked', () => {
    const gym = WARDROBE.outfit.find((i) => i.id === 'gym')!;
    expect(stateOf(gym, stats({ workouts: 2 }))).toEqual({ open: false, how: 'Unlocks with 5 workouts (2 so far)', progress: 0.4 });
    expect(stateOf(gym, stats({ workouts: 5 }))).toMatchObject({ open: true, how: 'Earned for 5 workouts' });
    expect(stateOf(WARDROBE.outfit[0], null)).toMatchObject({ open: true });
    expect(stateOf(WARDROBE.scarf.find((i) => i.name === 'Ink')!, stats({ scans: 0 })).how).toBe('Unlocks with your first scan (0 so far)');
  });

  it('only lets earned looks be worn; a whole earned outfit counts', () => {
    expect(blockerFor(lookForOutfit('party'), stats({ bestStreak: 6 }))).toBe('Unlocks with a 14-day streak (6 so far)');
    expect(blockerFor(lookForOutfit('party'), stats({ bestStreak: 14 }))).toBeNull();
    expect(blockerFor({ ...CLASSIC_LOOK, outfit: 'custom', hat: 'crown' }, stats({ bestStreak: 14 }))).toBe('Unlocks with a 30-day streak (14 so far)');
    expect(blockerFor(CLASSIC_LOOK, null)).toBeNull();
  });

  it('describes looks and lists what is earned', () => {
    expect(describeLook(lookForOutfit('gym'))).toBe('Gym: band, periwinkle scarf');
    expect(describeLook(CLASSIC_LOOK)).toBe('Guava scarf');
    expect(earnedIds(stats({ workouts: 5 }))).toEqual(['outfit:gym', 'hat:headband', 'pin:bolt']);
  });

  it('has every item the Pango art can draw', () => {
    for (const items of Object.values(WARDROBE)) expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    expect(WARDROBE.outfit.map((i) => i.id)).toEqual(['none', 'gym', 'chef', 'beach', 'winter', 'party', 'royal', 'protea', 'scholar', 'weekend']);
  });
});

describe('progress', () => {
  const w = (date: string, kg: number): WeightRecord => ({ id: date, loggedAt: atDate(date, 0), localDate: date, weightKg: kg, note: null, clientUpdatedAt: 0, updatedAt: 0, deletedAt: null, rev: 0 });

  it('takes the last weigh-in per day over the range, with the change', () => {
    const s = weightSeries([w('2026-09-01', 90), w('2026-10-20', 85.1), w('2026-10-22', 84.9), w('2026-10-22', 84.6), w('2026-10-25', 84.2)], '2026-10-25', 'week');
    expect(s.points.map((p) => p.y)).toEqual([85.1, 84.6, 84.2]);
    expect(s).toMatchObject({ latest: 84.2, delta: -0.9, since: 'since Tuesday' });
    expect(signed(-0.9)).toMatch(/^−0[.,]9$/);
    expect(weightSeries([], '2026-10-25', 'month')).toMatchObject({ points: [], latest: null, delta: null });
  });

  it('marks days and lays out the month from Monday', () => {
    expect(dayMark('2026-10-20', 1800, 2000, '2026-10-25')).toBe('on');
    expect(dayMark('2026-10-20', 2400, 2000, '2026-10-25')).toBe('logged');
    expect(dayMark('2026-10-20', undefined, 2000, '2026-10-25')).toBe('missed');
    expect(dayMark('2026-10-25', undefined, 2000, '2026-10-25')).toBe('today-empty');
    expect(dayMark('2026-10-26', undefined, 2000, '2026-10-25')).toBe('future');
    const grid = monthGrid('2026-10-25'); // 1 October 2026 is a Thursday
    expect(grid.slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
    expect(grid).toHaveLength(3 + 31);
  });

  it('names last week', () => {
    expect(lastWeek('2026-10-25')).toEqual({ start: '2026-10-12', end: '2026-10-18' });
    expect(rangeText('2026-10-12', '2026-10-18')).toBe('12 to 18 October');
    expect(rangeText('2026-09-28', '2026-10-04')).toBe('28 September to 4 October');
  });
});

describe('weekly recap', () => {
  it('counts the week, finds the protein hero and most logged, and picks one tip', () => {
    const week = [
      entry('2026-10-12', 1900, { proteinG: 140, name: 'Rooibos with milk' }),
      entry('2026-10-13', 1800, { proteinG: 90, name: 'Rooibos with milk' }),
      entry('2026-10-14', 2500, { proteinG: 80, name: 'Pap' }),
      entry('2026-10-16', 2400, { proteinG: 60, name: 'Bobotie' }),
      entry('2026-10-18', 2300, { proteinG: 70, name: 'Braai' }),
    ];
    const r = buildRecap({ start: '2026-10-12', week, history: [entry('2026-10-05', 2000), entry('2026-10-06', 2000)], waterByDay: new Map(), goals, waterGoalMl: 2500, streak: 4 });
    expect(r).toMatchObject({ daysLogged: 5, previousDays: 2, bestYet: true, proteinHero: { date: '2026-10-12', grams: 140 }, mostLogged: { name: 'Rooibos with milk', times: 2 }, streak: 4 });
    expect(r.protein).toEqual([140, 90, 80, 0, 60, 0, 70]);
    expect(r.tip).toMatch(/^Protein was under your goal on 4 days/);
    expect(consistencyLine(r)).toBe('Your most consistent week yet.');
    expect(shareText(r, '12 to 18 October')).toBe('My week with Pango (12 to 18 October): 5 of 7 days logged and a 4-day streak.');
  });

  it('handles an empty first week', () => {
    const r = buildRecap({ start: '2026-10-12', week: [], history: [], waterByDay: new Map(), goals, waterGoalMl: 2500, streak: 0 });
    expect(r).toMatchObject({ daysLogged: 0, previousDays: null, bestYet: false, proteinHero: null, mostLogged: null });
    expect(consistencyLine(r)).toBe('A quiet week. Next week is a fresh start.');
  });
});

describe('training', () => {
  it('has built-in workouts the server will accept', () => {
    for (const w of BUILT_IN) {
      expect(w.exercises.length).toBeGreaterThan(2);
      for (const e of w.exercises) {
        expect(e.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        expect(e.slug.length).toBeLessThanOrEqual(80);
        expect(e.durationS || (e.repsMin && e.repsMax)).toBeTruthy();
      }
    }
    expect(new Set(BUILT_IN.map((w) => w.key)).size).toBe(BUILT_IN.length);
  });

  it('starts sets from last time and keeps only done sets for the server', () => {
    const dumbbell = BUILT_IN.find((w) => w.key === 'builtin:dumbbell')!;
    const squat = dumbbell.exercises[0];
    expect(usesWeight(squat)).toBe(true);
    const sets = startSets(squat, [{ exercise: squat.slug, setNo: 1, reps: 10, weightKg: 14 }]);
    expect(sets).toEqual([
      { kg: 14, reps: 10, durationS: 30, done: false },
      { kg: 14, reps: 10, durationS: 30, done: false },
      { kg: 14, reps: 10, durationS: 30, done: false },
    ]);
    const live = dumbbell.exercises.map((e) => startSets(e, []));
    live[0][0] = { ...live[0][0], kg: 16, done: true };
    expect(toSetLogs(dumbbell, live)).toEqual([{ exercise: 'goblet-squat', setNo: 1, reps: 12, weightKg: 16, durationS: null }]);
    expect(setText(live[0][0], false)).toBe('16 × 12');
    expect(targetText(squat)).toBe('3 × 8 to 12');
  });

  it('estimates energy from MET and body weight', () => {
    expect(caloriesBurned('strength', 30, 80)).toBe(210);
    expect(caloriesBurned('mobility', 15, 60)).toBe(39);
  });

  it('reads a server workout into the same shape', () => {
    const plan = fromServer(
      {
        id: 'w1', key: 'w1d1', programSlug: 'starter', programTitle: 'Starter', week: 1, day: 1, title: 'Day 1', notes: null, estMinutes: 20, tier: 'free',
        exercises: [
          { position: 2, exercise: { slug: 'plank', name: 'Plank', muscleGroups: ['abs'], equipment: ['bodyweight'], difficulty: 'beginner', instructions: '', tips: 'Breathe', imageMediaId: null, videoMediaId: null, source: null, licence: null }, sets: 3, repsMin: null, repsMax: null, durationS: 30, restS: 45, notes: null },
          { position: 1, exercise: { slug: 'push-up', name: 'Push-up', muscleGroups: ['chest'], equipment: ['bodyweight'], difficulty: 'beginner', instructions: '', tips: null, imageMediaId: null, videoMediaId: null, source: null, licence: null }, sets: 3, repsMin: 5, repsMax: 10, durationS: null, restS: null, notes: null },
        ],
      } as never,
      'p1',
    );
    expect(plan).toMatchObject({ key: 'server:w1', workoutId: 'w1', programId: 'p1', minutes: 20 });
    expect(plan.exercises.map((e) => [e.slug, e.restS, e.cue])).toEqual([['push-up', 60, null], ['plank', 45, 'Breathe']]);
  });
});

describe('goal form', () => {
  it('keeps goals inside the server limits', () => {
    expect(parseGoals({ calories: '1 900', proteinG: '150', carbG: '180', fatG: '60' })).toEqual({ ok: true, value: { calories: 1900, proteinG: 150, carbG: 180, fatG: 60 } });
    expect(parseGoals({ calories: '500', proteinG: '', carbG: '180', fatG: '2000' })).toEqual({ ok: false, errors: { calories: expect.any(String), proteinG: expect.any(String), fatG: expect.any(String) } });
  });
});
