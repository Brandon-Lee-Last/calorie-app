import { fireEvent, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Share } from 'react-native';

import Today from '../app/(tabs)/index';
import Diets from '../app/diets';
import MealScreen from '../app/meal';
import Plan from '../app/plan';
import Shopping from '../app/shopping';
import { localDate, shiftDate } from '../src/data/dates';
import { refreshEntitlement } from '../src/data/entitlement';
import { dayName, PLAN_DIET_KEY, PLAN_INVITE_KEY, planDay } from '../src/data/mealPlan';
import type { DataStack } from '../src/data/stack';
import { FakeServer } from './helpers/fakeServer';
import { sampleMealPlans } from './helpers/mealPlans';
import { renderWith, settle, testStack } from './helpers/screen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));

afterEach(() => {
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({});
});

async function setup({ plus = false, diet = null as string | null } = {}) {
  const server = new FakeServer();
  server.mealPlans = sampleMealPlans;
  const stack = await testStack(server);
  if (plus) {
    server.plan = 'pro';
    await refreshEntitlement(stack.repo, stack.api);
  }
  if (diet) await stack.repo.setMeta(PLAN_DIET_KEY, diet);
  return { server, stack };
}
const todayPlan = (_stack: DataStack) => planDay(sampleMealPlans(), sampleMealPlans().diets[0], localDate(), 2000, {});

describe('Today: meal plan card', () => {
  it('invites to start a plan, and stays away once closed', async () => {
    const { stack } = await setup();
    const view = await renderWith(<Today />, stack);
    await fireEvent.press(await view.findByRole('button', { name: 'Choose a plan' }));
    expect(router.push).toHaveBeenCalledWith('/diets');
    await fireEvent.press(view.getByRole('button', { name: 'Not now, hide the meal plan card' }));
    await waitFor(() => expect(view.queryByText('Want a meal plan?')).toBeNull());
    expect(await stack.repo.getMeta(PLAN_INVITE_KEY)).toBe(true);
    await settle(stack);
    await view.unmount();
  });

  it('offers the next planned meal and logs it in one tap', async () => {
    const { stack } = await setup({ diet: 'balanced' });
    const view = await renderWith(<Today />, stack);
    const logIt = await view.findByRole('button', { name: /^Log / });
    const title = logIt.props.accessibilityLabel.replace(/^Log /, '');
    expect(todayPlan(stack).items.map((i) => i.meal.title)).toContain(title);
    await fireEvent.press(logIt);
    await waitFor(async () => expect((await stack.repo.entriesFor(localDate())).map((e) => e.name)).toEqual([title]));
    await settle(stack);
    await view.unmount();
  });
});

describe('Choosing a style', () => {
  it('uses a free style at once and sends Pro styles to Plus', async () => {
    const { stack } = await setup();
    const view = await renderWith(<Diets />, stack);
    expect(await view.findByText('Balanced')).toBeTruthy();
    expect(view.getByText('On diabetes medicine? Talk to your doctor first.')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Low carb: unlock with Plus' }));
    expect(router.push).toHaveBeenCalledWith('/plus');
    await fireEvent.press(view.getByRole('button', { name: 'Use Budget' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/plan'));
    expect(await stack.repo.getMeta(PLAN_DIET_KEY)).toBe('budget');
    await settle(stack);
    await view.unmount();
  });
});

describe('The plan', () => {
  it('lists the day, logs a meal, swaps another, and keeps the week for Plus', async () => {
    const { stack } = await setup({ diet: 'balanced' });
    const view = await renderWith(<Plan />, stack);
    const plan = todayPlan(stack);
    expect(await view.findByText(plan.items[0].meal.title)).toBeTruthy();
    for (const label of ['Breakfast', 'Lunch', 'Dinner', 'Snack']) expect(view.getByText(label)).toBeTruthy();

    const lunch = plan.items[1].meal.title;
    await fireEvent.press(view.getByRole('button', { name: `Log ${lunch}` }));
    await waitFor(() => expect(view.getAllByLabelText('Logged')).toHaveLength(1));
    const [logged] = await stack.repo.entriesFor(localDate());
    expect(logged).toMatchObject({
      name: lunch,
      mealType: 'lunch',
      calories: plan.items[1].calories,
    });

    const dinner = plan.items[2].meal.title;
    await fireEvent.press(view.getByRole('button', { name: `Swap ${dinner} for something else` }));
    await waitFor(() => expect(view.queryByText(dinner)).toBeNull());

    await fireEvent.press(view.getByRole('button', { name: 'The week ahead' }));
    expect(router.push).toHaveBeenCalledWith('/plus');
    await fireEvent.press(view.getByRole('button', { name: 'Shopping list for the week (Plus)' }));
    expect(router.push).toHaveBeenLastCalledWith('/plus');
    await settle(stack);
    await view.unmount();
  });

  it('asks for a style first', async () => {
    const { stack } = await setup();
    const view = await renderWith(<Plan />, stack);
    await fireEvent.press(await view.findByRole('button', { name: 'Choose a style' }));
    expect(router.push).toHaveBeenCalledWith('/diets');
    await settle(stack);
    await view.unmount();
  });

  it('shows Plus styles with their caution and the whole week', async () => {
    const { stack } = await setup({ plus: true, diet: 'low-carb' });
    const view = await renderWith(<Plan />, stack);
    expect(await view.findByText('On diabetes medicine? Talk to your doctor first.')).toBeTruthy();
    expect(view.getByText('Veggie omelette')).toBeTruthy();
    expect(view.queryByRole('button', { name: 'The week ahead' })).toBeNull();
    await fireEvent.press(
      view.getByRole('button', {
        name: dayName(shiftDate(localDate(), 6), localDate()),
      }),
    );
    expect(view.queryByRole('button', { name: /^Log / })).toBeNull(); // a day ahead is planned, not logged
    await settle(stack);
    await view.unmount();
  });
});

describe('A meal', () => {
  it('scales the recipe with the portion and logs it', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ slug: 'oats', portion: '1', meal: 'breakfast' });
    const { stack } = await setup({ diet: 'balanced' });
    const view = await renderWith(<MealScreen />, stack);
    expect(await view.findByText('50 g (½ cup)')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Bigger portion' }));
    expect(view.getByText('65 g')).toBeTruthy();
    expect(view.getByText('500 kcal')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Log as breakfast' }));
    await waitFor(async () =>
      expect((await stack.repo.entriesFor(localDate()))[0]).toMatchObject({
        name: 'Oats with banana',
        calories: 500,
        mealType: 'breakfast',
      }),
    );
    await settle(stack);
    await view.unmount();
  });

  it('keeps a Pro-only recipe for Plus', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ slug: 'steak' });
    const { stack } = await setup();
    const view = await renderWith(<MealScreen />, stack);
    expect(await view.findByText('The recipe for this one comes with Plus')).toBeTruthy();
    await settle(stack);
    await view.unmount();
  });
});

describe('Shopping list', () => {
  it('adds up the week by aisle, ticks items and sends the list', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    const { stack } = await setup({ plus: true, diet: 'balanced' });
    const view = await renderWith(<Shopping />, stack);
    expect(await view.findByText('Fruit and veg')).toBeTruthy();
    expect(view.getByText('Bread, grains and cereals')).toBeTruthy();
    const oats = view.getByRole('checkbox', { name: /^Rolled oats, / });
    await fireEvent.press(oats);
    await waitFor(() => expect(view.getByRole('checkbox', { name: /^Rolled oats, / }).props.accessibilityState.checked).toBe(true));
    await fireEvent.press(view.getByRole('button', { name: 'Send the list' }));
    expect(share.mock.calls[0][0].message).toMatch(/^Shopping for 7 days \(Balanced plan, Pango\)/);
    share.mockRestore();
    await settle(stack);
    await view.unmount();
  });

  it('is a Plus feature', async () => {
    const { stack } = await setup({ diet: 'balanced' });
    const view = await renderWith(<Shopping />, stack);
    expect(await view.findByText('The shopping list comes with Plus')).toBeTruthy();
    await settle(stack);
    await view.unmount();
  });
});
