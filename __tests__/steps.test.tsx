import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import * as HC from 'react-native-health-connect';

import ActivityScreen from '../app/activity';
import Today from '../app/(tabs)/index';
import { CELEBRATED_KEY, CelebrationHost } from '../src/celebrate/Celebration';
import { localDate, shiftDate } from '../src/data/dates';
import { Repo } from '../src/data/repo';
import { SETTINGS_KEY } from '../src/data/settings';
import { celebrationFor, extraSteps, goalStreak, kcalForSteps, kmForSteps, parseSteps } from '../src/data/steps';
import { migrate } from '../src/db/migrations';
import { appName, FROM_HEALTH_CONNECT, hasSteps, readHealthSteps, STEPS_BACKFILLED_KEY, STEPS_LAST_READ_KEY, type StepSource } from '../src/steps/healthConnect';
import { mount, renderWith, settle, testStack } from './helpers/screen';
import { memoryDb } from './helpers/sqljsDb';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: jest.fn(() => ({})) }));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});
/** Health Connect is Android's; tests run as an iPhone unless told otherwise. */
const onAndroid = () => jest.replaceProperty(Platform, 'OS', 'android');

const days = (today: string, counts: number[]) => new Map(counts.map((n, i) => [shiftDate(today, i - counts.length + 1), n]));

describe('steps maths', () => {
  it('turns steps into distance and the energy walking uses on top of resting', () => {
    expect(kmForSteps(10000)).toBeCloseTo(7.04, 2); // a 170 cm stride is about 70 cm
    expect(kcalForSteps(10000)).toBe(246); // half a kcal per kg per km, at 70 kg
    expect(kcalForSteps(10000, { heightCm: 185, weightKg: 95 })).toBe(364); // longer strides, more weight
    expect(kcalForSteps(0)).toBe(0);
  });

  it('reads typed steps with any thousands separator', () => {
    expect(['12000', '12 000', '12,000', '12.000', ' 6500 '].map(parseSteps)).toEqual([12000, 12000, 12000, 12000, 6500]);
    expect(['', 'abc', '0', '-5', '100001', '1.5k'].map(parseSteps)).toEqual([null, null, null, null, null, null]);
  });

  it('counts only steps beyond a usual day for the activity level towards food', () => {
    expect(extraSteps(6000, 'sedentary')).toBe(1000);
    expect(extraSteps(6000, 'light')).toBe(0);
    expect(extraSteps(12000, null)).toBe(4500); // unknown: light, 7,500
    expect(extraSteps(12000, 'very_active')).toBe(0);
  });

  it('counts a streak back from today, or from yesterday while today is still under way', () => {
    const today = '2026-10-28';
    expect(goalStreak(days(today, [9000, 8000, 8500]), 8000, today)).toBe(3);
    expect(goalStreak(days(today, [9000, 8000, 3000]), 8000, today)).toBe(2); // today not there yet
    expect(goalStreak(days(today, [9000, 7999, 8000]), 8000, today)).toBe(1);
    expect(goalStreak(new Map(), 8000, today)).toBe(0);
  });

  it('celebrates a goal once, folds several into one, and leads with the biggest news', () => {
    const base = { today: '2026-10-28', stepGoal: 8000, burned: 120, burnGoal: 300, streak: 1, best: null, shown: new Set<string>() };
    expect(celebrationFor({ ...base, steps: 7999 })).toBeNull();
    expect(celebrationFor({ ...base, steps: 8200 })).toEqual({ key: 'steps:2026-10-28', title: '8,200 steps!', lines: ['You reached your 8,000-step goal.'] });
    expect(celebrationFor({ ...base, steps: 8200, shown: new Set(['steps:2026-10-28']) })).toBeNull();
    const big = celebrationFor({ ...base, steps: 12000, burned: 320, streak: 7, best: 11000 })!;
    expect(big.title).toBe('7 days in a row!');
    expect(big.key.split('|')).toEqual(['streak:2026-10-28', 'best:2026-10-28', 'steps:2026-10-28', 'burn:2026-10-28']);
    expect(big.lines[1]).toBe('12,000 steps beats your best of 11,000.');
    // No "best" on a first day, nor for a day under the goal.
    expect(celebrationFor({ ...base, steps: 9000, best: null })!.key).toBe('steps:2026-10-28');
    expect(celebrationFor({ ...base, steps: 6000, best: 5000 })).toBeNull();
  });
});

async function repoAt(now: number) {
  const db = await memoryDb();
  await migrate(db);
  let n = 0;
  return new Repo(db, () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, () => now);
}

describe('a day of steps', () => {
  const noon = new Date(2026, 9, 28, 12).getTime();

  it('is one record a day, and an unchanged reading costs nothing', async () => {
    const repo = await repoAt(noon);
    const a = await repo.setDaySteps('2026-10-28', 3000, { caloriesBurned: 74, distanceKm: 2.11, note: FROM_HEALTH_CONNECT });
    expect(await repo.pendingCount()).toBe(1);
    const b = await repo.setDaySteps('2026-10-28', 3000, { caloriesBurned: 74, distanceKm: 2.11, note: FROM_HEALTH_CONNECT });
    expect(b).toMatchObject({ id: a.id, steps: 3000, clientUpdatedAt: a.clientUpdatedAt });
    expect(await repo.pendingCount()).toBe(1);
    const c = await repo.setDaySteps('2026-10-28', 5000, { caloriesBurned: 123, distanceKm: 3.52, note: FROM_HEALTH_CONNECT });
    expect(c.id).toBe(a.id);
    expect(await repo.pendingCount()).toBe(1); // the newer reading replaces the queued one
    const past = await repo.setDaySteps('2026-10-20', 11000, { caloriesBurned: 271, distanceKm: 7.74, note: null });
    expect(localDate(past.loggedAt)).toBe('2026-10-20');
    expect(await repo.stepsByDay('2026-10-01')).toEqual(new Map([['2026-10-28', 5000], ['2026-10-20', 11000]]));
    expect(await repo.bestStepDay('2026-10-28')).toEqual({ date: '2026-10-20', steps: 11000 });
    expect(await repo.bestStepDay('2026-10-20')).toBeNull();
  });

  it('is read from Health Connect: a month the first time, then the last few days', async () => {
    const repo = await repoAt(noon);
    const asked: string[] = [];
    const source: StepSource = {
      state: async () => 'connected',
      stepsOn: async (date) => (asked.push(date), { steps: date === '2026-10-28' ? 6400 : date === '2026-10-01' ? 9100 : 0, origins: date === '2026-10-28' ? ['com.sec.android.app.shealth'] : [] }),
    };
    expect(await readHealthSteps(repo, source, {}, '2026-10-28', noon)).toBe(30);
    expect(asked).toHaveLength(30);
    expect(await repo.getMeta(STEPS_BACKFILLED_KEY)).toBe(true);
    expect(await repo.getMeta(STEPS_LAST_READ_KEY)).toEqual({ at: noon, today: 6400, origins: ['com.sec.android.app.shealth'], error: null });
    expect(appName('com.sec.android.app.shealth')).toBe('Samsung Health');
    expect(await repo.stepsFor('2026-10-28')).toMatchObject({ steps: 6400, note: FROM_HEALTH_CONNECT, caloriesBurned: kcalForSteps(6400) });
    expect(await repo.stepsFor('2026-10-01')).toMatchObject({ steps: 9100 });
    expect(await repo.stepsFor('2026-10-27')).toBeNull(); // nothing recorded: nothing written
    asked.length = 0;
    expect(await readHealthSteps(repo, source, {}, '2026-10-28', noon)).toBe(3);
    expect(asked).toEqual(['2026-10-28', '2026-10-27', '2026-10-26']);
    expect(await readHealthSteps(repo, { ...source, state: async () => 'not-connected' }, {}, '2026-10-28', noon)).toBeNull();
    // A failed read says why on the activity screen.
    await expect(readHealthSteps(repo, { ...source, stepsOn: async () => Promise.reject(new Error('Rate limited')) }, {}, '2026-10-28', noon)).rejects.toThrow('Rate limited');
    expect(await repo.getMeta(STEPS_LAST_READ_KEY)).toMatchObject({ error: 'Rate limited' });
  });

  it('takes the steps permission in either shape Health Connect answers with', () => {
    expect(hasSteps([{ accessType: 'read', recordType: 'Steps' }])).toBe(true);
    expect(hasSteps(['android.permission.health.READ_STEPS'])).toBe(true);
    expect(hasSteps([{ accessType: 'read', recordType: 'HeartRate' }, 'android.permission.health.READ_HEART_RATE'])).toBe(false);
  });
});

describe('Activity screen', () => {
  it('saves typed steps for today or a day picked from the chart, and changes the goals', async () => {
    const { view, stack } = await mount(<ActivityScreen />);
    await fireEvent.changeText(await view.findByLabelText('Steps today'), '6500');
    await fireEvent.press(view.getByRole('button', { name: 'Save steps' }));
    await waitFor(async () => expect(await stack.repo.stepsFor(localDate())).toMatchObject({ steps: 6500, note: null }));
    expect(await view.findByLabelText('6 500 of 8 000 steps today')).toBeTruthy();

    const yesterday = shiftDate(localDate(), -1);
    const label = new Date(`${yesterday}T12:00:00`).toLocaleDateString('en-ZA', { weekday: 'short' });
    await fireEvent.press(view.getByRole('button', { name: `${label}: 0 steps` }));
    await fireEvent.changeText(view.getByLabelText(/^Steps on /), 'lots');
    await fireEvent.press(view.getByRole('button', { name: 'Save steps' }));
    expect(view.getByText('Enter steps from 1 to 100 000.')).toBeTruthy();
    await fireEvent.changeText(view.getByLabelText(/^Steps on /), '12,000');
    await fireEvent.press(view.getByRole('button', { name: 'Save steps' }));
    await waitFor(async () => expect(await stack.repo.stepsFor(yesterday)).toMatchObject({ steps: 12000 }));

    await fireEvent.press(view.getByRole('button', { name: 'Raise: Steps a day' }));
    await fireEvent.press(view.getByRole('button', { name: 'Lower: Calories burned a day' }));
    await waitFor(async () => expect(await stack.repo.getMeta(SETTINGS_KEY)).toMatchObject({ stepGoal: 8500, burnGoal: 250 }));
    await settle(stack);
    await view.unmount();
  });

  it('connects Health Connect and reads the steps from it', async () => {
    onAndroid();
    jest.mocked(HC.requestPermission).mockResolvedValueOnce([{ accessType: 'read', recordType: 'Steps' }]);
    jest.mocked(HC.getGrantedPermissions).mockResolvedValue([{ accessType: 'read', recordType: 'Steps' }]);
    jest.mocked(HC.aggregateRecord).mockResolvedValue({ COUNT_TOTAL: 9000, dataOrigins: [] } as never);
    const { view, stack } = await mount(<ActivityScreen />);
    await fireEvent.press(await view.findByRole('button', { name: 'Connect Health Connect' }));
    expect(await view.findByText('Counting from Health Connect')).toBeTruthy();
    expect(await view.findByText(/: 9 000 steps today\.$/)).toBeTruthy();
    expect(await stack.repo.getMeta(SETTINGS_KEY)).toMatchObject({ stepsFrom: 'health-connect' });
    expect(await stack.repo.stepsFor(localDate())).toMatchObject({ steps: 9000, note: FROM_HEALTH_CONNECT });
    expect(view.queryByRole('button', { name: 'Save steps' })).toBeNull(); // the watch counts, not typing
    jest.mocked(HC.getGrantedPermissions).mockResolvedValue([]);
    jest.mocked(HC.aggregateRecord).mockResolvedValue({ COUNT_TOTAL: 0, dataOrigins: [] } as never);
    await settle(stack);
    await view.unmount();
  });

  it('offers Health Connect from Google Play when it is not installed', async () => {
    onAndroid();
    jest.mocked(HC.getSdkStatus).mockResolvedValueOnce(1);
    const { view, stack } = await mount(<ActivityScreen />);
    expect(await view.findByRole('button', { name: 'Get Health Connect' })).toBeTruthy();
    await settle(stack);
    await view.unmount();
  });
});

describe('On Today', () => {
  it('shows steps and calories burned against the goals, and adds walking beyond a usual day to the food', async () => {
    const { view, stack } = await mount(<Today />);
    await stack.repo.setDaySteps(localDate(), 11500, { caloriesBurned: 283, distanceKm: 8.1, note: null });
    expect(await view.findByLabelText('Activity: 11 500 of 8 000 steps, 283 of 300 calories burned')).toBeTruthy();
    // 4,000 steps beyond a usual (light) day is 99 kcal; half of it goes to food by default.
    expect(await view.findByText('+50 from activity')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: /^Activity:/ }));
    expect(router.push).toHaveBeenCalledWith('/activity');
    await settle(stack);
    await view.unmount();
  });
});

describe('Celebrations', () => {
  it('cheers when the step goal is reached, once', async () => {
    const stack = await testStack();
    const today = localDate();
    await stack.repo.setDaySteps(shiftDate(today, -1), 8800, { caloriesBurned: 217, distanceKm: 6.2, note: null });
    const view = await renderWith(<CelebrationHost />, stack);
    expect(view.queryByText(/steps!$/)).toBeNull();
    await act(() => stack.repo.setDaySteps(today, 9300, { caloriesBurned: 229, distanceKm: 6.5, note: null }));
    expect(await view.findByText('A new personal best!')).toBeTruthy();
    expect(view.getByText('9,300 steps beats your best of 8,800.')).toBeTruthy();
    expect(view.getByText('You reached your 8,000-step goal.')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Nice!' }));
    expect(view.queryByText('A new personal best!')).toBeNull();
    expect(await stack.repo.getMeta(CELEBRATED_KEY)).toEqual([`best:${today}`, `steps:${today}`]);
    await view.unmount();
    const again = await renderWith(<CelebrationHost />, stack);
    await act(() => stack.repo.setDaySteps(today, 9600, { caloriesBurned: 236, distanceKm: 6.8, note: null }));
    expect(again.queryByText(/steps!$|personal best/)).toBeNull();
    await settle(stack);
    await again.unmount();
  });
});
