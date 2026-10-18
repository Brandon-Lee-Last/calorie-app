import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

import { encode } from 'fast-png';

import { INPUT_BYTES } from '../src/model/contract';
import { pngToRgb } from '../src/imaging/pngToRgb';

const GOLDEN = join(__dirname, '../assets/golden/example_224.png');

describe('pngToRgb', () => {
  it('decodes the golden photo to exactly the pixels Python/PIL reads from it', () => {
    const rgb = pngToRgb(new Uint8Array(readFileSync(GOLDEN)));
    expect(rgb).toHaveLength(INPUT_BYTES);
    // Reference values computed with PIL: np.asarray(Image.open(png).convert('RGB')).tobytes()
    expect(createHash('sha256').update(rgb).digest('hex')).toBe(
      '1a0edba56c594ccbcbdc4dfb494374282dee5d03ae1c4f7493e058883bc7119f',
    );
    expect(Array.from(rgb.slice(0, 3))).toEqual([118, 115, 106]); // pixel (0, 0)
    const at = (y: number, x: number) => Array.from(rgb.slice((y * 224 + x) * 3, (y * 224 + x) * 3 + 3));
    expect(at(100, 50)).toEqual([161, 161, 161]);
  });

  it('drops the alpha channel of an RGBA PNG and keeps channel order', () => {
    const size = 4;
    const data = new Uint8Array(size * size * 4);
    for (let p = 0; p < size * size; p++) data.set([10 + p, 20 + p, 30 + p, 255 - p], p * 4);
    const rgb = pngToRgb(encode({ width: size, height: size, data, channels: 4, depth: 8 }), size);
    expect(rgb).toHaveLength(size * size * 3);
    expect(Array.from(rgb.slice(0, 3))).toEqual([10, 20, 30]);
    expect(Array.from(rgb.slice(3 * 5, 3 * 5 + 3))).toEqual([15, 25, 35]); // pixel 5
  });

  it('expands greyscale to RGB', () => {
    const data = Uint8Array.from([0, 64, 128, 255]);
    const rgb = pngToRgb(encode({ width: 2, height: 2, data, channels: 1, depth: 8 }), 2);
    expect(Array.from(rgb)).toEqual([0, 0, 0, 64, 64, 64, 128, 128, 128, 255, 255, 255]);
  });

  it('rejects the wrong size, 16-bit images and indexed images instead of guessing', () => {
    const rgba = (n: number) => new Uint8Array(n * n * 4);
    expect(() => pngToRgb(encode({ width: 8, height: 8, data: rgba(8), channels: 4, depth: 8 }), 4)).toThrow(/8x8/);
    const deep = new Uint16Array(2 * 2 * 3);
    expect(() => pngToRgb(encode({ width: 2, height: 2, data: deep, channels: 3, depth: 16 }), 2)).toThrow(/bit depth/);
    const indexed = encode({
      width: 2, height: 2, data: new Uint8Array(4), channels: 1, depth: 8,
      palette: [[255, 0, 0], [0, 255, 0]],
    });
    expect(() => pngToRgb(indexed, 2)).toThrow(/palette/);
  });
});
