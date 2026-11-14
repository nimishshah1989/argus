import type { z } from 'zod';
import {
  aiMonthlyCapUsdSchema,
  companyLanguageSchema,
  companyNameSchema,
  companyTimeZoneSchema,
  featuresSchema,
  severityMatrixSchema,
} from '@uptimo/shared';
import { canSettingsAi, canSettingsLists, canSettingsSla, type ActorContext } from '@uptimo/domain';

interface WritableSetting {
  schema: z.ZodTypeAny;
  /** The permissions-matrix row that says who may change it (DOMAIN §3). */
  allow: (actor: ActorContext) => boolean;
  /** Set for a company profile key: the value lives on the plant's own record, not in `setting`. */
  profile?: 'name' | 'language' | 'timeZone';
}

/**
 * The only settings `PUT /settings/:key` will write. Anything else is read-only here: `ai.consent` has
 * no write path yet (D22: admin-only, audited, with the signed file), so it is deliberately not listed.
 * SLA policies have their own route.
 */
const WRITABLE: Record<string, WritableSetting> = {
  features: { schema: featuresSchema, allow: canSettingsLists },
  severity_matrix: { schema: severityMatrixSchema, allow: canSettingsSla },
  'ai.monthlyCapUsd': { schema: aiMonthlyCapUsdSchema, allow: canSettingsAi },
  'company.name': { schema: companyNameSchema, allow: canSettingsLists, profile: 'name' },
  'company.language': {
    schema: companyLanguageSchema,
    allow: canSettingsLists,
    profile: 'language',
  },
  'company.timeZone': {
    schema: companyTimeZoneSchema,
    allow: canSettingsLists,
    profile: 'timeZone',
  },
};

export function writableSetting(key: string): WritableSetting | undefined {
  return Object.hasOwn(WRITABLE, key) ? WRITABLE[key] : undefined;
}
