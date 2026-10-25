import { fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import Diary from '../app/diary';
import WhatFits from '../app/fits';
import { dateAt, localDate, mealForTime, shiftDate } from '../src/data/dates';
import { mealLabel } from '../src/data/entryForm';
import { atDate } from '../src/data/history';
import type { DataStack } from '../src/data/stack';
import { renderWith, settle, testStack } from './helpers/screen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() }, useLocalSearchParams: () => ({}) }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(async () => {}), impactAsync: jest.fn(async () => {}), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('../src/scan/photos', () => ({ photoFor: jest.fn(() => null), keepPhoto: jest.fn(), deletePhoto: jest.fn() }));

const today = localDate();
const yesterday = shiftDate(today, -1);
const meal = mealForTime();
const other = meal === 'breakfast' ? 'lunch' : 'breakfast';
const weekday = (d: string) => dateAt(d).toLocaleDateString('en-ZA', { weekday: 'long' });
const hourOf = (m: string) => ({ breakfast: 8, lunch: 13, snack: 15, dinner: 19 })[m] ?? 12;

async function seed(stack: DataStack) {
  const t = (date: string, h: number) => atDate(date, new Date(2026, 0, 1, h).getTime());
  // Yesterday: the meal that comes next today, to copy; and a usual logged twice.
  await stack.repo.addEntry({ name: 'Chicken stir-fry', calories: 560, proteinG: 44, mealType: meal, loggedAt: t(yesterday, hourOf(meal)) });
  await stack.repo.addEntry({ name: 'Rooibos with milk', calories: 25, mealType: other, loggedAt: t(yesterday, 10) });
  await stack.repo.addEntry({ name: 'Rooibos with milk', calories: 25, mealType: other, loggedAt: t(shiftDate(today, -2), 10) });
  await stack.repo.addEntry({ name: 'Huge braai', calories: 3100, mealType: 'dinner', loggedAt: t(shiftDate(today, -2), 19) });
}

afterEach(() => jest.clearAllMocks());

describe('Diary', () => {
  it('shows the week, each day and fills today from yesterday and the usuals', async () => {
    const stack = await testStack();
    await seed(stack);
    const view = await renderWith(<Diary />, stack);

    expect(await view.findByText('Your usuals')).toBeTruthy();
    expect(await view.findByRole('radio', { name: new RegExp(`^${weekday(today)} ${dateAt(today).getDate()}, nothing logged`) })).toBeTruthy();
    if (weekday(yesterday) !== 'Sunday') {
      // Yesterday is in this week's strip unless today is Monday.
      expect(view.getByRole('radio', { name: new RegExp(`${weekday(yesterday)} .*585 calories`) })).toBeTruthy();
    }

    await fireEvent.press(await view.findByRole('button', { name: 'What fits?' }));
    expect(router.push).toHaveBeenCalledWith('/fits');

    // Today has nothing yet: copy yesterday's meal (the card then goes, as the meal is logged).
    await fireEvent.press(await view.findByRole('button', { name: new RegExp(`^Copy yesterday's ${mealLabel(meal).toLowerCase()}, 560 calories`) }));
    expect(await view.findByRole('button', { name: /^Chicken stir-fry, 560 calories/ })).toBeTruthy();
    // Logged twice now, so it has become a usual too.
    expect(await view.findByRole('button', { name: 'Add Chicken stir-fry, 560 calories' })).toBeTruthy();

    // Add a usual in one tap.
    await fireEvent.press(view.getByRole('button', { name: 'Add Rooibos with milk, 25 calories' }));
    await waitFor(async () => expect((await stack.repo.entriesFor(today)).map((e) => e.name).sort()).toEqual(['Chicken stir-fry', 'Rooibos with milk']));
    expect(await view.findByText('585')).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: /^Chicken stir-fry, 560 calories/ }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/add', params: { id: expect.any(String) } });

    await settle(stack);
    await view.unmount();
  });

  it('opens another day and marks a day over goal', async () => {
    const stack = await testStack();
    await seed(stack);
    const view = await renderWith(<Diary />, stack);
    const twoAgo = shiftDate(today, -2);
    if (await view.findByRole('radio', { name: new RegExp(`^${weekday(twoAgo)} \\d+, 3125 calories, over goal`) }).then(() => true, () => false)) {
      await fireEvent.press(view.getByRole('radio', { name: new RegExp(`^${weekday(twoAgo)} `) }));
    } else {
      // Two days ago was last week: go back a week first.
      await fireEvent.press(view.getByRole('button', { name: 'Previous week' }));
      await fireEvent.press(await view.findByRole('radio', { name: new RegExp(`^${weekday(twoAgo)} \\d+, 3125 calories, over goal`) }));
    }
    expect(await view.findByText('Huge braai')).toBeTruthy();
    expect(view.getByText(/1.?125 over/)).toBeTruthy();
    expect(view.getByRole('button', { name: 'Go to today' })).toBeTruthy();
    await settle(stack);
    await view.unmount();
  });
});

describe('What fits', () => {
  it('suggests your own meals that fit, logs one and undoes it', async () => {
    const stack = await testStack();
    await seed(stack);
    const view = await renderWith(<WhatFits />, stack);
    expect(await view.findByText('Chicken stir-fry')).toBeTruthy();
    expect(view.queryByText('Huge braai')).toBeNull(); // too big even at half

    await fireEvent.press(view.getByRole('button', { name: 'Log Chicken stir-fry, 560 calories' }));
    await waitFor(async () => expect((await stack.repo.entriesFor(today)).map((e) => e.name)).toEqual(['Chicken stir-fry']));
    await fireEvent.press(await view.findByRole('button', { name: 'Logged Chicken stir-fry. Tap to undo' }));
    await waitFor(async () => expect(await stack.repo.entriesFor(today)).toEqual([]));
    await settle(stack);
    await view.unmount();
  });

  it('scales local ideas down to what is left', async () => {
    const stack = await testStack();
    await stack.repo.addEntry({ name: 'Big lunch', calories: 1600 });
    const view = await renderWith(<WhatFits />, stack);
    await fireEvent.press(await view.findByRole('radio', { name: 'Local ideas' }));
    // 400 kcal left: the 530 kcal chicken and sweet potato fits as a three-quarter portion.
    expect(await view.findByText('Grilled chicken, sweet potato and greens, ¾ portion')).toBeTruthy();
    expect(view.getByText('Greek yoghurt, muesli and berries')).toBeTruthy(); // 380 kcal: a whole portion
    expect(view.getByText(/typical values/)).toBeTruthy();
    await settle(stack);
    await view.unmount();
  });
});
