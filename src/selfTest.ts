import { File, Paths } from 'expo-file-system';
import type { TfliteModel } from 'react-native-fast-tflite';

import { GOLDEN_224_PNG_BASE64, GOLDEN_256_JPG_BASE64 } from './golden/goldenData';
import { photoToRgb } from './imaging/photoToRgb';
import { pngToRgb } from './imaging/pngToRgb';
import { FOOD_THRESHOLD, type Nutrition, looksLikeFood, maxAbsDiff } from './model/contract';
import { estimate } from './model/nutritionModel';
import { base64ToBytes } from './util/base64';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const GOLDEN_EXPECTED: { expected: Nutrition } = require('../assets/golden/example_expected.json');

/** The 224 px golden photo must reproduce the model's own output almost exactly. */
const EXACT_TOLERANCE = 0.5;
/** Resize differences are expected to be small next to the model's ~74 kcal typical error. */
const RESIZE_TOLERANCE_KCAL = 20;

export type CheckResult = { name: string; ok: boolean; detail: string };

/** The golden JPEG written to the cache as a real file, which is what the photo pipeline takes. */
function goldenJpegUri(): string {
  const file = new File(Paths.cache, 'golden_example_256.jpg');
  file.create({ overwrite: true });
  file.write(base64ToBytes(GOLDEN_256_JPG_BASE64));
  return file.uri;
}

async function guard(name: string, run: () => Promise<Omit<CheckResult, 'name'>>): Promise<CheckResult> {
  try {
    return { name, ...(await run()) };
  } catch (e) {
    return { name, ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Checks that run on the device against the golden example shipped in assets/golden/.
 * They verify the plumbing (model loading, tensor layout, output order, PNG decoding, resizing),
 * not that the model is accurate.
 */
export async function runSelfTests(model: TfliteModel, tensorProblems: string[]): Promise<CheckResult[]> {
  const tensors: CheckResult = {
    name: 'Model tensors',
    ok: tensorProblems.length === 0,
    detail: tensorProblems.length === 0 ? 'uint8 [1,224,224,3] in, float32 [1,5] out' : tensorProblems.join('; '),
  };

  const exact = await guard('Golden photo (224 px, exact pixels)', async () => {
    const { nutrition, food } = await estimate(model, pngToRgb(base64ToBytes(GOLDEN_224_PNG_BASE64)));
    const diff = maxAbsDiff(nutrition, GOLDEN_EXPECTED.expected);
    // The golden photo is food, so a model with the food output must accept it.
    const foodOk = looksLikeFood(food);
    return {
      ok: diff <= EXACT_TOLERANCE && foodOk,
      detail:
        `largest difference from expected: ${diff.toFixed(3)} (must be <= ${EXACT_TOLERANCE})` +
        (food === null ? '' : `; food probability ${food.toFixed(2)} (must be >= ${FOOD_THRESHOLD})`),
    };
  });

  const resize = await guard('Golden photo (256 px, app resizes it)', async () => {
    const { rgb } = await photoToRgb(goldenJpegUri());
    const { nutrition } = await estimate(model, rgb);
    const dCal = nutrition.calories - GOLDEN_EXPECTED.expected.calories;
    return {
      ok: Math.abs(dCal) <= RESIZE_TOLERANCE_KCAL,
      detail:
        `calories ${dCal >= 0 ? '+' : ''}${dCal.toFixed(1)} kcal vs expected, ` +
        `largest difference ${maxAbsDiff(nutrition, GOLDEN_EXPECTED.expected).toFixed(1)} ` +
        `(resize check; ${RESIZE_TOLERANCE_KCAL} kcal is a rule of thumb, not a spec)`,
    };
  });

  return [tensors, exact, resize];
}
