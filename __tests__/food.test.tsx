import { fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import FoodScreen from '../app/food';
import { localDate } from '../src/data/dates';
import { amountLabel, defaultAmount, entryFromFood, nutritionFor, type Food } from '../src/data/foodMath';
import { FakeServer } from './helpers/fakeServer';
import { mount, settle } from './helpers/screen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() }, useLocalSearchParams: () => ({ barcode: '6001087340069' }) }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(async () => {}), impactAsync: jest.fn(async () => {}), ImpactFeedbackStyle: { Light: 'light' } }));

const muesli: Food = {
  id: 'f1', source: 'openfoodfacts', isOwn: false, barcode: '6001087340069', name: 'Crunchy muesli', brand: 'Jungle',
  servingG: 45, servingLabel: '1 cup (45 g)', calories100g: 410, protein100g: 9.1, carb100g: 66, fat100g: 12.4,
  fiber100g: 7.4, sugar100g: 22, sodiumMg100g: 210, dishId: null, perServing: null, clientUpdatedAt: 0, updatedAt: 0, deletedAt: null, rev: 1,
};

describe('food maths', () => {
  it('scales per-100 g values to the amount', () => {
    expect(nutritionFor(muesli, 45)).toEqual({ calories: 185, proteinG: 4.1, carbG: 29.7, fatG: 5.6, fiberG: 3.3, sugarG: 9.9, sodiumMg: 95 });
  });

  it('starts at one serving when the pack gives one, else 100 g', () => {
    expect(defaultAmount(muesli)).toEqual({ unit: 'serving', servings: 1 });
    expect(defaultAmount({ ...muesli, servingG: null })).toEqual({ unit: 'g', grams: 100 });
    expect(amountLabel(muesli, { unit: 'serving', servings: 1.5 })).toBe('1½ servings (68 g)');
  });

  it('makes a diary entry linked to the food', () => {
    expect(entryFromFood(muesli, { unit: 'serving', servings: 2 }, 'breakfast')).toMatchObject({
      name: 'Crunchy muesli (Jungle)', foodId: 'f1', quantityG: 90, servings: 2, calories: 369, mealType: 'breakfast', source: 'barcode',
    });
  });
});

afterEach(() => jest.clearAllMocks());

describe('Food screen', () => {
  it('shows the product, changes the amount and saves it', async () => {
    const server = new FakeServer();
    server.foods.set('6001087340069', muesli as unknown as Record<string, unknown>);
    const { view, stack } = await mount(<FoodScreen />, server);
    expect(await view.findByText('Crunchy muesli')).toBeTruthy();
    expect(view.getByText('1 serving (45 g)')).toBeTruthy();
    expect(view.getByText(/Open Food Facts/)).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'More' }));
    expect(view.getByText('1½ servings (68 g)')).toBeTruthy();
    await fireEvent.press(view.getByRole('radio', { name: 'Grams' }));
    await fireEvent.changeText(view.getByLabelText('Grams'), '60');
    await fireEvent.press(view.getByRole('radio', { name: 'Breakfast' }));
    await fireEvent.press(view.getByRole('button', { name: 'Save to breakfast, 246 kcal' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await stack.repo.entriesFor(localDate())).toEqual([expect.objectContaining({ name: 'Crunchy muesli (Jungle)', calories: 246, quantityG: 60, servings: null, source: 'barcode', foodId: 'f1' })]);
    await settle(stack);
    await view.unmount();
  });

  it('says when a product is unknown, and offers to add it by hand', async () => {
    const { view, stack } = await mount(<FoodScreen />);
    expect(await view.findByText('Pango does not know this one yet')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Add it by hand' }));
    expect(router.replace).toHaveBeenCalledWith('/add');
    await settle(stack);
    await view.unmount();
  });

  it('says when it is offline, and tries again', async () => {
    const server = new FakeServer();
    server.online = false;
    const { view, stack } = await mount(<FoodScreen />, server);
    expect(await view.findByText('No connection')).toBeTruthy();
    server.online = true;
    server.foods.set('6001087340069', muesli as unknown as Record<string, unknown>);
    await fireEvent.press(view.getByRole('button', { name: 'Try again' }));
    expect(await view.findByText('Crunchy muesli')).toBeTruthy();
    await stack.sync.syncNow().catch(() => {});
    await settle(stack);
    await view.unmount();
  });
});
