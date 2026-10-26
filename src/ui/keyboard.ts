import { useCallback, useEffect, useState } from 'react';
import { Keyboard, Platform, type LayoutChangeEvent } from 'react-native';

/**
 * How much room to leave under a screen's content so the keyboard does not cover it. Pure.
 *
 * `keyboard` is the height the keyboard events report: Android measures it above the navigation bar, so the bar's
 * height (`bottomInset`) is added back; iOS measures it from the bottom edge. `shrunk` is how much the window has
 * already shrunk for the keyboard: Android draws apps edge to edge, so normally nothing, but on a phone that still
 * resizes the window this stops the room being left twice.
 */
export function keyboardLift(platform: string, keyboard: number, bottomInset: number, shrunk: number): number {
  if (keyboard <= 0) return 0;
  const reach = platform === 'android' ? keyboard + bottomInset : keyboard;
  return Math.max(0, Math.round(reach - shrunk));
}

/**
 * For a screen with an input at the bottom (a chat): `lift` is the padding to put under its content while the keyboard
 * is open, and `onLayout` goes on the screen's outer view so a window that resizes itself is not lifted twice.
 */
export function useKeyboardLift(bottomInset: number): { lift: number; open: boolean; onLayout: (e: LayoutChangeEvent) => void } {
  const [keyboard, setKeyboard] = useState(0);
  const [heights, setHeights] = useState({ full: 0, now: 0 });
  useEffect(() => {
    // Android only sends the "did" events; iOS sends "will" ones in time to move with the keyboard.
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setKeyboard(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const now = e.nativeEvent.layout.height;
    setHeights((h) => ({ full: Math.max(h.full, now), now }));
  }, []);
  return { lift: keyboardLift(Platform.OS, keyboard, bottomInset, heights.full - heights.now), open: keyboard > 0, onLayout };
}
