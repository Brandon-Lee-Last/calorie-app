import { loadTensorflowModel, type TfliteModel } from 'react-native-fast-tflite';

import { INPUT_BYTES, type Nutrition, checkTensors, exactBuffer, toNutrition } from './contract';

// The model is a bundled asset; metro.config.js registers the .tflite extension.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const MODEL_ASSET: number = require('../../assets/nutrition_v0.tflite');

/** 'cpu' is the default and the safe choice; the GPU delegate is worth measuring, not assuming. */
export type Delegate = 'cpu' | 'android-gpu';

export type LoadedModel = {
  model: TfliteModel;
  delegate: Delegate;
  loadMs: number;
  /** Differences between the file's tensors and the contract; empty when it matches. */
  problems: string[];
};

export async function loadNutritionModel(delegate: Delegate): Promise<LoadedModel> {
  const start = Date.now();
  // In fast-tflite v3 the delegates argument is an array; an empty array means plain CPU.
  const model = await loadTensorflowModel(MODEL_ASSET, delegate === 'cpu' ? [] : [delegate]);
  return {
    model,
    delegate,
    loadMs: Date.now() - start,
    problems: checkTensors(model.inputs, model.outputs),
  };
}

export type Estimate = { nutrition: Nutrition; inferenceMs: number };

/** Run the model on raw RGB bytes (INPUT_SIZE x INPUT_SIZE x 3). */
export async function estimate(model: TfliteModel, rgb: Uint8Array): Promise<Estimate> {
  if (rgb.length !== INPUT_BYTES) {
    throw new Error(`Model input must be ${INPUT_BYTES} bytes, got ${rgb.length}`);
  }
  const start = Date.now();
  const outputs = await model.run([exactBuffer(rgb)]);
  const inferenceMs = Date.now() - start;
  const first = outputs[0];
  if (!first) throw new Error('Model returned no output tensor');
  return { nutrition: toNutrition(new Float32Array(first)), inferenceMs };
}
