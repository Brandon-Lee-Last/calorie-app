import { fireEvent, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import FoodScreen from '../app/food';
import Search from '../app/search';
import { localDate } from '../src/data/dates';
import type { Food } from '../src/data/foodMath';
import { FakeServer } from './helpers/fakeServer';
import { renderWith, settle, testStack } from './helpers/screen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() }, useLocalSearchParams: jest.fn(() => ({})) }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(async () => {}), impactAsync: jest.fn(async () => {}), ImpactFeedbackStyle: { Light: 'light' } }));

const rusks: Food = {
  id: 'f-rusk', source: 'openfoodfacts', isOwn: false, barcode: '6001007200015', name: 'Buttermilk rusks', brand: 'Ouma',
  servingG: 32, servingLabel: '1 rusk (32 g)', calories100g: 430, protein100g: 8.5, carb100g: 68, fat100g: 13.4,
  fiber100g: 3, sugar100g: 20, sodiumMg100g: 350, dishId: null, perServing: null, clientUpdatedAt: 0, updatedAt: 0, deletedAt: null, rev: 1,
};
const apple: Food = { ...rusks, id: 'f-apple', source: 'usda', barcode: null, name: 'Apples, raw, with skin', brand: null, servingG: null, servingLabel: null, calories100g: 52, protein100g: 0.3, carb100g: 13.8, fat100g: 0.2 };

const realFetch = global.fetch;
afterEach(() => {
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  global.fetch = realFetch;
});

describe('Search', () => {
  it('lists recent meals, and opens one again with its numbers or its food', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ meal: 'lunch' });
    const stack = await testStack();
    await stack.repo.addEntry({ name: 'Chicken mayo sandwich', calories: 420, proteinG: 22, carbG: 38, fatG: 19, mealType: 'lunch', loggedAt: Date.now() - 86_400_000 });
    await stack.repo.addEntry({ name: 'Buttermilk rusks (Ouma)', calories: 138, foodId: 'f-rusk', mealType: 'breakfast', source: 'food', loggedAt: Date.now() - 2 * 86_400_000 });
    const view = await renderWith(<Search />, stack);

    await fireEvent.press(await view.findByRole('button', { name: /^Chicken mayo sandwich, 420 calories/ }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/add', params: { name: 'Chicken mayo sandwich', calories: '420', proteinG: '22', carbG: '38', fatG: '19', meal: 'lunch' } });
    await fireEvent.press(view.getByRole('button', { name: /^Buttermilk rusks \(Ouma\), 138 calories/ }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/food', params: { id: 'f-rusk', meal: 'lunch' } });
    await fireEvent.press(view.getByRole('button', { name: 'Scan a barcode' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/lens', params: { mode: 'barcode' } });
    await settle(stack);
    await view.unmount();
  });

  it('searches the food list as you type, with your own meals first', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ meal: 'snack' });
    const server = new FakeServer();
    server.foods.set(rusks.barcode!, rusks as unknown as Record<string, unknown>);
    server.foods.set('apple', apple as unknown as Record<string, unknown>);
    const stack = await testStack(server);
    await stack.repo.addEntry({ name: 'Rusks and coffee', calories: 180, mealType: 'breakfast' });
    const view = await renderWith(<Search />, stack);

    // Your own meals drop down from the first letter, before the server is asked.
    await fireEvent.changeText(await view.findByLabelText('Search foods'), 'r');
    expect(view.getByRole('button', { name: /^Rusks and coffee, 180 calories/ })).toBeTruthy();
    expect(server.searches).toEqual([]);

    await fireEvent.changeText(view.getByLabelText('Search foods'), 'rusk');
    await fireEvent.press(await view.findByRole('button', { name: 'Buttermilk rusks, Ouma, 138 calories per 1 rusk (32 g)' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/food', params: { id: 'f-rusk', meal: 'snack' } });
    expect(server.searches).toEqual(['rusk']); // one request after the typing pauses

    // The list stays while the next answer loads, and going back to an earlier search needs no request.
    await fireEvent.changeText(view.getByLabelText('Search foods'), 'rusks');
    expect(view.getByRole('button', { name: /^Buttermilk rusks, Ouma/ })).toBeTruthy();
    await waitFor(() => expect(server.searches).toEqual(['rusk', 'rusks']));
    await fireEvent.changeText(view.getByLabelText('Search foods'), 'rusk');
    expect(view.getByRole('button', { name: /^Buttermilk rusks, Ouma/ })).toBeTruthy();
    expect(server.searches).toEqual(['rusk', 'rusks']);

    await fireEvent.changeText(view.getByLabelText('Search foods'), 'pineapple');
    expect(await view.findByText('Nothing called "pineapple" in the food list yet.')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Type in "pineapple" yourself' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/add', params: { name: 'pineapple', meal: 'snack' } });

    await fireEvent.press(view.getByRole('button', { name: 'Clear the search' }));
    expect(await view.findByText('Recent')).toBeTruthy();
    await settle(stack);
    await view.unmount();
  });

  it('still finds your own meals offline', async () => {
    const server = new FakeServer();
    const stack = await testStack(server);
    await stack.repo.addEntry({ name: 'Rusks and coffee', calories: 180, mealType: 'breakfast' });
    server.online = false;
    const view = await renderWith(<Search />, stack);
    await fireEvent.changeText(await view.findByLabelText('Search foods'), 'rusks');
    expect(await view.findByText(/^Searching the food list needs the internet/)).toBeTruthy();
    expect(view.getByRole('button', { name: /^Rusks and coffee/ })).toBeTruthy();
    stack.sync.stop();
    await view.unmount();
  });

  it('asks Open Food Facts from the phone when you tap, and opens a product by its barcode', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ meal: 'dinner' });
    const products = [{ code: '6009188002213', product_name: 'Chakalaka', brands: 'Koo', countries_tags: ['en:south-africa'], serving_quantity: 100, serving_size: '100 g', nutriments: { 'energy-kcal_100g': 61 } }];
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ products }))) as unknown as typeof fetch;
    const stack = await testStack();
    const view = await renderWith(<Search />, stack);
    await fireEvent.changeText(await view.findByLabelText('Search foods'), 'chakalaka');
    expect(await view.findByText('Nothing called "chakalaka" in the food list yet.')).toBeTruthy();
    expect(global.fetch).not.toHaveBeenCalled(); // never while typing

    await fireEvent.press(view.getByRole('button', { name: 'Search Open Food Facts for "chakalaka"' }));
    await fireEvent.press(await view.findByRole('button', { name: 'Chakalaka, Koo, 61 calories per 100 g' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/food', params: { barcode: '6009188002213', meal: 'dinner' } });
    expect(view.getByText(/Product data from Open Food Facts/)).toBeTruthy();
    expect(jest.mocked(global.fetch).mock.calls[0][0]).toContain('search_terms=chakalaka');
    await settle(stack);
    await view.unmount();
  });

  it('shows what was added while it was open', async () => {
    const stack = await testStack();
    const view = await renderWith(<Search />, stack);
    await view.findByText('Recent');
    await stack.repo.addEntry({ name: 'Apple', calories: 95, mealType: 'snack', source: 'food' });
    expect(await view.findByText('Added Apple, 95 kcal')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Done' }));
    expect(router.back).toHaveBeenCalled();
    await settle(stack);
    await view.unmount();
  });
});

describe('Food screen from search', () => {
  it('opens a food by id for the chosen meal, saves it as from your foods, and opens it again offline', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'f-apple', meal: 'snack' });
    const server = new FakeServer();
    server.foods.set('apple', apple as unknown as Record<string, unknown>);
    const stack = await testStack(server);
    const view = await renderWith(<FoodScreen />, stack);
    expect(await view.findByText('Apples, raw, with skin')).toBeTruthy();
    expect(view.getByText('USDA FoodData Central')).toBeTruthy();
    expect(view.getByText('Nutrition from USDA FoodData Central.')).toBeTruthy();
    await fireEvent.changeText(view.getByLabelText('Grams'), '180');
    await fireEvent.press(view.getByRole('button', { name: 'Save to snack, 94 kcal' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await stack.repo.entriesFor(localDate())).toEqual([expect.objectContaining({ name: 'Apples, raw, with skin', calories: 94, quantityG: 180, mealType: 'snack', source: 'food', foodId: 'f-apple' })]);
    await view.unmount();

    server.online = false;
    const again = await renderWith(<FoodScreen />, stack);
    expect(await again.findByText('Apples, raw, with skin')).toBeTruthy();
    stack.sync.stop();
    await again.unmount();
  });

  it('says when a food has gone from the list, and goes back to search', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'gone' });
    const stack = await testStack();
    const view = await renderWith(<FoodScreen />, stack);
    expect(await view.findByText('This food is not there any more')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Back to search' }));
    expect(router.back).toHaveBeenCalled();
    await settle(stack);
    await view.unmount();
  });
});
