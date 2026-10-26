import { emptyForm, formForGrams, formFromEntry, kcalPer100g, parseEntryForm, parseNumber, portionText, QUICK_ADD_NAME } from '../src/data/entryForm';
import type { DiaryEntry } from '../src/data/repo';
import type { SyncStatus } from '../src/data/sync';
import { describeSync } from '../src/data/syncText';

describe('parseNumber', () => {
  it.each([
    ['', null],
    ['  ', null],
    ['540', 540],
    ['12.5', 12.5],
    ['12,5', 12.5],
    ['.5', 0.5],
    ['7.', 7],
    ['1 200', 1200],
  ])('reads %j as %j', (text, value) => expect(parseNumber(text)).toBe(value));

  it.each(['-5', 'abc', '1.2.3', '1e3', '12kcal'])('rejects %j', (text) => expect(parseNumber(text)).toBeNaN());
});

describe('parseEntryForm', () => {
  const form = { ...emptyForm('lunch'), name: ' Bunny chow ', calories: '780', proteinG: '28,5', carbG: '', fatG: '31' };

  it('turns the typed form into an entry', () => {
    expect(parseEntryForm(form)).toEqual({
      ok: true,
      value: { name: 'Bunny chow', calories: 780, proteinG: 28.5, carbG: 0, fatG: 31, mealType: 'lunch', source: 'manual' },
    });
  });

  it('makes a quick add when the name is empty', () => {
    const r = parseEntryForm({ ...form, name: '' });
    expect(r.ok && r.value).toMatchObject({ name: QUICK_ADD_NAME, source: 'quick_add' });
  });

  it('stops values the server would reject', () => {
    const r = parseEntryForm({ ...form, name: 'x'.repeat(201), calories: '20001', fatG: '-3' });
    expect(r).toEqual({ ok: false, errors: { name: expect.any(String), calories: expect.any(String), fatG: expect.any(String) } });
    expect(parseEntryForm({ ...form, calories: '' })).toMatchObject({ ok: false, errors: { calories: 'Enter the calories.' } });
  });

  it('round-trips an entry for editing', () => {
    const entry = { name: 'Pap', calories: 300, proteinG: 0, carbG: 64, fatG: 1.5, mealType: 'dinner' } as DiaryEntry;
    expect(formFromEntry(entry)).toEqual({ name: 'Pap', calories: '300', proteinG: '', carbG: '64', fatG: '1.5', mealType: 'dinner' });
  });
});

describe('portions', () => {
  // The same chicken logged twice: 172 g and 197 g of a food with 165 kcal per 100 g.
  const lunch = { name: 'Grilled Chicken Breast', calories: 283, proteinG: 53.3, carbG: 0, fatG: 6.2, quantityG: 171.5, servings: null } as DiaryEntry;
  const dinner = { ...lunch, calories: 325, quantityG: 197 } as DiaryEntry;

  it('says how much was eaten, so two of the same food can be told apart', () => {
    expect(portionText(lunch)).toBe('172 g');
    expect(portionText(dinner)).toBe('197 g');
    expect(portionText({ quantityG: 45, servings: 1.5 })).toBe('1½ servings (45 g)');
    expect(portionText({ quantityG: 30, servings: 1 })).toBe('1 serving (30 g)');
    expect(portionText({ quantityG: null, servings: null })).toBeNull(); // typed in: only the calories are known
    expect([kcalPer100g(lunch), kcalPer100g(dinner)]).toEqual([165, 165]); // same food, different portion
  });

  it('scales every number with a new amount', () => {
    const form = formFromEntry(lunch);
    expect(formForGrams(form, lunch, 197)).toMatchObject({ calories: '325', proteinG: '61.2', fatG: '7.1' });
    expect(formForGrams(form, lunch, 0)).toBe(form);
  });
});

describe('describeSync', () => {
  const s = (patch: Partial<SyncStatus>): SyncStatus => ({ state: 'idle', pending: 0, lastSyncedAt: null, lastError: null, ...patch });

  it('says where the data stands', () => {
    expect(describeSync(s({ lastSyncedAt: 1 }))).toEqual({ text: 'Backed up.', tone: 'good' });
    expect(describeSync(s({})).text).toBe('Saved on this phone.');
    expect(describeSync(s({ pending: 1 })).text).toBe('1 change waiting to back up.');
    expect(describeSync(s({ state: 'offline', pending: 3 })).text).toMatch(/^Offline\. 3 changes saved on this phone/);
    expect(describeSync(s({ state: 'error', lastError: 'Server error' }))).toMatchObject({ tone: 'bad', text: expect.stringContaining('Server error') });
  });
});
