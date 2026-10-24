import type { components } from '../api/schema';

export type Goals = components['schemas']['GoalsInput'];
export type Profile = components['schemas']['Profile'];

/** Used until the profile arrives from the server. */
export const DEFAULT_GOALS: Goals = { calories: 2000, proteinG: 130, carbG: 220, fatG: 65 };

/** Preferences kept on this phone only. */
export type Settings = { waterGoalMl: number; glassMl: number };

export const DEFAULT_SETTINGS: Settings = { waterGoalMl: 2500, glassMl: 250 };

export const SETTINGS_KEY = 'settings';
export const PROFILE_KEY = 'profile';

export type CachedProfile = { fetchedAt: number; profile: Profile };
