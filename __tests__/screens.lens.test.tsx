import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import Lens from '../app/lens';
import { ThemeProvider } from '../src/theme/theme';

const mockCamera = { takePictureAsync: jest.fn(async () => ({ uri: 'file:///shot.jpg', width: 1, height: 1 })), onBarcodeScanned: undefined as undefined | ((r: { data: string; type: string }) => void) };

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() }, useLocalSearchParams: () => ({}) }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(async () => {}), impactAsync: jest.fn(async () => {}), ImpactFeedbackStyle: { Medium: 'medium' } }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: 'file:///picked.jpg' }] })) }));
jest.mock('../src/scan/model', () => ({ getModel: jest.fn(async () => ({})) }));
jest.mock('expo-camera', () => {
  const { forwardRef, useImperativeHandle } = require('react');
  const { View } = require('react-native');
  return {
    useCameraPermissions: jest.fn(),
    CameraView: forwardRef(function CameraView(props: { onBarcodeScanned?: (r: { data: string; type: string }) => void }, ref: unknown) {
      mockCamera.onBarcodeScanned = props.onBarcodeScanned;
      useImperativeHandle(ref, () => ({ takePictureAsync: mockCamera.takePictureAsync }));
      return <View testID="camera" />;
    }),
  };
});

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const show = () =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider scheme="dark">
        <Lens />
      </ThemeProvider>
    </SafeAreaProvider>,
  );

afterEach(() => jest.clearAllMocks());

describe('Lens', () => {
  it('asks for the camera first', async () => {
    const request = jest.fn();
    jest.mocked(useCameraPermissions).mockReturnValue([{ granted: false, canAskAgain: true } as never, request, jest.fn()]);
    const view = await show();
    await fireEvent.press(view.getByRole('button', { name: 'Allow the camera' }));
    expect(request).toHaveBeenCalled();
    expect(view.queryByTestId('camera')).toBeNull();
    await view.unmount();
  });

  it('takes the photo and opens the result', async () => {
    jest.mocked(useCameraPermissions).mockReturnValue([{ granted: true, canAskAgain: true } as never, jest.fn(), jest.fn()]);
    const view = await show();
    await fireEvent.press(view.getByRole('button', { name: 'Take the photo' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/scan', params: { uri: 'file:///shot.jpg' } }));
    await view.unmount();
  });

  it('opens a photo from the gallery', async () => {
    jest.mocked(useCameraPermissions).mockReturnValue([{ granted: true, canAskAgain: true } as never, jest.fn(), jest.fn()]);
    const view = await show();
    await fireEvent.press(view.getByRole('button', { name: 'Choose a photo' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/scan', params: { uri: 'file:///picked.jpg' } }));
    await view.unmount();
  });

  it('reads barcodes only in barcode mode, and only once', async () => {
    jest.mocked(useCameraPermissions).mockReturnValue([{ granted: true, canAskAgain: true } as never, jest.fn(), jest.fn()]);
    const view = await show();
    expect(mockCamera.onBarcodeScanned).toBeUndefined();
    await fireEvent.press(view.getByRole('radio', { name: 'Barcode' }));
    mockCamera.onBarcodeScanned?.({ data: '6001234567890', type: 'ean13' });
    mockCamera.onBarcodeScanned?.({ data: '6001234567890', type: 'ean13' });
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/food', params: { barcode: '6001234567890' } });
    await view.unmount();
  });
});
