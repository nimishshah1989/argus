// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { en } from '@uptimo/shared/i18n';
import { translationsTakeaway } from '../settings-company/model.js';
import { missingTranslations } from '../settings-company/translations-spec.js';

describe('S26-7 translations: edges', () => {
  it('a plant override fills a missing key; the total never moves', () => {
    const first = missingTranslations({})[0]!;
    const before = translationsTakeaway({});
    const after = translationsTakeaway({ [first.key]: 'ગુજરાતી' });
    expect(after).toEqual({ missing: before.missing - 1, total: Object.keys(en).length });
  });
});
