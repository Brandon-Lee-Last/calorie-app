import {
  NUTRITION_KEYS,
  TYPICAL_ERROR,
  checkTensors,
  exactBuffer,
  maxAbsDiff,
  roundForDisplay,
  toNutrition,
  typicalRange,
} from '../src/model/contract';

const goodInputs = [{ name: 'in', dataType: 'uint8', shape: [1, 224, 224, 3] }];
const goodOutputs = [{ name: 'out', dataType: 'float32', shape: [1, 5] }];

describe('toNutrition', () => {
  it('maps the five outputs in the documented order', () => {
    expect(NUTRITION_KEYS).toEqual(['calories', 'mass', 'fat', 'carb', 'protein']);
    expect(toNutrition(Float32Array.from([350, 234, 11, 9, 50]))).toEqual({
      calories: 350, mass: 234, fat: 11, carb: 9, protein: 50,
    });
  });
  it('rejects the wrong length and non-finite values', () => {
    expect(() => toNutrition([1, 2, 3])).toThrow(/5 output values/);
    expect(() => toNutrition([1, 2, 3, 4, NaN])).toThrow(/protein/);
  });
});

describe('checkTensors', () => {
  it('accepts the contract', () => expect(checkTensors(goodInputs, goodOutputs)).toEqual([]));
  it('reports a wrong dtype, shape or tensor count', () => {
    expect(checkTensors([{ name: 'in', dataType: 'float32', shape: [1, 224, 224, 3] }], goodOutputs)[0]).toMatch(/uint8/);
    expect(checkTensors([{ name: 'in', dataType: 'uint8', shape: [1, 3, 224, 224] }], goodOutputs)[0]).toMatch(/shape/);
    expect(checkTensors(goodInputs, [{ name: 'o', dataType: 'float32', shape: [1, 4] }])[0]).toMatch(/\[1,5\]/);
    expect(checkTensors([], goodOutputs)[0]).toMatch(/1 input/);
  });
});

describe('display helpers', () => {
  it('rounds coarser than the model error and never below zero', () => {
    expect(roundForDisplay('calories', 349.3)).toBe(350);
    expect(roundForDisplay('mass', 234.2)).toBe(235);
    expect(roundForDisplay('fat', 10.79)).toBe(11);
    expect(roundForDisplay('carb', -0.4)).toBe(0);
  });
  it('builds the typical range and clamps its low end at zero', () => {
    expect(typicalRange('calories', 350)).toEqual({ low: 350 - TYPICAL_ERROR.calories, high: 350 + TYPICAL_ERROR.calories });
    expect(typicalRange('fat', 2).low).toBe(0);
  });
  it('finds the largest difference between two estimates', () => {
    const a = { calories: 350, mass: 234, fat: 11, carb: 9, protein: 50 };
    expect(maxAbsDiff(a, { ...a, protein: 47.5 })).toBe(2.5);
    expect(maxAbsDiff(a, a)).toBe(0);
  });
});

describe('exactBuffer', () => {
  it('returns the whole buffer when the view covers it', () => {
    const view = new Uint8Array([1, 2, 3]);
    expect(exactBuffer(view)).toBe(view.buffer);
  });
  it('copies only the viewed bytes for a subarray', () => {
    const big = new Uint8Array([9, 9, 1, 2, 3, 9]);
    const buffer = exactBuffer(big.subarray(2, 5));
    expect(buffer.byteLength).toBe(3);
    expect(Array.from(new Uint8Array(buffer))).toEqual([1, 2, 3]);
  });
});
