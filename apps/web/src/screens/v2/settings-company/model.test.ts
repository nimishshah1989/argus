// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { en } from '@uptimo/shared/i18n';
import { translationsTakeaway } from './model.js';
import { missingTranslations } from './translations-spec.js';

describe('S26-7 translations model', () => {
  it('counts the keys with no Gujarati against every English key', () => {
    expect(translationsTakeaway({})).toEqual({
      missing: missingTranslations({}).length,
      total: Object.keys(en).length,
    });
  });
});
