import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ErasureKeyMissing,
  erasureHash,
  erasureNameHash,
  normaliseName,
  normalisePhone,
} from '../src/modules/identity/index.js';

/** Built at runtime so no test file carries a key-shaped literal. */
const key = (tag: string): string => ['erasure', 'test', tag].join('-').padEnd(40, 'x');
const saved = process.env.ERASURE_HASH_KEY;
const T = '10000000-0000-0000-0000-000000000001';
const OTHER_PLANT = '20000000-0000-0000-0000-000000000001';

beforeEach(() => {
  process.env.ERASURE_HASH_KEY = key('one');
});
afterEach(() => {
  if (saved === undefined) delete process.env.ERASURE_HASH_KEY;
  else process.env.ERASURE_HASH_KEY = saved;
});

describe('who counts as the same person', () => {
  it('ignores case, surrounding and inner spaces, and the way a phone number is written', () => {
    const base = erasureHash(T, 'Asha Patel', '+919000000001');
    expect(erasureHash(T, '  asha   PATEL ', '+91 90000-00001')).toBe(base);
    expect(erasureHash(T, 'ASHA\tPatel', '91 9000000001')).toBe(base);
  });

  it('treats compatibility spellings of one name as the same (NFKC), in Gujarati script too', () => {
    expect(erasureHash(T, 'Ｒａｊｅｓｈ Ｓｈａｈ', null)).toBe(erasureHash(T, 'Rajesh Shah', null));
    expect(erasureHash(T, 'આશા  પટેલ', '')).toBe(erasureHash(T, 'આશા પટેલ', null));
  });

  it('tells apart a different name or a different number', () => {
    const base = erasureHash(T, 'Asha Patel', '+919000000001');
    expect(erasureHash(T, 'Asha Patil', '+919000000001')).not.toBe(base);
    expect(erasureHash(T, 'Asha Patel', '+919000000002')).not.toBe(base);
    expect(erasureHash(T, 'Asha Patel', null)).not.toBe(base);
    expect(erasureHash(T, 'Asha', '9000000001')).not.toBe(erasureHash(T, 'Asha 9000000001', null));
  });

  it('exposes how a name and a phone are normalised', () => {
    expect(normaliseName('  Ｍira   X ')).toBe('mira x');
    expect(normalisePhone(' +91 (900) 000-0001 ')).toBe('919000000001');
    expect(normalisePhone(null)).toBe('');
  });
});

describe('the keyed hash', () => {
  it('is a 64-character hex digest that is the same twice and changes with the key', () => {
    const a = erasureHash(T, 'Asha Patel', null);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(erasureHash(T, 'Asha Patel', null)).toBe(a);
    process.env.ERASURE_HASH_KEY = key('two');
    expect(erasureHash(T, 'Asha Patel', null)).not.toBe(a);
  });

  it('is not the plain SHA-256 of the name, so a name list cannot be checked against it', async () => {
    const { createHash } = await import('node:crypto');
    const plain = createHash('sha256').update('asha patel\0').digest('hex');
    expect(erasureHash(T, 'Asha Patel', null)).not.toBe(plain);
  });

  it('refuses to run without a key, or with a short one, and never falls back to a default', () => {
    delete process.env.ERASURE_HASH_KEY;
    expect(() => erasureHash(T, 'Asha Patel', null)).toThrow(ErasureKeyMissing);
    process.env.ERASURE_HASH_KEY = 'short';
    expect(() => erasureHash(T, 'Asha Patel', null)).toThrow(ErasureKeyMissing);
  });
});

describe('the name-only hash an import is checked with', () => {
  it('matches the same name however it is typed, and ignores any number', () => {
    const base = erasureNameHash(T, 'Asha Patel');
    expect(erasureNameHash(T, '  ASHA   patel ')).toBe(base);
    expect(erasureNameHash(T, 'Ａｓｈａ Ｐａｔｅｌ')).toBe(base);
    expect(erasureNameHash(T, 'આશા  પટેલ')).toBe(erasureNameHash(T, 'આશા પટેલ'));
    expect(erasureNameHash(T, 'Asha Patil')).not.toBe(base);
  });

  it('can never equal the name-and-number hash, even for a person with no number', () => {
    expect(erasureNameHash(T, 'Asha Patel')).not.toBe(erasureHash(T, 'Asha Patel', null));
    expect(erasureNameHash(T, 'Asha Patel')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('needs the key like the other one', () => {
    delete process.env.ERASURE_HASH_KEY;
    expect(() => erasureNameHash(T, 'Asha Patel')).toThrow(ErasureKeyMissing);
  });

  it('the same name and number erased in two plants leave different values', () => {
    expect(erasureHash(T, 'Asha Patel', '+919000000001')).not.toBe(
      erasureHash(OTHER_PLANT, 'Asha Patel', '+919000000001'),
    );
    expect(erasureNameHash(T, 'Asha Patel')).not.toBe(erasureNameHash(OTHER_PLANT, 'Asha Patel'));
  });
});
