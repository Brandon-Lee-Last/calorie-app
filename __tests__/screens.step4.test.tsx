import { fireEvent, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Share } from 'react-native';

import Progress from '../app/(tabs)/progress';
import Train from '../app/(tabs)/train';
import GoalsScreen from '../app/goals';
import Plus from '../app/plus';
import Recap from '../app/recap';
import Wardrobe from '../app/wardrobe';
import Weigh from '../app/weigh';
import Workout from '../app/workout';
import { localDate, shiftDate } from '../src/data/dates';
import { atDate } from '../src/data/history';
import { LOOK_KEY, RECAP_SHARED_KEY } from '../src/data/hooks';
import { lastWeek } from '../src/data/progress';
import { PROFILE_KEY, SETTINGS_KEY, type CachedProfile } from '../src/data/settings';
import { FakeServer } from './helpers/fakeServer';
import { renderWith, settle, testStack } from './helpers/screen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() }, useLocalSearchParams: jest.fn(() => ({})) }));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('../src/scan/photos', () => ({ photoFor: jest.fn(() => null), keepPhoto: jest.fn(), deletePhoto: jest.fn() }));
// Google Play Billing is native; these tests run where it is not available, like a build not installed from Play.
jest.mock('expo-iap', () => ({
  initConnection: jest.fn(async () => false),
  fetchProducts: jest.fn(async () => []),
  getAvailablePurchases: jest.fn(async () => []),
  requestPurchase: jest.fn(),
  finishTransaction: jest.fn(),
  purchaseUpdatedListener: jest.fn(() => ({ remove: jest.fn() })),
  purchaseErrorListener: jest.fn(() => ({ remove: jest.fn() })),
}));

const today = localDate();
const t = (date: string, h = 12) => atDate(date, new Date(2026, 0, 1, h).getTime());

afterEach(() => {
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({});
});

describe('Progress', () => {
  it('shows the weight trend, the recap card and keeps a year of trends for Plus', async () => {
    const stack = await testStack();
    await stack.repo.addWeight(85.1, t(shiftDate(today, -6)));
    await stack.repo.addWeight(84.2, t(today));
    const view = await renderWith(<Progress />, stack);
    expect(await view.findByText(/^84[.,]2$/)).toBeTruthy();
    expect(view.getByText(/^−0[.,]9 kg$/)).toBeTruthy();
    expect(view.getByText('Your weekly recap is ready')).toBeTruthy();
    await fireEvent.press(view.getByRole('radio', { name: 'Year' }));
    expect(await view.findByText('A year of trends comes with Plus.')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Log my weight' }));
    expect(router.push).toHaveBeenCalledWith('/weigh');
    await settle(stack);
    await view.unmount();
  });
});

describe('Weigh', () => {
  it('logs a weight', async () => {
    const stack = await testStack();
    const view = await renderWith(<Weigh />, stack);
    await fireEvent.changeText(await view.findByLabelText("Today's weight"), '82,4');
    await fireEvent.press(view.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await stack.repo.weights('2000-01-01')).map((w) => w.weightKg)).toEqual([82.4]);
    await settle(stack);
    await view.unmount();
  });

  it('sets the goal weight', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ mode: 'target' });
    const stack = await testStack();
    const view = await renderWith(<Weigh />, stack);
    await fireEvent.changeText(await view.findByLabelText('Goal weight'), '78');
    await fireEvent.press(view.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await stack.repo.getMeta<CachedProfile>(PROFILE_KEY))?.profile.targetWeightKg).toBe(78);
    await settle(stack);
    await view.unmount();
  });
});

describe('Wardrobe', () => {
  it('lets you try anything but only wear what is earned', async () => {
    const stack = await testStack();
    for (let i = 0; i < 5; i++) await stack.repo.addWorkout({ workoutId: null, programId: null, title: 'Core', startedAt: t(shiftDate(today, -i)), finishedAt: t(shiftDate(today, -i), 13), sets: [], notes: null, rating: null, caloriesBurned: 50 });
    const view = await renderWith(<Wardrobe />, stack);

    await fireEvent.press(await view.findByRole('radio', { name: 'Party, locked' }));
    expect(await view.findByText(/^Unlocks with a 14-day streak/)).toBeTruthy();
    expect(view.getByRole('button', { name: 'Keep going to unlock this' })).toBeTruthy();

    await fireEvent.press(view.getByRole('radio', { name: 'Gym' }));
    await fireEvent.press(await view.findByRole('button', { name: 'Wear this look' }));
    await waitFor(async () => expect(await stack.repo.getMeta(LOOK_KEY)).toMatchObject({ outfit: 'gym', hat: 'headband' }));
    expect(await view.findByText('Looking good!')).toBeTruthy();
    await settle(stack);
    await view.unmount();
  });
});

describe('Train', () => {
  it('lists the built-in workouts, starts one, and sets how much burned energy goes back to food', async () => {
    const stack = await testStack();
    const view = await renderWith(<Train />, stack);
    expect(await view.findByText('0 of 3 workouts')).toBeTruthy();
    await fireEvent.press(view.getByRole('radio', { name: 'Quick' }));
    await fireEvent.press(await view.findByRole('button', { name: /^10-minute core/ }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/workout', params: { key: 'builtin:core' } });
    await fireEvent.press(view.getByRole('radio', { name: 'All' }));
    await waitFor(async () => expect(await stack.repo.getMeta(SETTINGS_KEY)).toMatchObject({ eatBack: 'all' }));
    await settle(stack);
    await view.unmount();
  });
});

describe('Workout', () => {
  it('logs sets with rest between them and saves the session', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ key: 'builtin:bodyweight' });
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.text === 'Finish')?.onPress?.());
    const stack = await testStack();
    const view = await renderWith(<Workout />, stack);
    expect(await view.findByText('Bodyweight squat')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'More reps' }));
    await fireEvent.press(view.getByRole('button', { name: 'Log set 1' }));
    expect(await view.findByText('Rest before set 2')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Skip rest' }));
    await fireEvent.press(await view.findByRole('button', { name: 'Log set 2' }));
    await fireEvent.press(view.getByRole('button', { name: 'Finish' }));
    expect(await view.findByText('Bodyweight full body done')).toBeTruthy();
    const [saved] = await stack.repo.workouts(today);
    expect(saved).toMatchObject({ title: 'Bodyweight full body', caloriesBurned: expect.any(Number) });
    expect(saved.sets).toEqual([
      { exercise: 'bodyweight-squat', setNo: 1, reps: 16, weightKg: null, durationS: null },
      { exercise: 'bodyweight-squat', setNo: 2, reps: 15, weightKg: null, durationS: null },
    ]);
    await settle(stack);
    await view.unmount();
  });
});

describe('Recap', () => {
  it('taps through the week and remembers a share', async () => {
    const week = lastWeek(today);
    jest.mocked(useLocalSearchParams).mockReturnValue({ start: week.start });
    jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
    const stack = await testStack();
    await stack.repo.addEntry({ name: 'Eggs on toast', calories: 400, proteinG: 25, loggedAt: t(week.start, 8) });
    await stack.repo.addEntry({ name: 'Chicken salad', calories: 500, proteinG: 45, loggedAt: t(shiftDate(week.start, 2), 13) });
    const view = await renderWith(<Recap />, stack);
    expect(await view.findByLabelText('2 of 7 days logged')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Next card' }));
    expect(await view.findByText('45 g of protein')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Next card' }));
    await fireEvent.press(await view.findByRole('button', { name: 'Share my week' }));
    await waitFor(async () => expect(await stack.repo.getMeta(RECAP_SHARED_KEY)).toBe(true));
    expect(Share.share).toHaveBeenCalledWith({ message: expect.stringMatching(/2 of 7 days logged/) });
    await settle(stack);
    await view.unmount();
  });
});

describe('Plus', () => {
  it('shows the plans, says where buying works, and grants test Plus on a development server', async () => {
    const server = new FakeServer();
    const stack = await testStack(server);
    const view = await renderWith(<Plus />, stack);
    expect(await view.findByText('Buying works in the app installed from Google Play.')).toBeTruthy();
    expect(await view.findByRole('radio', { name: /^Yearly, Price from Google Play, 7 days free/ })).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Test Plus on a development server' }));
    expect(await view.findByText('Thank you. Everything in Plus is open.')).toBeTruthy();
    expect(server.plan).toBe('pro');
    await settle(stack);
    await view.unmount();
  });

  it('offers to try Plus, and to end it, on a test server', async () => {
    const server = new FakeServer();
    server.testPurchases = true;
    const stack = await testStack(server);
    const view = await renderWith(<Plus />, stack);
    await fireEvent.press(await view.findByRole('button', { name: 'Try Plus free (test server)' }));
    expect(await view.findByText('Plus is active.')).toBeTruthy();
    expect(server.plan).toBe('pro');
    await fireEvent.press(view.getByRole('button', { name: 'End test Plus' }));
    await waitFor(() => expect(server.plan).toBe('free'));
    expect(await view.findByRole('button', { name: 'Try Plus free (test server)' })).toBeTruthy();
    await settle(stack);
    await view.unmount();
  });
});

describe('Goals', () => {
  it('saves goals set by hand', async () => {
    const stack = await testStack();
    const view = await renderWith(<GoalsScreen />, stack);
    await fireEvent.changeText(await view.findByLabelText('Calories'), '1850');
    await fireEvent.changeText(view.getByLabelText('Protein'), '140');
    await fireEvent.press(view.getByRole('button', { name: 'Save goals' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await stack.repo.getMeta<CachedProfile>(PROFILE_KEY))?.profile.goals).toEqual({ calories: 1850, proteinG: 140, carbG: 225, fatG: 67, custom: true });
    await settle(stack);
    await view.unmount();
  });
});
