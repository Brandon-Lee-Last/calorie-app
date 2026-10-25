import type { Food } from '../src/data/foodMath';
import { describeFood, matchMeals, withoutShown, words } from '../src/data/foodSearch';
import type { Usual } from '../src/data/history';
import { OffSearch, OffSearchError, mapOffHits, offSearchUrl } from '../src/data/offSearch';

const usual = (name: string, foodId: string | null = null): Usual => ({ key: name.toLowerCase(), name, calories: 300, proteinG: 10, carbG: 30, fatG: 10, quantityG: null, foodId, mealType: 'lunch', times: 2, lastDate: '2026-10-20' });
const food = (id: string, over: Partial<Food> = {}) => ({ id, name: 'Food', brand: null, servingG: null, servingLabel: null, calories100g: 200, ...over }) as Food;

describe('matching your own meals', () => {
  it('ignores case and accents and matches the start of each word', () => {
    expect(words('Droëwors & Biltong!')).toEqual(['droewors', 'biltong']);
    const meals = [usual('Droëwors'), usual('Chicken mayo sandwich'), usual('Mayonnaise')];
    expect(matchMeals(meals, 'droe').map((m) => m.name)).toEqual(['Droëwors']);
    expect(matchMeals(meals, 'mayo chick').map((m) => m.name)).toEqual(['Chicken mayo sandwich']);
    expect(matchMeals(meals, 'ayo')).toEqual([]);
    expect(matchMeals(meals, '  ')).toEqual([]);
  });

  it('does not show a food twice when it is one of your meals too', () => {
    expect(withoutShown([food('a'), food('b')], [usual('A', 'a'), usual('Typed')]).map((f) => f.id)).toEqual(['b']);
  });
});

describe('result rows', () => {
  it('show the energy for one serving when the pack gives one, else for 100 g', () => {
    expect(describeFood({ brand: 'Ouma', servingG: 32, servingLabel: '1 rusk (32 g)', calories100g: 430 })).toEqual({ kcal: 138, per: '1 rusk (32 g)', detail: 'Ouma · 1 rusk (32 g)' });
    expect(describeFood({ brand: null, servingG: 50, servingLabel: null, calories100g: 100 })).toEqual({ kcal: 50, per: '50 g', detail: '50 g' });
    expect(describeFood({ brand: null, servingG: null, servingLabel: null, calories100g: 52 })).toEqual({ kcal: 52, per: '100 g', detail: '100 g' });
  });
});

const offJson = {
  products: [
    { code: '3017620422003', product_name: 'Nutella', brands: 'Ferrero, Other', countries_tags: ['en:france'], nutriments: { 'energy-kcal_100g': 539 }, serving_quantity: 15, serving_size: '15 g' },
    { code: '6001007200015', product_name: 'Buttermilk Rusks', brands: 'Ouma', countries_tags: ['en:south-africa'], nutriments: { energy_100g: '1799' } },
    { code: 'abc', product_name: 'No barcode', nutriments: { 'energy-kcal_100g': 100 } },
    { code: '5000112637922', product_name: 'No energy', nutriments: {} },
    { code: '5449000000996', product_name: 'Broken', nutriments: { 'energy-kcal_100g': 1800 } },
    { code: '3017620422003', product_name: 'Nutella again', nutriments: { 'energy-kcal_100g': 539 } },
  ],
};

describe('Open Food Facts search', () => {
  it('keeps products with a barcode, a name and an energy figure, South African ones first', () => {
    expect(mapOffHits(offJson)).toEqual([
      { barcode: '6001007200015', name: 'Buttermilk Rusks', brand: 'Ouma', calories100g: 430, servingG: null, servingLabel: null, local: true },
      { barcode: '3017620422003', name: 'Nutella', brand: 'Ferrero', calories100g: 539, servingG: 15, servingLabel: '15 g', local: false },
    ]);
    expect(mapOffHits({})).toEqual([]);
    expect(mapOffHits(null)).toEqual([]);
  });

  it('asks for just the fields it needs, names the app, and stays under 10 searches a minute', async () => {
    let t = 1_000_000;
    const fetcher = jest.fn(async () => new Response(JSON.stringify(offJson)));
    const off = new OffSearch(fetcher as unknown as typeof fetch, () => t);
    expect(await off.search(' rusks ')).toHaveLength(2);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(offSearchUrl('rusks'));
    expect(url).toContain('search_terms=rusks');
    expect(url).toContain('fields=code%2Cproduct_name');
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/^CalorieApp\//);
    for (let i = 0; i < 9; i++) await off.search('x');
    await expect(off.search('x')).rejects.toEqual(new OffSearchError('busy'));
    expect(fetcher).toHaveBeenCalledTimes(10);
    t += 61_000;
    await expect(off.search('x')).resolves.toHaveLength(2);
  });

  it('tells no connection, too many searches and a broken answer apart', async () => {
    const fail = (f: () => Promise<Response>) => new OffSearch(f as unknown as typeof fetch).search('x').catch((e: OffSearchError) => e.reason);
    expect(await fail(async () => Promise.reject(new TypeError('Network request failed')))).toBe('offline');
    expect(await fail(async () => new Response('', { status: 429 }))).toBe('busy');
    expect(await fail(async () => new Response('', { status: 503 }))).toBe('failed');
    expect(await fail(async () => new Response('<html>'))).toBe('failed');
  });
});
