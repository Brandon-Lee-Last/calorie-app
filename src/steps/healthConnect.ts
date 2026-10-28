import { Linking, Platform } from 'react-native';
import * as HC from 'react-native-health-connect';

import { kcalForSteps, kmForSteps, type Body } from '../data/steps';
import { shiftDate } from '../data/dates';
import type { Repo } from '../data/repo';

/** Where Health Connect stands on this phone, for steps. */
export type HealthState = 'unsupported' | 'not-installed' | 'needs-update' | 'not-connected' | 'connected';

/** The note on a day's steps record that says they came from Health Connect. */
export const FROM_HEALTH_CONNECT = 'Health Connect';
/** Meta key: set once the first month has been read, after which only the last few days are refreshed. */
export const STEPS_BACKFILLED_KEY = 'steps.backfilled';

const STEPS_READ = { accessType: 'read', recordType: 'Steps' } as const;
const hasSteps = (granted: readonly unknown[]) => granted.some((p) => typeof p === 'object' && p !== null && (p as { recordType?: string }).recordType === 'Steps' && (p as { accessType?: string }).accessType === 'read');

/**
 * Steps from Health Connect (Android), read only. Samsung Health, Google Fit, Fitbit and most watches save their step
 * counts there, and its daily total already avoids counting a walk twice when a phone and a watch both saw it.
 */
export const healthConnect = {
  async state(): Promise<HealthState> {
    if (Platform.OS !== 'android') return 'unsupported';
    const status = await HC.getSdkStatus();
    if (status === HC.SdkAvailabilityStatus.SDK_UNAVAILABLE) return 'not-installed';
    if (status === HC.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'needs-update';
    if (!(await HC.initialize())) return 'not-installed';
    return hasSteps(await HC.getGrantedPermissions()) ? 'connected' : 'not-connected';
  },

  /** Asks to read steps. True when allowed. */
  async connect(): Promise<boolean> {
    if (!(await HC.initialize())) return false;
    return hasSteps(await HC.requestPermission([STEPS_READ]));
  },

  /** The day's total steps, from local midnight to the end of the day (or now, for today). */
  async stepsOn(date: string, now: number = Date.now()): Promise<number> {
    const start = new Date(`${date}T00:00:00`).getTime();
    const end = Math.min(new Date(`${shiftDate(date, 1)}T00:00:00`).getTime(), now);
    if (end <= start) return 0;
    const result = await HC.aggregateRecord({ recordType: 'Steps', timeRangeFilter: { operator: 'between', startTime: new Date(start).toISOString(), endTime: new Date(end).toISOString() } });
    return Math.max(0, Math.round(result.COUNT_TOTAL ?? 0));
  },

  /** Health Connect's own screen, where access can be changed or taken back. */
  openSettings(): void {
    HC.openHealthConnectSettings();
  },

  /** Health Connect on Google Play, for phones older than Android 14 or with an old version. */
  openStore(): Promise<void> {
    return Linking.openURL('market://details?id=com.google.android.apps.healthdata').catch(() => Linking.openURL('https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata'));
  },
};

export type StepSource = Pick<typeof healthConnect, 'state' | 'stepsOn'>;

/**
 * Copies the recent days' steps from Health Connect into the diary's activity: the last month the first time (as far
 * back as Health Connect lets a newly connected app read), then the last three days, as a watch can sync late.
 * Days with no steps are skipped. Returns how many days were read, or null when Health Connect is not connected.
 */
export async function readHealthSteps(repo: Repo, source: StepSource, body: Body, today: string, now: number = Date.now()): Promise<number | null> {
  if ((await source.state()) !== 'connected') return null;
  const backfilled = await repo.getMeta<boolean>(STEPS_BACKFILLED_KEY);
  const days = backfilled ? 3 : 30;
  for (let i = 0; i < days; i++) {
    const date = shiftDate(today, -i);
    const steps = await source.stepsOn(date, now);
    if (steps > 0) await repo.setDaySteps(date, steps, { caloriesBurned: kcalForSteps(steps, body), distanceKm: kmForSteps(steps, body), note: FROM_HEALTH_CONNECT });
  }
  if (!backfilled) await repo.setMeta(STEPS_BACKFILLED_KEY, true);
  return days;
}
