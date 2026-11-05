import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Share } from 'react-native';

import NewFood from '../app/newfood';
import RewardsScreen from '../app/rewards';
import { ApiError } from '../src/api/errors';
import { addsUp, codeProblem, inviteMessage, parseFoodForm, towardsMonth } from '../src/data/rewards';
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

const form = { name: 'Ouma rusks', brand: '', barcode: '', calories: '430', protein: '9', carbs: '70', fat: '12', serving: '' };

describe('rules on the phone', () => {
  it('checks a food from the pack the way the server does', () => {
    expect(addsUp({ calories: 430, protein: 9, carbs: 70, fat: 12 })).toBe(true);
    expect(addsUp({ calories: 900, protein: 1, carbs: 1, fat: 1 })).toBe(false);
    expect(parseFoodForm(form)).toMatchObject({ ok: true, value: { name: 'Ouma rusks', barcode: null, calories100g: 430, servingG: null } });
    expect(parseFoodForm({ ...form, barcode: '600 1087 340069', calories: '4,5e', serving: '32' })).toEqual({ ok: false, errors: { calories: '0 to 900.' } });
    expect(parseFoodForm({ ...form, name: ' ', barcode: '123', protein: '' })).toEqual({ ok: false, errors: { name: 'What is it called?', barcode: 'A barcode is 8, 12, 13 or 14 digits.', protein: 'From the label, per 100 g.' } });
  });

  it('explains a code that did not work, and builds the invite', () => {
    expect(codeProblem(new ApiError(400, 'bad_request', 'x', { reason: 'own_code' }))).toMatch(/your own code/);
    expect(codeProblem(new ApiError(0, 'network', 'x'))).toMatch(/connection/);
    expect(inviteMessage('PK7XQ2M')).toContain('PK7XQ2M');
    expect(towardsMonth({ points: 250, monthCost: 1000 })).toBe(0.25);
    expect(towardsMonth({ points: 1500, monthCost: 1000 })).toBe(1);
  });
});

describe('Pango Points', () => {
  it('shows the balance and code, shares the invite, takes a gym code and explains a wrong one', async () => {
    const server = new FakeServer();
    const stack = await testStack(server);
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    const view = await renderWith(<RewardsScreen />, stack);
    expect(await view.findByLabelText('120 points')).toBeTruthy();
    expect(view.getByText('PK7XQ2M')).toBeTruthy();
    expect(view.queryByRole('button', { name: 'Get a month of Plus' })).toBeNull(); // not enough yet
    await fireEvent.press(view.getByRole('button', { name: 'Share' }));
    expect(share).toHaveBeenCalledWith({ message: expect.stringContaining('PK7XQ2M') });

    await fireEvent.changeText(view.getByLabelText('A friend’s invite code or your gym’s code'), 'pk7xq2m');
    await fireEvent.press(view.getByRole('button', { name: 'Use code' }));
    expect(await view.findByText('That is your own code. Share it with friends instead.')).toBeTruthy();
    await fireEvent.changeText(view.getByLabelText('A friend’s invite code or your gym’s code'), 'fit hub');
    await fireEvent.press(view.getByRole('button', { name: 'Use code' }));
    expect(await view.findByText('Welcome from Fit Hub Sandton! You got 200 points.')).toBeTruthy();
    expect(await view.findByLabelText('320 points')).toBeTruthy();
    expect(view.getByText('You joined with Fit Hub Sandton.')).toBeTruthy();
    await settle(stack);
    await view.unmount();
  });

  it('spends points on a month of Plus once there are enough', async () => {
    const server = new FakeServer();
    server.rewards.points = 1250;
    const stack = await testStack(server);
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.text === 'Get Plus')?.onPress?.());
    const view = await renderWith(<RewardsScreen />, stack);
    await fireEvent.press(await view.findByRole('button', { name: 'Get a month of Plus' }));
    expect(await view.findByText(/^Plus from points until/)).toBeTruthy();
    expect(view.getByLabelText('250 points')).toBeTruthy();
    await settle(stack);
    await view.unmount();
  });
});

describe('Adding a food', () => {
  it('saves a product from its pack with the scanned barcode, then opens it to log with the points shown', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ barcode: '6001087340069', meal: 'snack' });
    const server = new FakeServer();
    const stack = await testStack(server);
    const view = await renderWith(<NewFood />, stack);
    expect(view.getByLabelText('Barcode (optional)').props.value).toBe('6001087340069');
    await fireEvent.press(view.getByRole('button', { name: 'Add to the food list' }));
    expect(view.getByText('What is it called?')).toBeTruthy();
    await fireEvent.changeText(view.getByLabelText('Name'), 'Ouma rusks');
    await fireEvent.changeText(view.getByLabelText('Energy'), '900');
    await fireEvent.changeText(view.getByLabelText('Protein'), '9');
    await fireEvent.changeText(view.getByLabelText('Carbs'), '70');
    await fireEvent.changeText(view.getByLabelText('Fat'), '12');
    expect(view.getByText(/These numbers do not add up/)).toBeTruthy();
    await fireEvent.changeText(view.getByLabelText('Energy'), '430');
    expect(view.queryByText(/These numbers do not add up/)).toBeNull();
    await act(async () => fireEvent.press(view.getByRole('button', { name: 'Add to the food list' })));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/food', params: { id: expect.any(String), meal: 'snack', added: '20' } }));
    expect(server.foods.get('6001087340069')).toMatchObject({ name: 'Ouma rusks', calories100g: 430, barcode: '6001087340069' });
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    await settle(stack);
    await view.unmount();
  });
});
