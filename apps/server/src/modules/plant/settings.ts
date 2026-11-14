import type { z } from 'zod';
import { aiMonthlyCapUsdSchema, featuresSchema, severityMatrixSchema } from '@uptimo/shared';
import { canSettingsAi, canSettingsLists, canSettingsSla, type ActorContext } from '@uptimo/domain';

interface WritableSetting {
  schema: z.ZodTypeAny;
  /** The permissions-matrix row that says who may change it (DOMAIN §3). */
  allow: (actor: ActorContext) => boolean;
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
};

export function writableSetting(key: string): WritableSetting | undefined {
  return Object.hasOwn(WRITABLE, key) ? WRITABLE[key] : undefined;
}
