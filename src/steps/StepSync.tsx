import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useData } from '../data/DataProvider';
import { localDate } from '../data/dates';
import { useProfile, useSettings } from '../data/hooks';
import type { Repo } from '../data/repo';
import type { Body } from '../data/steps';
import { healthConnect, readHealthSteps } from './healthConnect';

let running: Promise<number | null> | null = null;

/** Reads Health Connect now, unless a read is already under way (then waits for that one). */
export function syncHealthSteps(repo: Repo, body: Body): Promise<number | null> {
  running ??= readHealthSteps(repo, healthConnect, body, localDate()).finally(() => {
    running = null;
  });
  return running;
}

const EVERY_MS = 5 * 60_000;

/**
 * Keeps today's steps fresh while Pango is open, once Health Connect is connected: on start, whenever the app comes
 * back to the front, and every five minutes. Health Connect only lets an app read while it is open, so steps (and
 * any celebration) catch up when Pango is next opened.
 */
export function StepSync() {
  const { repo } = useData();
  const [{ stepsFrom }] = useSettings();
  const profile = useProfile();
  const heightCm = profile?.heightCm;
  const weightKg = profile?.weightKg;
  useEffect(() => {
    if (stepsFrom !== 'health-connect') return;
    const run = () => {
      syncHealthSteps(repo, { heightCm, weightKg }).catch((e) => console.warn('Reading steps failed', e));
    };
    run();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
    const timer = setInterval(() => AppState.currentState === 'active' && run(), EVERY_MS);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [repo, stepsFrom, heightCm, weightKg]);
  return null;
}
