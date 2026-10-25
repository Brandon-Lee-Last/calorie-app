import { fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import ScanResult from '../app/scan';
import { localDate } from '../src/data/dates';
import { analysePhoto } from '../src/scan/model';
import { keepPhoto } from '../src/scan/photos';
import { mount, settle } from './helpers/screen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() }, useLocalSearchParams: () => ({ uri: 'file:///photo.jpg' }) }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(async () => {}), impactAsync: jest.fn(async () => {}), ImpactFeedbackStyle: { Light: 'light' } }));
// The model needs the phone's TFLite library; here it answers with fixed numbers.
jest.mock('../src/scan/model', () => ({ analysePhoto: jest.fn(), getModel: jest.fn() }));
jest.mock('../src/scan/photos', () => ({ keepPhoto: jest.fn(async () => 'file:///kept.jpg'), photoFor: jest.fn(() => null), deletePhoto: jest.fn() }));

const plate = { calories: 643.7, mass: 312.4, fat: 21.4, carb: 70.6, protein: 38.2 };

afterEach(() => jest.clearAllMocks());

describe('Scan result', () => {
  it('shows the estimate, scales the portion and saves it to the chosen meal', async () => {
    jest.mocked(analysePhoto).mockResolvedValue({ nutrition: plate, food: 0.96, inferenceMs: 40 });
    const { view, stack, server } = await mount(<ScanResult />);
    expect(await view.findByLabelText('About 640 calories')).toBeTruthy();
    expect(view.getByText('Food spotted')).toBeTruthy();
    expect(view.getByText(/usually within 80 kcal/)).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: 'Bigger portion' }));
    expect(view.getByText('1¼ plates')).toBeTruthy();
    expect(view.getByLabelText('About 800 calories')).toBeTruthy();
    await fireEvent.changeText(view.getByLabelText('What is it? (optional)'), 'Chicken curry and rice');
    await fireEvent.press(view.getByRole('radio', { name: 'Dinner' }));
    await fireEvent.press(view.getByRole('button', { name: 'Save to dinner, 800 kcal' }));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const [entry] = await stack.repo.entriesFor(localDate());
    expect(entry).toMatchObject({ name: 'Chicken curry and rice', calories: 800, quantityG: 390, mealType: 'dinner', source: 'scan', scanId: expect.any(String) });
    expect(keepPhoto).toHaveBeenCalledWith(entry.scanId, 'file:///photo.jpg');
    // The record goes out with the next sync: the model's raw numbers and what was saved.
    await waitFor(() => expect(server.scans.get(entry.scanId!)).toMatchObject({ outcome: 'edited', portion: 1.25, predicted: { calories: 643.7 }, final: { calories: 800 } }), { timeout: 4000 });
    await settle(stack);
    await view.unmount();
  });

  it('says when the photo does not look like food, and can estimate anyway', async () => {
    jest.mocked(analysePhoto).mockResolvedValue({ nutrition: plate, food: 0.08, inferenceMs: 40 });
    const { view, stack } = await mount(<ScanResult />);
    expect(await view.findByText('This does not look like food')).toBeTruthy();
    expect(view.queryByLabelText('About 640 calories')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Estimate anyway' }));
    expect(await view.findByLabelText('About 640 calories')).toBeTruthy();
    await settle(stack);
    await view.unmount();
  });

  it('records a rejected photo when the person takes another', async () => {
    jest.mocked(analysePhoto).mockResolvedValue({ nutrition: plate, food: 0.08, inferenceMs: 40 });
    const { view, stack } = await mount(<ScanResult />);
    await fireEvent.press(await view.findByRole('button', { name: 'Take another photo' }));
    expect(router.back).toHaveBeenCalled();
    await waitFor(async () => expect((await stack.db.all<{ body: string }>('SELECT body FROM scans')).map((r) => JSON.parse(r.body).outcome)).toEqual(['not_food']));
    expect(await stack.repo.entriesFor(localDate())).toEqual([]);
    await settle(stack);
    await view.unmount();
  });

  it('explains a photo it could not read', async () => {
    jest.mocked(analysePhoto).mockRejectedValue(new Error('Could not decode the image'));
    const { view, stack } = await mount(<ScanResult />);
    expect(await view.findByText('Could not decode the image')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Add it by hand' }));
    expect(router.replace).toHaveBeenCalledWith('/add');
    await settle(stack);
    await view.unmount();
  });
});
