import type { Outfit } from './types';

/** Meta key: whether Pango dresses for the moment (on unless the person turns it off in the wardrobe). */
export const MOMENT_KEY = 'pango.moment';

/** Where Pango is shown, for the screens that have an occasion. */
export type Moment = 'train' | 'cooking' | 'celebrate';

const FOR_MOMENT: Record<Moment, Outfit> = { train: 'gym', cooking: 'chef', celebrate: 'party' };

/**
 * The outfit Pango borrows for the moment, or null to wear the chosen look. Heritage Day (24 September) means the
 * protea everywhere. Moments borrow the outfit for the occasion; earning it in the wardrobe lets Pango wear it anywhere.
 */
export function momentOutfit(moment: Moment | undefined, enabled: boolean, now: Date): Outfit | null {
  if (!enabled) return null;
  if (now.getMonth() === 8 && now.getDate() === 24) return 'protea';
  return moment ? FOR_MOMENT[moment] : null;
}
