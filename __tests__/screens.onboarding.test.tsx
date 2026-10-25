import { fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import Onboarding from '../app/onboarding';
import { recommendGoals } from '../src/data/goals';
import { ONBOARDED_KEY } from '../src/data/profile';
import { PROFILE_KEY, type CachedProfile } from '../src/data/settings';
import { mount, settle } from './helpers/screen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(async () => {}), impactAsync: jest.fn(async () => {}), ImpactFeedbackStyle: { Light: 'light' } }));

afterEach(() => jest.clearAllMocks());

describe('Onboarding', () => {
  it('walks through goal, facts and activity to a plan, saves it and syncs it', async () => {
    const { view, stack, server } = await mount(<Onboarding />);
    await fireEvent.press(await view.findByRole('radio', { name: /^Build muscle/ }));
    await fireEvent.press(view.getByRole('button', { name: 'Let us go' }));

    // Facts are checked before moving on.
    await fireEvent.press(await view.findByRole('button', { name: 'Next' }));
    expect(await view.findByText('Enter the year you were born.')).toBeTruthy();
    await fireEvent.press(view.getByRole('radio', { name: 'Male' }));
    await fireEvent.changeText(view.getByLabelText('Year you were born'), '1996');
    await fireEvent.changeText(view.getByLabelText('Height'), '180');
    await fireEvent.changeText(view.getByLabelText('Weight'), '80');
    await fireEvent.press(view.getByRole('button', { name: 'Next' }));

    await fireEvent.press(await view.findByRole('radio', { name: /^Active\./ }));
    await fireEvent.press(view.getByRole('button', { name: 'Next' }));

    const expected = recommendGoals({ sex: 'male', birthYear: 1996, heightCm: 180, weightKg: 80, activityLevel: 'moderate', goal: 'gain', rateKgPerWeek: 0.25 }, Date.now());
    expect(await view.findByLabelText(`${expected.calories} calories a day`)).toBeTruthy();
    await fireEvent.press(view.getByRole('radio', { name: '½ kg' }));
    const faster = recommendGoals({ sex: 'male', birthYear: 1996, heightCm: 180, weightKg: 80, activityLevel: 'moderate', goal: 'gain', rateKgPerWeek: 0.5 }, Date.now());
    expect(await view.findByLabelText(`${faster.calories} calories a day`)).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: 'Start with this plan' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(await stack.repo.getMeta(ONBOARDED_KEY)).toBe(true);
    expect((await stack.repo.getMeta<CachedProfile>(PROFILE_KEY))?.profile.goals.calories).toBe(faster.calories);
    expect(await stack.repo.weights('2000-01-01')).toEqual([expect.objectContaining({ weightKg: 80 })]);

    await waitFor(() => expect(server.profilePatches).toContainEqual(expect.objectContaining({ goal: 'gain', goalRateKgPerWeek: 0.5, sex: 'male', activityLevel: 'moderate', onboarded: true })), { timeout: 4000 });
    await settle(stack);
    await view.unmount();
  });

  it('can be skipped', async () => {
    const { view, stack } = await mount(<Onboarding />);
    await fireEvent.press(await view.findByRole('button', { name: 'Skip for now' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(await stack.repo.getMeta(ONBOARDED_KEY)).toBe(true);
    await settle(stack);
    await view.unmount();
  });
});
