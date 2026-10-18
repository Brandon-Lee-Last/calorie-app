import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import type { TfliteModel } from 'react-native-fast-tflite';

import { photoToRgb } from './imaging/photoToRgb';
import { pngToRgb } from './imaging/pngToRgb';
import { type Nutrition, maxAbsDiff } from './model/contract';
import { estimate } from './model/nutritionModel';

/* eslint-disable @typescript-eslint/no-require-imports */
const GOLDEN_224: number = require('../assets/golden/example_224.png');
const GOLDEN_256: number = require('../assets/golden/example_256.jpg');
const GOLDEN_EXPECTED: { expected: Nutrition } = require('../assets/golden/example_expected.json');
/* eslint-enable @typescript-eslint/no-require-imports */

/** The 224 px golden photo must reproduce the model's own output almost exactly. */
const EXACT_TOLERANCE = 0.5;
/** Resize differences are expected to be small next to the model's ~74 kcal typical error. */
const RESIZE_TOLERANCE_KCAL = 20;

export type CheckResult = { name: string; ok: boolean; detail: string };

async function localUri(assetModule: number): Promise<string> {
  const [asset] = await Asset.loadAsync(assetModule);
  if (!asset?.localUri) throw new Error('asset has no local file');
  return asset.localUri;
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
    const bytes = new Uint8Array(await new File(await localUri(GOLDEN_224)).arrayBuffer());
    const { nutrition } = await estimate(model, pngToRgb(bytes));
    const diff = maxAbsDiff(nutrition, GOLDEN_EXPECTED.expected);
    return {
      ok: diff <= EXACT_TOLERANCE,
      detail: `largest difference from expected: ${diff.toFixed(3)} (must be <= ${EXACT_TOLERANCE})`,
    };
  });

  const resize = await guard('Golden photo (256 px, app resizes it)', async () => {
    const { rgb } = await photoToRgb(await localUri(GOLDEN_256));
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
