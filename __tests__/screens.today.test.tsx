import { fireEvent, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import AddEntry from '../app/add';
import Today from '../app/(tabs)/index';
import { localDate } from '../src/data/dates';
import { mount, renderWith, settle } from './helpers/screen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: jest.fn(() => ({})) }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(async () => {}), impactAsync: jest.fn(async () => {}), ImpactFeedbackStyle: { Light: 'light' } }));

afterEach(() => jest.clearAllMocks());

describe('Today', () => {
  it('starts empty, then shows meals, totals and the streak from the database', async () => {
    const { view, stack } = await mount(<Today />);
    expect(await view.findByText('Nothing logged yet today')).toBeTruthy();
    expect(view.getByLabelText('0 day streak')).toBeTruthy();
    await settle(stack);

    await stack.repo.addEntry({ name: 'Chicken and rice', calories: 540, proteinG: 42 });
    expect(await view.findByText('Chicken and rice')).toBeTruthy();
    expect(view.getByLabelText('540 of 2 000 calories eaten')).toBeTruthy();
    expect(view.getByLabelText('1 day streak')).toBeTruthy();
    expect(view.queryByText('Nothing logged yet today')).toBeNull();

    await fireEvent.press(view.getByRole('button', { name: /^Chicken and rice, 540 calories/ }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/add', params: { id: expect.any(String) } });
    await settle(stack);
    await view.unmount();
  });

  it('opens Ask Pango from Pango at the top', async () => {
    const { view, stack } = await mount(<Today />);
    await fireEvent.press(await view.findByRole('button', { name: 'Chat with Pango' }));
    expect(router.push).toHaveBeenCalledWith('/coach');
    await settle(stack);
    await view.unmount();
  });

  it('adds and takes back glasses of water', async () => {
    const { view, stack } = await mount(<Today />);
    await settle(stack);
    await fireEvent.press(await view.findByLabelText('Add a glass, 250 millilitres'));
    expect(await view.findByLabelText('1 of 10 glasses')).toBeTruthy();
    await fireEvent.press(view.getByLabelText('Add a glass, 250 millilitres'));
    expect(await view.findByLabelText('2 of 10 glasses')).toBeTruthy();
    await fireEvent.press(view.getByLabelText('Take back a glass'));
    expect(await view.findByLabelText('1 of 10 glasses')).toBeTruthy();
    expect(await stack.repo.waterFor(localDate())).toBe(250);
    await settle(stack);
    await view.unmount();
  });

  it('backs up what is logged and says so', async () => {
    const { view, stack, server } = await mount(<Today />);
    await settle(stack);
    await stack.repo.addWater(250);
    await waitFor(() => expect(server.records.size).toBe(1), { timeout: 4000 });
    expect(await view.findByText('Backed up.')).toBeTruthy();
    await view.unmount();
  });
});

describe('Add food', () => {
  it('saves a typed meal and closes', async () => {
    const { view, stack } = await mount(<AddEntry />);
    await fireEvent.changeText(await view.findByLabelText('What did you eat?'), 'Bunny chow');
    await fireEvent.changeText(view.getByLabelText('Calories'), '780');
    await fireEvent.changeText(view.getByLabelText('Fat'), '31,5');
    await fireEvent.press(view.getByRole('radio', { name: 'Dinner' }));
    await fireEvent.press(view.getByRole('button', { name: 'Add to today' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await stack.repo.entriesFor(localDate())).toEqual([expect.objectContaining({ name: 'Bunny chow', calories: 780, fatG: 31.5, mealType: 'dinner', source: 'manual' })]);
    await settle(stack);
    await view.unmount();
  });

  it('explains what is wrong instead of saving', async () => {
    const { view, stack } = await mount(<AddEntry />);
    await fireEvent.press(await view.findByRole('button', { name: 'Add to today' }));
    expect(await view.findByText('Enter the calories.')).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
    expect(await stack.repo.pendingCount()).toBe(0);
    await settle(stack);
    await view.unmount();
  });

  it('edits an existing entry', async () => {
    const { view, stack } = await mount(<AddEntry />);
    await settle(stack);
    await view.unmount();
    const e = await stack.repo.addEntry({ name: 'Pap', calories: 300 });
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: e.id });
    const edit = await renderWith(<AddEntry />, stack);
    const calories = await edit.findByDisplayValue('300');
    await fireEvent.changeText(calories, '350');
    await fireEvent.press(edit.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await stack.repo.entry(e.id))?.calories).toBe(350);
    await settle(stack);
    await edit.unmount();
  });
});
