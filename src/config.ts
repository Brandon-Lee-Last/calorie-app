import Constants from 'expo-constants';
import { Platform } from 'react-native';

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string; offUserAgent?: string };

/**
 * The backend. Set EXPO_PUBLIC_API_URL when starting Metro or building (or `expo.extra.apiUrl` in app.json).
 * The default reaches `wrangler dev` on the PC from the Android emulator (10.0.2.2 is the PC as the emulator sees it).
 * A real phone needs the PC's Wi-Fi address instead, for example http://192.168.1.20:8787.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || extra.apiUrl || (Platform.OS === 'android' ? 'http://10.0.2.2:8787' : 'http://127.0.0.1:8787')).replace(/\/+$/, '');

export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

/** Shown on the server's list of signed-in devices. */
export const DEVICE_LABEL = (Constants.deviceName || (Platform.OS === 'android' ? 'Android phone' : 'Phone')).slice(0, 64);

/**
 * Open Food Facts asks every app to name itself (and a way to reach its maker) in the User-Agent. Put a contact in
 * `expo.extra.offUserAgent` before release, for example "Pango/1.0 (you@example.com)".
 */
export const OFF_USER_AGENT = extra.offUserAgent || `Pango/${APP_VERSION} (Android)`;
