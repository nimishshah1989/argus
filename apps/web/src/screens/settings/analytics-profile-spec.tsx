import { PROFILE_KEYS, profileReplySchema, type ProfileKey } from '@uptimo/shared/analytics';
import type { MessageKey } from '@uptimo/shared/i18n';
import type { CrudSpec } from '../../patterns/crud-spec.js';

/**
 * The analytics profile screen (ticket 37b): one generated settings row over `/analytics-profile`. The
 * fields are the shared table in its own order, so the four groups stay together — plant, forecast, money,
 * action centre — and a number added to `PROFILE_FIELDS` appears here with no screen code. The server hides
 * the money numbers from everyone who may not read them; this screen adds no permission rule of its own.
 */

export interface ProfileRow {
  id: string;
  active: boolean;
  [key: string]: unknown;
}

/** The shared table's group order; the fields are one run per group in this order. */
export const PROFILE_GROUPS = ['plant', 'forecast', 'money', 'actionCenter'] as const;

export const PROFILE_LABELS: Record<ProfileKey, MessageKey> = {
  prodHrsPerDay: 'analytics.profile.prodHrsPerDay',
  workDaysPerYear: 'analytics.profile.workDaysPerYear',
  efficiencyFactor: 'analytics.profile.efficiencyFactor',
  whyWhyThresholdHours: 'analytics.profile.whyWhyThresholdHours',
  flHalfLife: 'analytics.profile.flHalfLife',
  mmThroughput: 'analytics.profile.mmThroughput',
  mmTurnover: 'analytics.profile.mmTurnover',
  mmSucc: 'analytics.profile.mmSucc',
  repeatDays: 'analytics.profile.repeatDays',
  repeatMinDays: 'analytics.profile.repeatMinDays',
  freqDays: 'analytics.profile.freqDays',
  freqMin: 'analytics.profile.freqMin',
  cellDays: 'analytics.profile.cellDays',
  cellMin: 'analytics.profile.cellMin',
  longDays: 'analytics.profile.longDays',
  spikePct: 'analytics.profile.spikePct',
  spikeMinHrs: 'analytics.profile.spikeMinHrs',
  mttrMult: 'analytics.profile.mttrMult',
  mttrMin: 'analytics.profile.mttrMin',
  mttrDays: 'analytics.profile.mttrDays',
  humShare: 'analytics.profile.humShare',
  shiftShare: 'analytics.profile.shiftShare',
  teamShare: 'analytics.profile.teamShare',
  newMachDays: 'analytics.profile.newMachDays',
  newMachMin: 'analytics.profile.newMachMin',
  spareDays: 'analytics.profile.spareDays',
  spareShare: 'analytics.profile.spareShare',
  riseMult: 'analytics.profile.riseMult',
  riseMin: 'analytics.profile.riseMin',
  oldAge: 'analytics.profile.oldAge',
  snoozeDays: 'analytics.profile.snoozeDays',
  pmDays: 'analytics.profile.pmDays',
  noCodePct: 'analytics.profile.noCodePct',
  gapDays: 'analytics.profile.gapDays',
};

export const analyticsProfileSpec: CrudSpec<ProfileRow> = {
  key: 'analytics-profile',
  path: '/api/v1/analytics-profile',
  schema: profileReplySchema,
  titleKey: 'analytics.profile.title',
  emptyKey: 'analytics.profile.empty',
  introKey: 'analytics.profile.intro',
  footnoteKey: 'plant.audit',
  toggle: false,
  fields: PROFILE_KEYS.map((key) => ({ name: key, labelKey: PROFILE_LABELS[key] })),
  look: (_row, c) => ({
    title: c.t('analytics.profile.row'),
    sub: c.t('analytics.profile.row.sub'),
  }),
};
