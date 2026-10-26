import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Keyboard, Linking } from 'react-native';

import Coach from '../app/coach';
import Pantry from '../app/pantry';
import { ApiError } from '../src/api/errors';
import { AskPangoCard } from '../src/coach/AskPangoCard';
import { addToPantry, coachProblem, helplinesIn, PANTRY_KEY, recipeEntry, typedAt, typingMs, type CoachMessage } from '../src/data/coach';
import { keyboardLift } from '../src/ui/keyboard';
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
const REPLY = 'Try eggs on toast with spinach: about 30 g of protein.';

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

  it('types a reply out at a steady pace that finishes within half a second to three seconds', () => {
    expect(typingMs(REPLY.length)).toBe(540);
    expect(typingMs(5)).toBe(500); // short replies are not a blink
    expect(typingMs(2000)).toBe(3000); // long ones do not drag
    expect(typedAt(REPLY.length, 0)).toBe(0);
    expect(typedAt(REPLY.length, 270)).toBe(27); // halfway in time, halfway through
    expect(typedAt(REPLY.length, 10_000)).toBe(REPLY.length);
  });

  it('leaves room for the keyboard, counting Android’s navigation bar, and never twice', () => {
    expect(keyboardLift('ios', 0, 34, 0)).toBe(0);
    expect(keyboardLift('ios', 336, 34, 0)).toBe(336);
    expect(keyboardLift('android', 300, 48, 0)).toBe(348);
    expect(keyboardLift('android', 300, 48, 348)).toBe(0); // a phone that already shrank the window for it
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

describe('Ask Pango, while it answers', () => {
  it('shows the question at once, Pango thinking, then types the answer out (a tap shows it all)', async () => {
    const server = new FakeServer();
    let release!: () => void;
    server.coachGate = new Promise((r) => (release = r));
    const stack = await testStack(server);
    const view = await renderWith(<Coach />, stack);
    await fireEvent.changeText(await view.findByLabelText('Message to Pango'), 'How much protein?');
    await fireEvent.press(view.getByRole('button', { name: 'Send' }));
    expect(await view.findByLabelText('Pango is thinking')).toBeTruthy();
    expect(view.getByText('How much protein?')).toBeTruthy();
    expect(view.getByLabelText('Message to Pango').props.value).toBe('');
    await act(async () => release());
    const typing = await view.findByRole('button', { name: REPLY }); // still typing: a tap shows it all
    expect(view.queryByLabelText('Pango is thinking')).toBeNull();
    await fireEvent.press(typing);
    expect(view.queryByRole('button', { name: REPLY })).toBeNull();
    expect(view.getByText(REPLY)).toBeTruthy();
    await settle(stack);
    await view.unmount();
  });

  it('keeps the message box above the keyboard', async () => {
    const handlers: Record<string, (e: { endCoordinates: { height: number } }) => void> = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((name: string, fn: (e: { endCoordinates: { height: number } }) => void) => {
      handlers[name] = fn;
      return { remove: () => {} };
    }) as never);
    const stack = await testStack(new FakeServer());
    const view = await renderWith(<Coach />, stack);
    const screen = () => view.getByTestId('coach-screen').props.style;
    expect(screen().paddingBottom).toBe(0);
    const on = (suffix: string) => handlers[Object.keys(handlers).find((k) => k.endsWith(suffix))!];
    await act(async () => on('Show')({ endCoordinates: { height: 300 } }));
    expect(screen().paddingBottom).toBe(300);
    await act(async () => on('Hide')({ endCoordinates: { height: 0 } }));
    expect(screen().paddingBottom).toBe(0);
    await settle(stack);
    await view.unmount();
  });

  it('asks a question passed in from Today straight away', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ ask: 'How much protein do I need?' });
    const server = new FakeServer();
    const stack = await testStack(server);
    const view = await renderWith(<Coach />, stack);
    expect(await view.findByText(REPLY, undefined, { timeout: 3000 })).toBeTruthy();
    expect(server.coachMessages[0]).toMatchObject({ role: 'user', content: 'How much protein do I need?' });
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    await settle(stack);
    await view.unmount();
  });
});

describe('Finding Ask Pango', () => {
  it('on Today, opens the chat or asks a quick question in one tap', async () => {
    const stack = await testStack(new FakeServer());
    const view = await renderWith(<AskPangoCard />, stack);
    await fireEvent.press(view.getByRole('button', { name: 'What should I eat tonight?' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/coach', params: { ask: 'What should I eat tonight?' } });
    await fireEvent.press(view.getByRole('button', { name: 'Ask Pango' }));
    expect(router.push).toHaveBeenCalledWith('/coach');
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
