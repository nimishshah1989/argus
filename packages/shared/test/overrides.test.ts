import { describe, expect, it } from 'vitest';
import { overlaidGu, untranslatedKeys } from '../src/i18n/index.js';

const EN = { 'a.b': 'Save', 'a.c': 'Cancel', 'a.d': 'Delete' };
const GU = { 'a.b': 'સાચવો', 'a.c': '', 'a.d': '' };

describe('the plant’s Gujarati laid over the catalogue', () => {
  it('keeps the catalogue where the plant entered nothing and wins where it did', () => {
    expect(overlaidGu(GU, { 'a.c': 'રદ કરો' })).toEqual({
      'a.b': 'સાચવો',
      'a.c': 'રદ કરો',
      'a.d': '',
    });
  });

  it('treats a blank override as no override and ignores a key the catalogue does not have', () => {
    expect(overlaidGu(GU, { 'a.b': '   ', nope: 'કંઈ નહીં' })).toEqual(GU);
  });

  it('lists the keys still showing English, sorted, with no override and no catalogue Gujarati', () => {
    expect(untranslatedKeys(EN, GU, {})).toEqual(['a.c', 'a.d']);
    expect(untranslatedKeys(EN, GU, { 'a.c': 'રદ કરો' })).toEqual(['a.d']);
    expect(untranslatedKeys(EN, GU, { 'a.c': 'રદ કરો', 'a.d': 'કાઢી નાખો' })).toEqual([]);
  });
});
