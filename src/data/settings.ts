import type { components } from '../api/schema';

export type Goals = components['schemas']['GoalsInput'];
export type Profile = components['schemas']['Profile'];

/** Used until there is a profile; the same as the backend's defaults. */
export const DEFAULT_GOALS: Goals = { calories: 2000, proteinG: 125, carbG: 225, fatG: 67 };

/** Preferences kept on this phone only. */
export type Settings = { waterGoalMl: number; glassMl: number };

export const DEFAULT_SETTINGS: Settings = { waterGoalMl: 2500, glassMl: 250 };

export const SETTINGS_KEY = 'settings';
export const PROFILE_KEY = 'profile';

export type CachedProfile = { fetchedAt: number; profile: Profile };
