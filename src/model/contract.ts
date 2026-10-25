/**
 * The nutrition model's input/output contract and the small pure helpers around it.
 * Source of truth: assets/MODEL_CARD.md (copied from the ML repo's models/MODEL_CARD.md).
 *
 * Input:  one uint8 tensor [1, 224, 224, 3], RGB, NHWC, raw 0-255 pixels. The photo is
 *         squashed to 224 x 224 (no crop, aspect ratio not preserved). Scaling and
 *         normalisation are inside the model, so none happens here.
 * Output: one float32 tensor in the order of NUTRITION_KEYS, [1, 5]; or [1, 6] when the model has the
 *         food output, whose last value is the probability (0-1) that the photo shows food.
 */

/** The bundled model (assets/nutrition_v1.tflite). Sent with scan records so accuracy is tracked per model. */
export const MODEL_VERSION = 'nutrition_v1';

export const INPUT_SIZE = 224;
export const INPUT_BYTES = INPUT_SIZE * INPUT_SIZE * 3;

export const NUTRITION_KEYS = ['calories', 'mass', 'fat', 'carb', 'protein'] as const;
const OUTPUT_COUNTS = [NUTRITION_KEYS.length, NUTRITION_KEYS.length + 1]; // without / with the food output
export type NutritionKey = (typeof NUTRITION_KEYS)[number];
export type Nutrition = Record<NutritionKey, number>;

export const LABELS: Record<NutritionKey, string> = {
  calories: 'Calories',
  mass: 'Weight',
  fat: 'Fat',
  carb: 'Carbs',
  protein: 'Protein',
};

export const UNITS: Record<NutritionKey, string> = {
  calories: 'kcal',
  mass: 'g',
  fat: 'g',
  carb: 'g',
  protein: 'g',
};

/**
 * Mean absolute error per dish on the official Nutrition5k test split for nutrition_v1
 * (MODEL_CARD.md, "all test images"). This is an average error on cafeteria photos, not a
 * guarantee and not a confidence interval; phone photos and South African food are untested.
 */
export const TYPICAL_ERROR: Nutrition = {
  calories: 77.5,
  mass: 46.0,
  fat: 6.1,
  carb: 7.3,
  protein: 5.4,
};

/**
 * A photo whose food probability is below this is treated as "not food": the app shows that instead of
 * calories. Picked from the held-out food / not-food results in the model card (0.2 to 0.8 moves food
 * accepted 92.7% -> 89.7% and non-food rejected 95.8% -> 97.1%, so 0.5 stays): raising it rejects more
 * non-food but also turns away more real food.
 */
export const FOOD_THRESHOLD = 0.5;

/** Display rounding, coarser than the model's error so we do not imply false precision. */
const ROUND_TO: Nutrition = { calories: 10, mass: 5, fat: 1, carb: 1, protein: 1 };

export type TensorInfo = { name: string; dataType: string; shape: number[] };

export type ModelOutput = {
  nutrition: Nutrition;
  /** Probability the photo shows food, or null for a model without the food output. */
  food: number | null;
};

/** Split the model's output tensor into the five nutrition values and the optional food probability. */
export function parseOutput(values: ArrayLike<number>): ModelOutput {
  if (!OUTPUT_COUNTS.includes(values.length)) {
    throw new Error(`Expected ${OUTPUT_COUNTS.join(' or ')} output values, got ${values.length}`);
  }
  const nutrition = {} as Nutrition;
  NUTRITION_KEYS.forEach((key, i) => {
    const v = values[i] as number;
    if (!Number.isFinite(v)) throw new Error(`Model returned a non-finite ${key}: ${v}`);
    nutrition[key] = v;
  });
  if (values.length === NUTRITION_KEYS.length) return { nutrition, food: null };
  const food = values[NUTRITION_KEYS.length] as number;
  if (!Number.isFinite(food) || food < 0 || food > 1) throw new Error(`Food probability out of range: ${food}`);
  return { nutrition, food };
}

export const toNutrition = (values: ArrayLike<number>): Nutrition => parseOutput(values).nutrition;

/** True unless the model is confident the photo is not food. A model without the food output cannot tell. */
export function looksLikeFood(food: number | null): boolean {
  return food === null || food >= FOOD_THRESHOLD;
}

const sameShape = (a: number[], b: number[]) => a.length === b.length && a.every((n, i) => n === b[i]);

/** Problems with the loaded model's tensors versus the contract; empty when it matches. */
export function checkTensors(inputs: TensorInfo[], outputs: TensorInfo[]): string[] {
  const problems: string[] = [];
  if (inputs.length !== 1) problems.push(`expected 1 input tensor, found ${inputs.length}`);
  if (outputs.length !== 1) problems.push(`expected 1 output tensor, found ${outputs.length}`);
  const input = inputs[0];
  if (input) {
    if (input.dataType !== 'uint8') problems.push(`input should be uint8, is ${input.dataType}`);
    if (!sameShape(input.shape, [1, INPUT_SIZE, INPUT_SIZE, 3])) {
      problems.push(`input shape should be [1,${INPUT_SIZE},${INPUT_SIZE},3], is [${input.shape}]`);
    }
  }
  const output = outputs[0];
  if (output) {
    if (output.dataType !== 'float32') problems.push(`output should be float32, is ${output.dataType}`);
    if (!OUTPUT_COUNTS.some((n) => sameShape(output.shape, [1, n]))) {
      problems.push(`output shape should be [1,${OUTPUT_COUNTS.join('] or [1,')}], is [${output.shape}]`);
    }
  }
  return problems;
}

/** Largest absolute difference across the five outputs (kcal or g). */
export function maxAbsDiff(a: Nutrition, b: Nutrition): number {
  return Math.max(...NUTRITION_KEYS.map((k) => Math.abs(a[k] - b[k])));
}

/** "350" for 349.3 kcal; rounded to a step that is coarser than the model's typical error. */
export function roundForDisplay(key: NutritionKey, value: number): number {
  const step = ROUND_TO[key];
  return Math.max(0, Math.round(value / step) * step);
}

/** The value plus/minus the typical error, never below zero. */
export function typicalRange(key: NutritionKey, value: number): { low: number; high: number } {
  const e = TYPICAL_ERROR[key];
  return { low: Math.max(0, value - e), high: value + e };
}

/**
 * A Uint8Array's backing ArrayBuffer sized exactly to the view. `view.buffer` alone can be larger
 * than the view (e.g. after `subarray`), which would silently feed the model extra bytes.
 */
export function exactBuffer(view: Uint8Array): ArrayBuffer {
  if (view.byteOffset === 0 && view.byteLength === view.buffer.byteLength) return view.buffer as ArrayBuffer;
  return view.slice().buffer as ArrayBuffer;
}
