import type { AnalyticsProfile } from '@uptimo/shared';
import type { EngineData, ExportData, ExportSettings } from '@uptimo/domain';

/**
 * The workbook's input, built from what the server already loads (ticket 45, packet 45d): the engine's plant rows,
 * the analytics profile and the tenant's name. The Settings sheet's lists are read off those rows — the segment,
 * category, cell, location and shift values the plant actually holds, then the configured lists' own codes — so a
 * live export needs no extra query. The PM registers and the platform's App Settings are absent until M4b 49/51:
 * their sheets print their header row today.
 */

/** The distinct values of `values`, in the order they first appear, skipping blanks. */
function unique(values: Iterable<string | null>): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const value of values) {
    if (value === null || value === '' || seen.has(value)) continue;
    seen.add(value);
    list.push(value);
  }
  return list;
}

/** A configured list's codes, then any value a row holds that the list does not name yet. */
function configuredThen(codes: readonly string[], values: Iterable<string | null>): string[] {
  return unique([...codes, ...values]);
}

const segmentsOf = (data: EngineData): string[] =>
  unique(data.machines.map((machine) => machine.segment));

const categoriesOf = (data: EngineData, segment?: string): string[] =>
  unique(
    data.machines
      .filter((machine) => segment === undefined || machine.segment === segment)
      .map((machine) => machine.category),
  );

/** The plant's Settings lists as the workbook's Settings sheet prints them. */
export function exportSettingsFor(data: EngineData): ExportSettings {
  const listCodes = (name: string): string[] =>
    (data.lists[name] ?? []).map((item) => item.code).filter((code) => code !== '');
  return {
    segments: segmentsOf(data),
    categories: categoriesOf(data),
    conventionalCategories: categoriesOf(data, 'Conventional'),
    processCategories: categoriesOf(data, 'Process'),
    utilityCategories: categoriesOf(data, 'Utility'),
    shifts: unique(data.reports.map((report) => report.shift)),
    locations: configuredThen(
      listCodes('location'),
      data.machines.map((machine) => machine.location),
    ),
    cells: configuredThen(
      listCodes('cell'),
      data.machines.map((machine) => machine.cell),
    ),
    breakdownCategories: configuredThen(
      listCodes('breakdown_category'),
      data.reports.map((report) => report.category),
    ),
    team: data.people.map((person) => ({
      name: person.displayName,
      type: person.team === 'vendor' ? 'Vendor' : 'Team',
    })),
  };
}

/** The platform's three spare-cost slots by report id: the stored row has one sum, the other two slots are blank. */
function spareCostsOf(data: EngineData): Readonly<Record<string, readonly (number | null)[]>> {
  const costs: Record<string, readonly (number | null)[]> = {};
  for (const report of data.reports) {
    const slots =
      report.spareCosts ??
      (report.spareCost === null || report.spareCost === undefined
        ? null
        : [report.spareCost, null, null]);
    if (slots !== null && slots.some((slot) => slot !== null)) costs[report.id] = slots;
  }
  return costs;
}

/** Everything `workbookSheets` reads, from the load the routes already make. */
export function exportDataFor(input: {
  data: EngineData;
  profile: AnalyticsProfile;
  tenant: string;
  asOf: string;
}): ExportData {
  return {
    tenant: input.tenant,
    asOf: input.asOf,
    profile: input.profile,
    data: input.data,
    settings: exportSettingsFor(input.data),
    spareCosts: spareCostsOf(input.data),
  };
}
