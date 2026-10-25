import type { StatKey, Stats } from '../data/achievements';
import { OUTFIT_LOOKS, CLASSIC } from './looks';
import type { Look, Outfit } from './types';

/** How an item is earned. Everything in the wardrobe is earned, never sold. */
export type Rule = { free: string } | { stat: StatKey; need: number; what: (n: number) => string };

/** Meta key: earned item ids the person has seen in the wardrobe (for the "new" badge). */
export const SEEN_KEY = 'wardrobe.seen';

export type Slot = 'outfit' | 'hat' | 'glasses' | 'scarf' | 'scales' | 'pin';
export type Item = { slot: Slot; id: string; name: string; rule: Rule };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const R = {
  workouts: (need: number): Rule => ({ stat: 'workouts', need, what: (n) => plural(n, 'workout') }),
  typed: (need: number): Rule => ({ stat: 'typedMeals', need, what: (n) => `${plural(n, 'meal')} typed in` }),
  days: (need: number): Rule => ({ stat: 'daysLogged', need, what: (n) => `${plural(n, 'day')} logged` }),
  meals: (need: number): Rule => ({ stat: 'meals', need, what: (n) => `${plural(n, 'meal')} logged` }),
  streak: (need: number): Rule => ({ stat: 'bestStreak', need, what: (n) => `a ${n}-day streak` }),
  recaps: (need: number): Rule => ({ stat: 'recaps', need, what: (n) => plural(n, 'weekly recap') }),
  weekends: (need: number): Rule => ({ stat: 'weekends', need, what: (n) => `logging ${plural(n, 'weekend')}` }),
  protein: (need: number): Rule => ({ stat: 'proteinDays', need, what: (n) => `hitting protein ${plural(n, 'day')}` }),
  rooibos: (need: number): Rule => ({ stat: 'rooibos', need, what: (n) => `${n} rooibos logged` }),
  water: (need: number): Rule => ({ stat: 'waterRun', need, what: (n) => `your water goal ${n} days running` }),
  scans: (need: number): Rule => ({ stat: 'scans', need, what: (n) => (n === 1 ? 'your first scan' : `${n} scans`) }),
  veg: (need: number): Rule => ({ stat: 'veg', need, what: (n) => `${n} vegetable dishes logged` }),
  goalDays: (need: number): Rule => ({ stat: 'goalDays', need, what: (n) => (n === 1 ? 'your first day on target' : `${n} days on target`) }),
  shared: (): Rule => ({ stat: 'sharedRecap', need: 1, what: () => 'sharing a recap' }),
};

const item = (slot: Slot) => (id: string, name: string, rule: Rule): Item => ({ slot, id, name, rule });
const outfit = item('outfit');
const hat = item('hat');
const specs = item('glasses');
const scarf = item('scarf');
const scale = item('scales');
const pin = item('pin');

export const WARDROBE: Record<Slot, Item[]> = {
  outfit: [
    outfit('none', 'Classic', { free: 'The original Pango' }),
    outfit('gym', 'Gym', R.workouts(5)),
    outfit('chef', 'Chef', R.typed(10)),
    outfit('beach', 'Beach', R.days(30)),
    outfit('winter', 'Winter', R.meals(50)),
    outfit('party', 'Party', R.streak(14)),
    outfit('royal', 'Royal', R.streak(30)),
    outfit('protea', 'Protea', { free: 'A Heritage Day gift' }),
    outfit('scholar', 'Scholar', R.recaps(4)),
    outfit('weekend', 'Weekend', R.weekends(4)),
  ],
  hat: [
    hat('none', 'None', { free: 'Bare-headed' }),
    hat('beanie', 'Beanie', R.meals(50)),
    hat('bucket', 'Bucket', R.days(30)),
    hat('cap', 'Cap', R.weekends(4)),
    hat('chef', 'Chef', R.typed(10)),
    hat('headband', 'Band', R.workouts(5)),
    hat('party', 'Party', R.streak(14)),
    hat('crown', 'Crown', R.streak(30)),
    hat('protea', 'Protea', { free: 'A Heritage Day gift' }),
  ],
  glasses: [
    specs('none', 'None', { free: 'No glasses' }),
    specs('round', 'Round', R.recaps(4)),
    specs('sunnies', 'Sunnies', R.weekends(4)),
    specs('stars', 'Stars', R.streak(14)),
  ],
  scarf: [
    scarf('#FF5D73', 'Guava', { free: 'Your first scarf' }),
    scarf('#FFC04D', 'Amber', R.meals(20)),
    scarf('#7C9CFF', 'Periwinkle', R.protein(5)),
    scarf('#B8F25B', 'Lime', R.streak(7)),
    scarf('#E58BFF', 'Orchid', R.streak(14)),
    scarf('#B5523B', 'Rooibos', R.rooibos(10)),
    scarf('#2FD3A1', 'Mint', R.water(5)),
    scarf('#3A4460', 'Ink', R.scans(1)),
  ],
  scales: [
    scale('classic', 'Classic', { free: 'Pango as hatched' }),
    scale('honey', 'Honey', R.streak(30)),
    scale('cocoa', 'Cocoa', R.scans(25)),
    scale('rooibos', 'Rooibos', R.rooibos(10)),
    scale('slate', 'Slate', R.recaps(4)),
    scale('sage', 'Sage', R.veg(100)),
  ],
  pin: [
    pin('none', 'None', { free: 'No pin' }),
    pin('star', 'Star', R.goalDays(1)),
    pin('heart', 'Heart', R.shared()),
    pin('bolt', 'Bolt', R.workouts(5)),
    pin('leaf', 'Leaf', R.veg(100)),
  ],
};

export const HAT_COLOURS = ['#7C9CFF', '#FF5D73', '#B8F25B', '#FFC04D', '#E58BFF', '#3A4460'];

export type ItemState = { open: boolean; how: string; progress: number };

/** Whether an item is earned, and the line that says how (with progress while locked). */
export function stateOf(item: Item, stats: Stats | null): ItemState {
  if ('free' in item.rule) return { open: true, how: item.rule.free, progress: 1 };
  const have = stats?.[item.rule.stat] ?? 0;
  const { need, what } = item.rule;
  if (have >= need) return { open: true, how: `Earned for ${what(need)}`, progress: 1 };
  return { open: false, how: `Unlocks with ${what(need)} (${Math.min(have, need)} so far)`, progress: have / need };
}

/** What Pango wears: an outfit (or 'custom' once parts are changed) and every part. */
export type WornLook = Look & { outfit: Outfit | 'custom' };

export const CLASSIC_LOOK: WornLook = { ...CLASSIC, outfit: 'none' };

export function lookForOutfit(id: Outfit): WornLook {
  return { ...CLASSIC, ...OUTFIT_LOOKS[id], outfit: id };
}

const find = (slot: Slot, id: string) => WARDROBE[slot].find((i) => i.id === id);

/** The first reason this look cannot be worn yet, or null. A whole earned outfit counts, whatever its parts. */
export function blockerFor(look: WornLook, stats: Stats | null): string | null {
  if (look.outfit !== 'custom' && look.outfit !== 'none') {
    const o = find('outfit', look.outfit);
    const s = o ? stateOf(o, stats) : null;
    return s && !s.open ? s.how : null;
  }
  const parts: [Slot, string][] = [
    ['hat', look.hat],
    ['glasses', look.glasses],
    ['scarf', look.scarf],
    ['scales', look.scales],
    ['pin', look.pin],
  ];
  for (const [slot, id] of parts) {
    const i = find(slot, id);
    if (i && !stateOf(i, stats).open) return stateOf(i, stats).how;
  }
  return null;
}

/** "Gym: band, lime scarf" for the stage caption. */
export function describeLook(look: WornLook): string {
  const hatName = look.hat === 'none' ? '' : (find('hat', look.hat)?.name.toLowerCase() ?? look.hat);
  const glassesName = look.glasses === 'none' ? '' : `${find('glasses', look.glasses)?.name.toLowerCase() ?? look.glasses} glasses`;
  const scarfName = `${(find('scarf', look.scarf)?.name ?? 'Custom').toLowerCase()} scarf`;
  const bits = [hatName, glassesName, scarfName].filter(Boolean).join(', ');
  const o = look.outfit !== 'custom' && look.outfit !== 'none' ? find('outfit', look.outfit)?.name : null;
  return o ? `${o}: ${bits}` : bits.charAt(0).toUpperCase() + bits.slice(1);
}

/** Ids of every item currently earned, to spot new ones. */
export function earnedIds(stats: Stats | null): string[] {
  return (Object.keys(WARDROBE) as Slot[]).flatMap((slot) => WARDROBE[slot].filter((i) => !('free' in i.rule) && stateOf(i, stats).open).map((i) => `${slot}:${i.id}`));
}
