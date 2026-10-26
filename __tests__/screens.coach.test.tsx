import { fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert, Linking } from 'react-native';

import Coach from '../app/coach';
import Pantry from '../app/pantry';
import { ApiError } from '../src/api/errors';
import { addToPantry, coachProblem, helplinesIn, PANTRY_KEY, recipeEntry, type CoachMessage } from '../src/data/coach';
import { localDate } from '../src/data/dates';
import type { Food } from '../src/data/foodMath';
import { FakeServer } from './helpers/fakeServer';
import { renderWith, settle, testStack } from './helpers/screen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() }, useLocalSearchParams: jest.fn(() => ({})) }));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

const food = (id: string, name: string): Food =>
  ({
    id,
    source: 'usda',
    isOwn: false,
    barcode: null,
    name,
    brand: null,
    servingG: null,
    servingLabel: null,
    calories100g: 100,
    protein100g: 5,
    carb100g: 10,
    fat100g: 2,
    fiber100g: null,
    sugar100g: null,
    sodiumMg100g: null,
    dishId: null,
    perServing: null,
    clientUpdatedAt: 0,
    updatedAt: 0,
    deletedAt: null,
    rev: 1,
  }) as Food;
const msg = (over: Partial<CoachMessage>): CoachMessage => ({ id: 'm', role: 'assistant', content: '', kind: 'chat', createdAt: 0, ...over });

describe('coach helpers', () => {
  it('offers call buttons only for the fixed helplines in a crisis reply', () => {
    expect(helplinesIn(msg({ kind: 'crisis', content: 'Call 0800 567 567 or Lifeline 0861 322 322, or 112.' }))).toEqual(['0800 567 567', '0861 322 322', '112']);
    expect(helplinesIn(msg({ kind: 'chat', content: 'Call 0800 567 567' }))).toEqual([]);
    expect(helplinesIn(msg({ kind: 'crisis', content: 'Call 0800 999 999' }))).toEqual([]);
  });

  it('says what went wrong in plain words', () => {
    expect(coachProblem(new ApiError(429, 'quota_exceeded', 'x'))).toMatchObject({ plus: true });
    expect(coachProblem(new ApiError(0, 'network', 'x')).title).toBe('Pango needs a connection');
    expect(coachProblem(new ApiError(503, 'feature_disabled', 'x')).title).toBe('Pango is resting');
  });

  it('keeps the grocery list free of repeats', () => {
    const one = addToPantry([], { id: 'a', name: 'Oats', brand: null });
    expect(addToPantry(one, { id: 'a', name: 'Oats', brand: null })).toHaveLength(1);
  });
});

describe('Ask Pango', () => {
  it('starts from a suggestion, shows the reply as text, and starts over', async () => {
    const server = new FakeServer();
    const stack = await testStack(server);
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.text === 'Start over')?.onPress?.());
    const view = await renderWith(<Coach />, stack);
    await fireEvent.press(await view.findByRole('button', { name: 'What should I eat tonight?' }));
    expect(await view.findByText('Try eggs on toast with spinach: about 30 g of protein.')).toBeTruthy();
    expect(view.getByText('What should I eat tonight?')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Start over' }));
    await waitFor(() => expect(view.queryByText('Try eggs on toast with spinach: about 30 g of protein.')).toBeNull());
    expect(server.coachMessages).toEqual([]);
    await settle(stack);
    await view.unmount();
  });

  it('shows helplines as call buttons when someone is in crisis', async () => {
    const server = new FakeServer();
    const stack = await testStack(server);
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const view = await renderWith(<Coach />, stack);
    await fireEvent.changeText(await view.findByLabelText('Message to Pango'), 'I want to kill myself');
    await fireEvent.press(view.getByRole('button', { name: 'Send' }));
    await fireEvent.press(await view.findByRole('button', { name: 'Call 0800 567 567' }));
    expect(open).toHaveBeenCalledWith('tel:0800567567');
    await settle(stack);
    await view.unmount();
  });

  it('keeps the message and points to Plus when the day’s questions are used up', async () => {
    const server = new FakeServer();
    server.coachLeft = 0;
    const stack = await testStack(server);
    const view = await renderWith(<Coach />, stack);
    const input = await view.findByLabelText('Message to Pango');
    await fireEvent.changeText(input, 'How much protein?');
    await fireEvent.press(view.getByRole('button', { name: 'Send' }));
    expect(await view.findByText("That's today's questions")).toBeTruthy();
    expect(view.getByLabelText('Message to Pango').props.value).toBe('How much protein?');
    await fireEvent.press(view.getByRole('button', { name: 'See Plus' }));
    expect(router.push).toHaveBeenCalledWith('/plus');
    await settle(stack);
    await view.unmount();
  });
});

describe('My groceries', () => {
  it('adds foods from search, asks for ideas and logs one with the server’s numbers', async () => {
    const server = new FakeServer();
    server.foods.set('oats', food('f-oats', 'Rolled oats'));
    server.foods.set('milk', food('f-milk', 'Low fat milk'));
    server.pantryRecipes = [
      {
        title: 'Creamy oats',
        minutes: 8,
        mealType: 'breakfast',
        ingredients: [
          { name: 'Rolled oats', grams: 60, foodId: 'f-oats' },
          { name: 'Low fat milk', grams: 250, foodId: 'f-milk' },
          { name: 'Salt', grams: 1, foodId: null },
        ],
        steps: ['Cook the oats in the milk.'],
        nutrition: { calories: 352, proteinG: 16.2, carbG: 52.6, fatG: 8.9 },
      },
    ];
    const stack = await testStack(server);
    const view = await renderWith(<Pantry />, stack);
    const search = await view.findByLabelText('Find a food to add');
    await fireEvent.changeText(search, 'oats');
    await fireEvent.press(await view.findByRole('button', { name: 'Add Rolled oats' }));
    await fireEvent.changeText(view.getByLabelText('Find a food to add'), 'milk');
    await fireEvent.press(await view.findByRole('button', { name: 'Add Low fat milk' }));
    await waitFor(async () => expect((await stack.repo.getMeta<{ id: string }[]>(PANTRY_KEY))?.map((i) => i.id)).toEqual(['f-oats', 'f-milk']));
    await fireEvent.press(view.getByRole('button', { name: 'Breakfast' }));
    await fireEvent.press(view.getByRole('button', { name: 'Make breakfast ideas' }));
    expect(await view.findByText('Creamy oats')).toBeTruthy();
    expect(server.pantryAsks[0]).toEqual({ foodIds: ['f-oats', 'f-milk'], mealType: 'breakfast' });
    await fireEvent.press(view.getByRole('button', { name: 'Log it' }));
    await waitFor(async () => expect((await stack.repo.entriesFor(localDate()))[0]).toMatchObject({ name: 'Creamy oats', calories: 352, mealType: 'breakfast' }));
    expect(recipeEntry(server.pantryRecipes[0] as never, 'breakfast').quantityG).toBe(311);
    await settle(stack);
    await view.unmount();
  });
});
