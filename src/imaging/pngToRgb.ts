import { decode } from 'fast-png';

import { INPUT_SIZE } from '../model/contract';

/**
 * Decode a PNG into raw interleaved RGB bytes (R,G,B,R,G,B,...), the model's input layout.
 *
 * PNG is lossless, so these are exactly the pixels the image holds. Alpha is dropped (photos are
 * opaque); greyscale is expanded to RGB. Anything that is not a plain 8-bit image of the expected
 * size is rejected rather than silently producing wrong input.
 */
export function pngToRgb(png: Uint8Array | ArrayBuffer, size: number = INPUT_SIZE): Uint8Array {
  const image = decode(png);
  if (image.depth !== 8) throw new Error(`Unsupported PNG bit depth ${image.depth}; expected 8`);
  if (image.palette) throw new Error('Unsupported indexed (palette) PNG');
  if (image.width !== size || image.height !== size) {
    throw new Error(`PNG is ${image.width}x${image.height}; expected ${size}x${size}`);
  }

  const { channels, data } = image;
  const pixels = size * size;
  const rgb = new Uint8Array(pixels * 3);
  for (let p = 0; p < pixels; p++) {
    const s = p * channels;
    if (channels >= 3) {
      rgb[p * 3] = data[s] as number;
      rgb[p * 3 + 1] = data[s + 1] as number;
      rgb[p * 3 + 2] = data[s + 2] as number;
    } else {
      const grey = data[s] as number; // 1 channel: grey, 2 channels: grey + alpha
      rgb[p * 3] = grey;
      rgb[p * 3 + 1] = grey;
      rgb[p * 3 + 2] = grey;
    }
  }
  return rgb;
}
