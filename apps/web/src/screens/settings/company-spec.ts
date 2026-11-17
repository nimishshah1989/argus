import type { LabelKey } from '../../patterns/crud-spec.js';

/** The company screen's config (ticket 23): each field is one setting key, or one switch in `features`. */

export interface SettingRow {
  key: string;
  value: unknown;
}

export interface CompanyField {
  /** The form's id: the setting key, or `features:<name>` for one switch inside the record. */
  id: string;
  key: string;
  /** Set on a feature switch: its name inside the `features` record. */
  feature?: string;
  kind: 'text' | 'choice' | 'flag';
  labelKey: LabelKey;
  helpKey?: LabelKey;
  required?: boolean;
  choices?: readonly { value: string; labelKey: LabelKey }[];
}

export type CompanyValues = Record<string, string>;
export interface CompanyChange {
  key: string;
  value: unknown;
}

const FEATURES = ['general', 'pause', 'floorLive'] as const;

export const COMPANY_FIELDS: readonly CompanyField[] = [
  {
    id: 'company.name',
    key: 'company.name',
    kind: 'text',
    labelKey: 'company.name',
    helpKey: 'company.name.help',
    required: true,
  },
  {
    id: 'company.language',
    key: 'company.language',
    kind: 'choice',
    labelKey: 'company.language',
    helpKey: 'company.language.help',
    choices: [
      { value: 'en', labelKey: 'company.language.en' },
      { value: 'gu', labelKey: 'company.language.gu' },
      { value: 'hi', labelKey: 'company.language.hi' },
    ],
  },
  {
    id: 'company.timeZone',
    key: 'company.timeZone',
    kind: 'text',
    labelKey: 'company.timeZone',
    helpKey: 'company.timeZone.help',
    required: true,
  },
  ...FEATURES.map((feature): CompanyField => ({
    id: `features:${feature}`,
    key: 'features',
    feature,
    kind: 'flag',
    labelKey: `company.feature.${feature}`,
    helpKey: `company.feature.${feature}.help`,
  })),
];

/** The page's two groups, from the one config: a field added there appears with no screen code. */
export const companySections = (
  fields: readonly CompanyField[],
): { titleKey: LabelKey; fields: readonly CompanyField[] }[] => [
  { titleKey: 'company.details', fields: fields.filter((field) => field.kind !== 'flag') },
  { titleKey: 'company.features', fields: fields.filter((field) => field.kind === 'flag') },
];

/** The rows of `GET /settings` as the form's values. */
export function companyValues(rows: readonly SettingRow[]): CompanyValues {
  const stored = (key: string) => rows.find((row) => row.key === key)?.value;
  const features = (stored('features') ?? {}) as Record<string, unknown>;
  return Object.fromEntries(
    COMPANY_FIELDS.map((field) => [
      field.id,
      field.feature ? String(features[field.feature] === true) : String(stored(field.key) ?? ''),
    ]),
  );
}

/** One PUT per changed detail, and the whole `features` record once when any switch moved. */
export function companyChanges(original: CompanyValues, draft: CompanyValues): CompanyChange[] {
  const changes: CompanyChange[] = [];
  for (const field of COMPANY_FIELDS) {
    if (field.kind === 'flag') continue;
    const before = original[field.id] ?? '';
    const after = draft[field.id] ?? before;
    if (before !== after) changes.push({ key: field.key, value: after });
  }
  const flags = COMPANY_FIELDS.filter((field) => field.kind === 'flag');
  if (flags.some((field) => (original[field.id] ?? '') !== (draft[field.id] ?? ''))) {
    changes.push({
      key: 'features',
      value: Object.fromEntries(flags.map((field) => [field.feature!, draft[field.id] === 'true'])),
    });
  }
  return changes;
}
