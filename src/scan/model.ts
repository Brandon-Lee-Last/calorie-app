import { photoToRgb } from '../imaging/photoToRgb';
import type { Nutrition } from '../model/contract';
import { estimate, loadNutritionModel, type LoadedModel } from '../model/nutritionModel';

let loading: Promise<LoadedModel> | null = null;

/** The model, loaded once on the CPU (the GPU delegate is only tried in the Model lab). */
export function getModel(): Promise<LoadedModel> {
  if (!loading) {
    loading = loadNutritionModel('cpu');
    loading.catch(() => {
      loading = null; // let a later scan try again
    });
  }
  return loading;
}

export type Analysis = { nutrition: Nutrition; food: number | null; inferenceMs: number };

/** Photo -> the model's estimate, all on the phone. */
export async function analysePhoto(uri: string): Promise<Analysis> {
  const [model, photo] = await Promise.all([getModel(), photoToRgb(uri)]);
  if (model.problems.length) throw new Error(`The model file does not match what the app expects: ${model.problems.join('; ')}`);
  const out = await estimate(model.model, photo.rgb);
  return { nutrition: out.nutrition, food: out.food, inferenceMs: out.inferenceMs };
}
