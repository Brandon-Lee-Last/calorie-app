import { dateAt, shiftDate } from './dates';
import type { Usual } from './history';

export type Remaining = { calories: number; proteinG: number; carbG: number; fatG: number };

/** Something that could be eaten next, with its numbers for one portion. */
export type Idea = {
  key: string;
  name: string;
  meta: string;
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  quantityG: number | null;
  /** Food colours for the little plate drawing. */
  colours: [string, string, string];
};

/** An idea sized to what is left: a full portion if it fits, else the biggest quarter step from half up. */
export type Fit = Idea & { portion: number; kcal: number; protein: number; carbs: number; fat: number; leaves: number };

const round1 = (n: number) => Math.round(n * 10) / 10;

export function fitIdea(idea: Idea, left: Remaining): Fit | null {
  if (left.calories <= 0 || idea.calories <= 0) return null;
  let portion = 1;
  if (idea.calories > left.calories) {
    portion = Math.floor((left.calories / idea.calories) * 4) / 4;
    if (portion < 0.5) return null;
  }
  const kcal = Math.round(idea.calories * portion);
  return { ...idea, portion, kcal, protein: round1(idea.proteinG * portion), carbs: round1(idea.carbG * portion), fat: round1(idea.fatG * portion), leaves: Math.round(left.calories - kcal) };
}

/**
 * Ideas that fit, best first. 'fit' prefers full portions that use most of what is left; 'protein' prefers the most
 * protein per kcal (for when protein is behind).
 */
export function suggest(ideas: Idea[], left: Remaining, order: 'fit' | 'protein', limit = 6): Fit[] {
  const fits = ideas.map((i) => fitIdea(i, left)).filter((f): f is Fit => f !== null);
  const score = (f: Fit) => (order === 'protein' ? f.protein / Math.max(1, f.kcal) : (f.portion === 1 ? 1 : 0.8) * (f.kcal / left.calories));
  return fits.sort((a, b) => score(b) - score(a)).slice(0, limit);
}

/** "¾ portion" for a scaled idea, "" for a whole one. */
export const portionNote = (p: number) => (p === 1 ? '' : `${{ 0.5: '½', 0.75: '¾' }[p] ?? p} portion`);

const TONES: [string, string, string][] = [
  ['#F8F4EA', '#C47E45', '#6E9C3E'],
  ['#E9DCC0', '#B9874F', '#D9472B'],
  ['#F6F2E8', '#7A3E22', '#D9472B'],
  ['#FFD45E', '#B9874F', '#7FAE4A'],
  ['#E2C063', '#B07A45', '#6E9C3E'],
];
const toneFor = (key: string) => TONES[[...key].reduce((s, c) => s + c.charCodeAt(0), 0) % TONES.length];

function lastText(lastDate: string, today: string): string {
  if (lastDate === today) return 'You had this today';
  if (lastDate === shiftDate(today, -1)) return 'You had this yesterday';
  if (lastDate >= shiftDate(today, -6)) return `You had this on ${dateAt(lastDate).toLocaleDateString('en-ZA', { weekday: 'long' })}`;
  return `Last had on ${dateAt(lastDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long' })}`;
}

/** The person's own meals as ideas. */
export function ideasFromHistory(meals: Usual[], today: string): Idea[] {
  return meals.map((m) => ({
    key: `mine:${m.key}`,
    name: m.name,
    meta: m.times > 2 ? `One of your usuals, logged ${m.times} times` : lastText(m.lastDate, today),
    calories: m.calories,
    proteinG: m.proteinG,
    carbG: m.carbG,
    fatG: m.fatG,
    quantityG: m.quantityG,
    colours: toneFor(m.key),
  }));
}

/**
 * Common South African meals with typical values for one plate. They are rough (recipes and portions vary a lot), so
 * the screen says so; logging one is a starting point to edit.
 */
export const LOCAL_IDEAS: Idea[] = [
  { key: 'local:bobotie', name: 'Bobotie with yellow rice, small plate', meta: 'A Cape classic', calories: 610, proteinG: 32, carbG: 60, fatG: 25, quantityG: 350, colours: ['#E2C063', '#B07A45', '#6E9C3E'] },
  { key: 'local:peri', name: 'Peri-peri chicken quarter with salad', meta: 'Skip the chips, keep the sauce', calories: 520, proteinG: 46, carbG: 8, fatG: 33, quantityG: 380, colours: ['#C2502A', '#E9A25E', '#6E9C3E'] },
  { key: 'local:pap', name: 'Pap, wors and chakalaka', meta: 'Braai favourite', calories: 690, proteinG: 30, carbG: 65, fatG: 34, quantityG: 420, colours: ['#F6F2E8', '#7A3E22', '#D9472B'] },
  { key: 'local:bunny', name: 'Quarter bean bunny chow', meta: 'Durban staple', calories: 720, proteinG: 22, carbG: 110, fatG: 20, quantityG: 450, colours: ['#E2B46A', '#B0532E', '#8A6A3A'] },
  { key: 'local:eggs', name: 'Two eggs on toast with avo', meta: 'Ready in 10 minutes', calories: 450, proteinG: 20, carbG: 30, fatG: 27, quantityG: 260, colours: ['#FFD45E', '#B9874F', '#7FAE4A'] },
  { key: 'local:yoghurt', name: 'Greek yoghurt, muesli and berries', meta: 'Ready in 5 minutes', calories: 380, proteinG: 24, carbG: 45, fatG: 10, quantityG: 300, colours: ['#FBF8F2', '#C99A62', '#8E3A5A'] },
  { key: 'local:sweetpotato', name: 'Grilled chicken, sweet potato and greens', meta: 'Most protein per kcal', calories: 530, proteinG: 52, carbG: 58, fatG: 10, quantityG: 450, colours: ['#D9A066', '#E07B39', '#4F7A2B'] },
  { key: 'local:mince', name: 'Beef mince with veg and cauli rice', meta: 'Low carb, high protein', calories: 500, proteinG: 45, carbG: 15, fatG: 28, quantityG: 400, colours: ['#7A4A2E', '#F2EEE4', '#D9472B'] },
  { key: 'local:biltong', name: 'Cottage cheese, crackers and biltong', meta: 'No cooking needed', calories: 410, proteinG: 46, carbG: 25, fatG: 13, quantityG: 220, colours: ['#FBF8F2', '#D9B98A', '#6A2E22'] },
  { key: 'local:tuna', name: 'Tuna mayo on brown bread, apple', meta: 'Packs for work', calories: 480, proteinG: 34, carbG: 55, fatG: 13, quantityG: 320, colours: ['#B9874F', '#E9DCC0', '#D9472B'] },
  { key: 'local:stirfry', name: 'Chicken stir-fry with rice', meta: 'Ready in 20 minutes', calories: 560, proteinG: 44, carbG: 62, fatG: 14, quantityG: 420, colours: ['#F8F4EA', '#C47E45', '#6E9C3E'] },
  { key: 'local:wrap', name: 'Chicken strip wrap with salad', meta: 'Ready in 15 minutes', calories: 520, proteinG: 38, carbG: 48, fatG: 18, quantityG: 300, colours: ['#E9D3A6', '#C47E45', '#6E9C3E'] },
];
