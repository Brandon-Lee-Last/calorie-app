import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

import { GOLDEN_224_PNG_BASE64, GOLDEN_256_JPG_BASE64 } from '../src/golden/goldenData';
import { gradientRgb } from '../src/model/syntheticImage';
import { base64ToBytes } from '../src/util/base64';

const sha = (b: Uint8Array | Buffer) => createHash('sha256').update(b).digest('hex');
const asset = (name: string) => readFileSync(join(__dirname, '../assets/golden', name));

describe('embedded golden data', () => {
  it('is exactly the files in assets/golden (regenerate with scripts/embed-golden.mjs if this fails)', () => {
    expect(sha(base64ToBytes(GOLDEN_224_PNG_BASE64))).toBe(sha(asset('example_224.png')));
    expect(sha(base64ToBytes(GOLDEN_256_JPG_BASE64))).toBe(sha(asset('example_256.jpg')));
  });
  it('the expected values file has the five outputs, the food probability and the gradient check', () => {
    const json = JSON.parse(asset('example_expected.json').toString());
    expect(Object.keys(json.expected)).toEqual(['calories', 'mass', 'fat', 'carb', 'protein']);
    expect(json.expected_food).toBeGreaterThan(0.5);
    expect(json.gradient.expected_food).toBeLessThan(0.5);
  });
});

describe('gradientRgb', () => {
  it('is the same image Python built when it recorded the expected value (numpy sha256)', () => {
    const rgb = gradientRgb();
    expect(rgb.length).toBe(224 * 224 * 3);
    expect(sha(rgb)).toBe('cc2bc00f2b3dfd2cbe06d81d60d3fea1d63e5bb35aceecafd479c76c2d77e189');
  });
});

describe('base64ToBytes', () => {
  it.each([[''], ['f'], ['fo'], ['foo'], ['foob'], ['fooba'], ['foobar'], ['ÿ\u0000\u0080 bytes']])(
    'matches Node for %j',
    (text) => {
      const buf = Buffer.from(text, 'latin1');
      expect(Array.from(base64ToBytes(buf.toString('base64')))).toEqual(Array.from(buf));
    },
  );
  it('ignores whitespace and accepts missing padding', () => {
    expect(Array.from(base64ToBytes('Zm9v\nYmE'))).toEqual(Array.from(Buffer.from('fooba')));
  });
  it('rejects characters that are not base64', () => {
    expect(() => base64ToBytes('Zm9v!mFy')).toThrow(/Invalid base64/);
    expect(() => base64ToBytes('A')).toThrow(/length/);
  });
});
