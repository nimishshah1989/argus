import type { FailureCode } from '@uptimo/shared';

/**
 * A plant's starting failure codes, owned by the plant module rather than `seed/` or `packages/shared`
 * (a module may not import `seed/`; SPEC rule 4 keeps plant codes out of the shared package). They are
 * only ever used for a plant that holds no `maint_code` rows at all — every other plant's list is copied
 * from its own maintenance codes (ticket 47's R4).
 */
export interface FailureCodeSeed extends FailureCode {
  label: string;
  sort: number;
  active: boolean;
}

/** One of the plant's own maintenance codes, as the failure list copies it. */
export interface MaintenanceCode {
  code: string;
  label: string;
  sort: number;
  active: boolean;
}

/**
 * Bhavin's three retired codes, folded onto the live code they meant (D31, DATA-MAP: an old code rides on the
 * row's `aliases` rather than as a rival list entry). The rest of his old codes are ticket N12's and are never
 * guessed here.
 */
export const FAILURE_CODE_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  ele: 'E',
  hyd: 'HY',
  rot: 'RT',
});

/** `input.json`'s 19 live codes, in its own order: code, description, position, and the three aliases. */
export const DEFAULT_FAILURE_CODES: readonly FailureCodeSeed[] = [
  ['E', 'Electronics/Electrical'],
  ['M', 'Mechanical'],
  ['AX', 'Axis Problem'],
  ['SP', 'Spindle'],
  ['RT', 'Rotary'],
  ['ATC', 'Automatic Tool Changer'],
  ['PC', 'Pallet Changer'],
  ['LB', 'Lubrication'],
  ['CON', 'Conveyor'],
  ['PM', 'Preventive Maintenance'],
  ['HY', 'Hydraulic'],
  ['MIS', 'Miscellaneous'],
  ['CHI', 'Chiller'],
  ['HUM', 'Human Mistake'],
  ['LIK', 'Leakage'],
  ['PNU', 'Pneumatic'],
  ['TUR', 'Turret'],
  [
    'NO DT',
    'No Downtime — attended outside production hours / during lunch break; counts as a breakdown but not toward downtime hours',
  ],
  ['RINT', 'Machine Reinstallation / Machine Shifting'],
].map(([code, label], position) => ({
  code: code!,
  label: label!,
  sort: position + 1,
  active: true,
  aliases: Object.entries(FAILURE_CODE_ALIASES)
    .filter(([, target]) => target === code)
    .map(([alias]) => alias),
}));

const lower = (value: string): string => value.trim().toLowerCase();
const descriptionOf = new Map(DEFAULT_FAILURE_CODES.map((row) => [lower(row.code), row.label]));

/**
 * The failure list a plant starts with, from the maintenance codes it already owns: code, sort and active as
 * the plant has them, and the plant's own label — or the fallback description when that label is only the bare
 * code (Cosmos's screen reads "Electronics/Electrical", not "E"). The three alternates become aliases on their
 * live code when the plant holds both; an alternate whose target the plant does not have stays a row of its
 * own, because nothing is ever dropped. Only an empty maintenance list takes the 19 fallback codes.
 */
export function failureCodeSeedRows(
  maintCodes: readonly MaintenanceCode[],
): readonly FailureCodeSeed[] {
  if (maintCodes.length === 0)
    return DEFAULT_FAILURE_CODES.map((row) => ({ ...row, aliases: [...row.aliases] }));

  const byLower = new Map(maintCodes.map((row) => [lower(row.code), row]));
  const aliasesOf = new Map<string, string[]>();
  for (const [alias, target] of Object.entries(FAILURE_CODE_ALIASES)) {
    const entry = byLower.get(lower(target));
    if (!entry || !byLower.has(alias)) continue;
    aliasesOf.set(entry.code, [...(aliasesOf.get(entry.code) ?? []), alias]);
  }

  return maintCodes
    .filter((row) => {
      const target = FAILURE_CODE_ALIASES[lower(row.code)];
      // The alternate is an alias on a target the plant holds; without the target it stays a row of its own.
      return !(target && byLower.has(lower(target)));
    })
    .map((row) => ({
      code: row.code,
      label:
        lower(row.label) === lower(row.code)
          ? (descriptionOf.get(lower(row.code)) ?? row.label)
          : row.label,
      sort: row.sort,
      active: row.active,
      aliases: aliasesOf.get(row.code) ?? [],
    }));
}
