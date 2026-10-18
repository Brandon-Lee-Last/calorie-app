import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

import { GOLDEN_224_PNG_BASE64, GOLDEN_256_JPG_BASE64 } from '../src/golden/goldenData';
import { base64ToBytes } from '../src/util/base64';

const sha = (b: Uint8Array | Buffer) => createHash('sha256').update(b).digest('hex');
const asset = (name: string) => readFileSync(join(__dirname, '../assets/golden', name));

describe('embedded golden data', () => {
  it('is exactly the files in assets/golden (regenerate with scripts/embed-golden.mjs if this fails)', () => {
    expect(sha(base64ToBytes(GOLDEN_224_PNG_BASE64))).toBe(sha(asset('example_224.png')));
    expect(sha(base64ToBytes(GOLDEN_256_JPG_BASE64))).toBe(sha(asset('example_256.jpg')));
  });
  it('the expected values file has the five outputs', () => {
    const expected = JSON.parse(asset('example_expected.json').toString()).expected;
    expect(Object.keys(expected)).toEqual(['calories', 'mass', 'fat', 'carb', 'protein']);
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
