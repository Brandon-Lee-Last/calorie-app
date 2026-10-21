import { INPUT_SIZE } from './contract';

/**
 * The synthetic 224 x 224 image described under `gradient` in assets/golden/example_expected.json:
 * R = x*255//223, G = y*255//223, B = (x+y)*255//446 (x = column, y = row). It is not food, so it checks
 * that the food output can say "no" on the device. RGB bytes, row by row.
 */
export function gradientRgb(): Uint8Array {
  const n = INPUT_SIZE;
  const rgb = new Uint8Array(n * n * 3);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 3;
      rgb[i] = Math.floor((x * 255) / 223);
      rgb[i + 1] = Math.floor((y * 255) / 223);
      rgb[i + 2] = Math.floor(((x + y) * 255) / 446);
    }
  }
  return rgb;
}
