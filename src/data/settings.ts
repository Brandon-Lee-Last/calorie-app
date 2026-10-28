import type { components } from '../api/schema';

export type Goals = components['schemas']['GoalsInput'];
export type Profile = components['schemas']['Profile'];

/** Used until there is a profile; the same as the backend's defaults. */
export const DEFAULT_GOALS: Goals = { calories: 2000, proteinG: 125, carbG: 225, fatG: 67 };

/**
 * Preferences kept on this phone only. `eatBack` is how much of the energy burned (training, and walking beyond a usual
 * day) is added to the day's food. `stepGoal` and `burnGoal` are the daily activity goals; `stepsFrom` is where steps
 * come from: Health Connect once connected, else typed in.
 */
export type Settings = { waterGoalMl: number; glassMl: number; eatBack: 'none' | 'half' | 'all'; workoutsPerWeek: number; stepGoal: number; burnGoal: number; stepsFrom: 'health-connect' | 'manual' };

export const DEFAULT_SETTINGS: Settings = { waterGoalMl: 2500, glassMl: 250, eatBack: 'half', workoutsPerWeek: 3, stepGoal: 8000, burnGoal: 300, stepsFrom: 'manual' };

export const EAT_BACK_FACTOR: Record<Settings['eatBack'], number> = { none: 0, half: 0.5, all: 1 };

export const SETTINGS_KEY = 'settings';
export const PROFILE_KEY = 'profile';

export type CachedProfile = { fetchedAt: number; profile: Profile };
