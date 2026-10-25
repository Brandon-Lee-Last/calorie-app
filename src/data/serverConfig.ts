import type { components } from '../api/schema';

export type ServerConfig = components['schemas']['PublicConfig'];

/** Meta key: the newest version whose "update available" note the person closed, so it stays closed until a newer one. */
export const UPDATE_DISMISSED_KEY = 'update.dismissed';

const PACKAGE = 'io.lightarch.pango';
/** Where to update: the server's store link, else the app's Play Store page. */
export const storeUrl = (config: ServerConfig | undefined) => config?.urls.store ?? `https://play.google.com/store/apps/details?id=${PACKAGE}`;

export type Notice = { kind: 'required' } | { kind: 'maintenance'; message: string } | { kind: 'update'; version: string } | null;

/**
 * What to tell the person about the server, most important first. An app too old for the server cannot sync at all,
 * so that blocks the app; maintenance and a newer version are notes on Today.
 */
export function noticeFor(config: ServerConfig | undefined, dismissed: string | null | undefined): Notice {
  if (!config) return null;
  if (config.update === 'required') return { kind: 'required' };
  if (config.maintenance.enabled) return { kind: 'maintenance', message: config.maintenance.message };
  if (config.update === 'available' && dismissed !== config.latestAppVersion) return { kind: 'update', version: config.latestAppVersion };
  return null;
}
