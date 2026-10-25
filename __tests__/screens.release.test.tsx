import { fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert, Linking } from 'react-native';

import Today from '../app/(tabs)/index';
import Me from '../app/(tabs)/me';
import Wardrobe from '../app/wardrobe';
import { localDate } from '../src/data/dates';
import { shareJson } from '../src/data/exportFile';
import { UPDATE_DISMISSED_KEY } from '../src/data/serverConfig';
import { MOMENT_KEY } from '../src/pango/moments';
import { deleteAllPhotos } from '../src/scan/photos';
import { FakeServer } from './helpers/fakeServer';
import { renderWith, settle, testStack } from './helpers/screen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() }, useLocalSearchParams: jest.fn(() => ({})) }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(async () => {}), impactAsync: jest.fn(async () => {}), notificationAsync: jest.fn(async () => {}), ImpactFeedbackStyle: { Light: 'light' }, NotificationFeedbackType: { Success: 'success' } }));
jest.mock('../src/data/exportFile', () => ({ shareJson: jest.fn(async () => {}) }));
jest.mock('../src/scan/photos', () => ({ photoFor: jest.fn(() => null), keepPhoto: jest.fn(), deletePhoto: jest.fn(), deleteAllPhotos: jest.fn() }));

afterEach(() => jest.restoreAllMocks());
afterEach(() => jest.clearAllMocks());

/** Answers Alert.alert by pressing the button with this text. */
const pressInAlert = (text: string) => jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.text === text)?.onPress?.());

describe('Me: your data', () => {
  it('downloads everything as a file to save or send', async () => {
    const server = new FakeServer();
    const stack = await testStack(server);
    await stack.repo.addEntry({ name: 'Oats', calories: 320, mealType: 'breakfast' });
    const view = await renderWith(<Me />, stack);
    await fireEvent.press(await view.findByRole('button', { name: 'Download my data' }));
    await waitFor(() => expect(shareJson).toHaveBeenCalled());
    const [name, data] = jest.mocked(shareJson).mock.calls[0];
    expect(name).toBe(`pango-data-${localDate()}.json`);
    expect((data as { records: { name?: string }[] }).records.map((r) => r.name)).toEqual(['Oats']);
    await settle(stack);
    await view.unmount();
  });

  it('deletes the account after asking, empties the phone and starts again', async () => {
    const server = new FakeServer();
    const stack = await testStack(server);
    await stack.repo.addEntry({ name: 'Oats', calories: 320, mealType: 'breakfast' });
    await stack.sync.syncNow();
    const alert = pressInAlert('Delete everything');
    const view = await renderWith(<Me />, stack);
    await fireEvent.press(await view.findByRole('button', { name: 'Delete my account' }));
    expect(alert.mock.calls[0][0]).toBe('Delete your account?');
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/onboarding'));
    expect(server.deletedAccounts).toEqual(['user-1']);
    expect(deleteAllPhotos).toHaveBeenCalled();
    expect(await stack.repo.entriesFor(localDate())).toEqual([]);
    stack.sync.stop();
    await view.unmount();
  });

  it('keeps everything and says so when the server cannot be reached', async () => {
    const server = new FakeServer();
    const stack = await testStack(server);
    await stack.repo.addEntry({ name: 'Oats', calories: 320, mealType: 'breakfast' });
    await stack.sync.syncNow();
    server.online = false;
    const alert = pressInAlert('Delete everything');
    const view = await renderWith(<Me />, stack);
    await fireEvent.press(await view.findByRole('button', { name: 'Delete my account' }));
    await waitFor(() => expect(alert.mock.calls.map((c) => c[0])).toContain('Nothing was deleted'));
    expect(router.replace).not.toHaveBeenCalled();
    expect(await stack.repo.entriesFor(localDate())).toHaveLength(1);
    stack.sync.stop();
    await view.unmount();
  });
});

describe('Today: notes from the server', () => {
  it('says when the server is having a break', async () => {
    const server = new FakeServer();
    server.maintenance = { enabled: true, message: 'Back by 10:00.' };
    const stack = await testStack(server);
    const view = await renderWith(<Today />, stack);
    expect(await view.findByText('Pango is having a short break')).toBeTruthy();
    expect(view.getByText(/^Back by 10:00\. Everything you log is kept on your phone/)).toBeTruthy();
    await settle(stack);
    await view.unmount();
  });

  it('offers a newer version until it is closed', async () => {
    const server = new FakeServer();
    server.update = 'available';
    server.latestAppVersion = '1.1.0';
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const stack = await testStack(server);
    const view = await renderWith(<Today />, stack);
    expect(await view.findByText('A new version of Pango is out')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Update' }));
    expect(open).toHaveBeenCalledWith('https://play.google.com/store/apps/details?id=com.brandonleelast.calorieapp');
    await fireEvent.press(view.getByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(view.queryByText('A new version of Pango is out')).toBeNull());
    expect(await stack.repo.getMeta(UPDATE_DISMISSED_KEY)).toBe('1.1.0');
    await settle(stack);
    await view.unmount();
  });
});

describe('Wardrobe: dress for the moment', () => {
  it('is on until switched off', async () => {
    const stack = await testStack();
    const view = await renderWith(<Wardrobe />, stack);
    const toggle = await view.findByLabelText('Dress for the moment');
    expect(toggle.props.value).toBe(true);
    await fireEvent(toggle, 'valueChange', false);
    await waitFor(async () => expect(await stack.repo.getMeta(MOMENT_KEY)).toBe(false));
    await settle(stack);
    await view.unmount();
  });
});
