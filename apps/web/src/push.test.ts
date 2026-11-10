import { describe, expect, it } from 'vitest';
import { needsRebind, urlBase64ToUint8Array } from './push.js';

describe('needsRebind', () => {
  it('keeps the binding when the acting person is the same', () => {
    expect(needsRebind('person-1', 'person-1')).toBe(false);
  });

  it('re-binds when the shared phone switches acting person', () => {
    expect(needsRebind('person-1', 'person-2')).toBe(true);
  });

  it('re-binds when nothing was bound yet', () => {
    expect(needsRebind(null, 'person-1')).toBe(true);
  });
});

describe('urlBase64ToUint8Array', () => {
  it('decodes unpadded url-safe base64', () => {
    expect(Array.from(urlBase64ToUint8Array('aGVsbG8'))).toEqual([104, 101, 108, 108, 111]);
  });

  it('decodes the url-safe - and _ characters', () => {
    expect(Array.from(urlBase64ToUint8Array('-_8'))).toEqual([251, 255]);
  });
});
