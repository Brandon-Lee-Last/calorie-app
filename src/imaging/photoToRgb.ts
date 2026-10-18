import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { INPUT_SIZE } from '../model/contract';
import { pngToRgb } from './pngToRgb';

/**
 * Photos from modern phones are 12-50 megapixels. The manipulator decodes down to fit inside this
 * box (so the full image never sits in memory), then the result is squashed to the model size.
 */
const MAX_DECODE_PX = 1024;

export type PreparedPhoto = {
  /** Raw RGB bytes, INPUT_SIZE x INPUT_SIZE x 3: exactly what the model takes. */
  rgb: Uint8Array;
  /** The 224 x 224 image the model will see, for showing to the user. */
  previewUri: string;
};

/**
 * Photo (camera or gallery URI) -> model input.
 *
 * The photo is squashed to INPUT_SIZE x INPUT_SIZE without cropping, as in training. Resizing is
 * done by the platform; training used PIL bilinear, so results can differ slightly (see the
 * "resize path" self-test in selfTest.ts).
 */
export async function photoToRgb(uri: string): Promise<PreparedPhoto> {
  const rendered = await ImageManipulator.manipulate(uri, { maxWidth: MAX_DECODE_PX, maxHeight: MAX_DECODE_PX })
    .resize({ width: INPUT_SIZE, height: INPUT_SIZE })
    .renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.PNG });
  const bytes = new Uint8Array(await new File(saved.uri).arrayBuffer());
  return { rgb: pngToRgb(bytes), previewUri: saved.uri };
}
