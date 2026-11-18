import {
  mapAssetRegisters,
  type AssetRegisterDraft,
  type RegisterWorkbook,
} from './asset-registers.js';
import { PM_WORKBOOK_AS_OF, mapPmPlans, type MappedPmPlan, type PmWorkbook } from './pm-plans.js';

export interface MachineSeed {
  code: string;
  segment: string;
  category: string | null;
  make: string | null;
  model: string | null;
  serial: string | null;
  controller: string | null;
  controllerModel: string | null;
  controllerSerial: string | null;
  year: number | null;
  purchasedOn: string | null;
  powerKw: number | null;
  location: string | null;
  cell: string | null;
  assetCode: string | null;
  capacityKva: number | null;
}

export interface PeopleEntry {
  username: string;
  name: string;
  role: string;
  title?: string;
  phone?: string;
  shift?: string;
}

export interface SeedFiles {
  machines: { sheetCounts: Record<string, number>; machines: MachineSeed[] };
  shifts: SeedResult['shifts'];
  people: { users: PeopleEntry[] };
  pm: PmWorkbook;
  /** The workbook's AMC/Warranty and Legal Compliance sheets (51a); the same answer-key fixture. */
  registers: RegisterWorkbook;
}

export const ROLE_MAP = {
  maint: { role: 'technician', team: 'maintenance' },
  report: { role: 'operator', team: 'production' },
  admin: { role: 'admin', team: 'maintenance' },
} as const;

export interface PersonSeed {
  name: string;
  team: string;
  title: string | null;
  phone: string | null;
  defaultShift: string | null;
  login: { username: string; role: string } | null;
}

export interface ListSeed {
  list: string;
  code: string;
  label: string;
  active: boolean;
  isVendor?: boolean;
  pausesSla?: boolean;
}

export interface SeedResult {
  machines: MachineSeed[];
  /** The workbook's PM plans: one recurring plan per machine, written by the plant seed (49a). */
  pmPlans: MappedPmPlan[];
  /** The workbook's register lines, written by the plant seed after the machines (51a). */
  assetRegisters: AssetRegisterDraft[];
  people: PersonSeed[];
  lists: ListSeed[];
  shifts: Array<{
    code: string;
    name: string;
    startsAt: string;
    endsAt: string;
    crossesMidnight: boolean;
  }>;
  teamShifts: Record<string, string>;
  glossaryTerms: Array<{ source: string; english: string; direction: string }>;
  counts: Record<string, number>;
  conflicts: string[];
}

function isText(value: unknown): boolean {
  return typeof value === 'string' && value !== '';
}

// Messages never carry a name, username or phone.
export function buildPeople(
  users: unknown,
  exportTeam: Array<{ name: string; type: string; status: string }>,
): { people: PersonSeed[]; teamShifts: Record<string, string> } {
  if (!Array.isArray(users)) throw new Error('seed: people file has no users array');
  const people: PersonSeed[] = [];
  const teamShifts: Record<string, string> = {};
  users.forEach((u: Partial<PeopleEntry>, i) => {
    const bad = !isText(u?.username)
      ? 'username'
      : !isText(u.name)
        ? 'name'
        : typeof u.role !== 'string' || !Object.hasOwn(ROLE_MAP, u.role)
          ? 'role'
          : null;
    if (bad) throw new Error(`seed: people entry ${i} is invalid (${bad})`);
    const map = ROLE_MAP[u.role as keyof typeof ROLE_MAP];
    if (u.shift) teamShifts[u.name as string] = u.shift;
    people.push({
      name: u.name as string,
      team: map.team,
      title: u.title || null,
      phone: u.phone ?? null,
      defaultShift: u.shift ?? null,
      login: { username: u.username as string, role: map.role },
    });
  });
  for (const v of exportTeam.filter((t) => t.type === 'Vendor'))
    people.push({
      name: v.name,
      team: 'vendor',
      title: null,
      phone: null,
      defaultShift: null,
      login: null,
    });
  return { people, teamShifts };
}

const SEGMENTS = ['CNC', 'Conventional', 'Process', 'Utility', 'DG', 'Robot'];

export function machineConflicts(
  exp: Record<string, unknown>,
  machines: SeedFiles['machines'],
): string[] {
  const oldIds = ['machines', 'conv', 'proc', 'util', 'dg'].flatMap((key) =>
    (exp[key] as Array<{ id: string }>).map((m) => m.id),
  );
  const newIds = machines.machines.map((m) => m.code);
  const count = (segment: string) => machines.machines.filter((m) => m.segment === segment).length;
  const lines: string[] = [];
  const robots = count('Robot');
  if (robots)
    lines.push(
      `CNC Machine Master has ${machines.sheetCounts['CNC Machine Master']} rows: ${count('CNC')} CNC + ${robots} Robot (own segment).`,
    );
  const added = newIds.filter((id) => !oldIds.includes(id));
  if (added.length)
    lines.push(`In the 11 Nov registers but not the 28 Oct export: ${added.join(', ')}.`);
  const dropped = oldIds.filter((id) => !newIds.includes(id));
  if (dropped.length)
    lines.push(`In the 28 Oct export but not the 11 Nov registers: ${dropped.join(', ')}.`);
  for (const segment of SEGMENTS) {
    const blank = machines.machines
      .filter((m) => m.segment === segment && !(m.make && m.model && m.serial))
      .map((m) => m.code);
    if (blank.length) lines.push(`Blank make, model or serial in ${segment}: ${blank.join(', ')}.`);
  }
  return lines;
}

function codeList(live: string[], exportCodes: Array<{ code: string }>): ListSeed[] {
  const inactive = exportCodes.filter((c) => !live.includes(c.code)).map((c) => c.code);
  const out: ListSeed[] = live.map((code) => ({
    list: 'maint_code',
    code,
    label: code,
    active: true,
  }));
  for (const code of inactive) out.push({ list: 'maint_code', code, label: code, active: false });
  return out;
}

function buildLists(exp: Record<string, unknown>, live: Record<string, unknown>): ListSeed[] {
  const ref = live.ref as {
    codes: string[];
    observedBy: string[];
    locations: string[];
    cells: string[];
  };
  const client = live.client as Record<string, unknown>;
  const exportCodes = (exp.settings as { codes: Array<{ code: string }> }).codes;
  const lists: ListSeed[] = [
    ...codeList(ref.codes, exportCodes),
    ...(client.waitReasons as string[]).map((label) => ({
      list: 'wait_reason',
      code: label.toLowerCase().slice(0, 40),
      label,
      active: true,
      isVendor: label === 'Sent to vendor for repair',
      pausesSla: label === 'Sent to vendor for repair' || label === 'Waiting for spare',
    })),
    ...(client.workTypes as string[]).map((label) => ({
      list: 'work_type',
      code: label,
      label,
      active: true,
    })),
    ...[
      'Not starting',
      'Unusual noise',
      'Alarm on screen',
      'Coolant problem',
      'Oil leak',
      'Tool problem',
    ].map((label) => ({ list: 'quick_problem', code: label, label, active: true })),
    ...(['E', 'M', 'E/M', 'PM'] as const).map((code) => ({
      list: 'breakdown_category',
      code,
      label: code,
      active: true,
    })),
    ...ref.observedBy.map((label) => ({ list: 'observed_by', code: label, label, active: true })),
    ...ref.locations.map((label) => ({ list: 'location', code: label, label, active: true })),
    ...ref.cells.map((label) => ({ list: 'cell', code: label, label, active: true })),
    ...['Waiting for spare', 'Waiting for vendor', 'Needs a planned stop', 'Other'].map(
      (label) => ({
        list: 'task_reason',
        code: label,
        label,
        active: true,
      }),
    ),
  ];
  return lists;
}

function buildGlossary(glossary: Record<string, unknown>): SeedResult['glossaryTerms'] {
  return [
    ...Object.entries(glossary.english_corrections as Record<string, string>).map(
      ([source, english]) => ({
        source,
        english,
        direction: 'gu-Latn',
      }),
    ),
    ...Object.entries(glossary.gujarati_terms as Record<string, string>).map(
      ([source, english]) => ({
        source,
        english,
        direction: 'gu',
      }),
    ),
  ];
}

/** The workbook's own caveats, reported beside the machine differences: they never fail the seed. */
const SEED_CAVEATS = [
  '19 live maintenance codes; ELE, HYD, ROT are kept inactive. History also uses MEC, NI, INT, FS, PP, UTI — not seeded; resolve aliases (Q9).',
  'Two shift windows (08:00–18:30, 18:29–05:00) but the report form lists three shifts — pending Bhavin/Nimish (Q8).',
  'Glossary caveats are recorded in the source file and must be fixed at seed.',
];

export function buildSeed(
  exp: Record<string, unknown>,
  live: Record<string, unknown>,
  glossary: Record<string, unknown>,
  files: SeedFiles,
): SeedResult {
  const machines = files.machines.machines;
  const pm = mapPmPlans(files.pm, { asOf: PM_WORKBOOK_AS_OF });
  const registers = mapAssetRegisters(files.registers, { defaultLeadDays: 15 });
  const exportTeam = (
    exp.settings as { team: Array<{ name: string; type: string; status: string }> }
  ).team;
  const { people, teamShifts } = buildPeople(files.people.users, exportTeam);
  const lists = buildLists(exp, live);
  const glossaryTerms = buildGlossary(glossary);
  const activeCodes = lists.filter((item) => item.list === 'maint_code' && item.active).length;
  const inactiveCodes = lists.filter((item) => item.list === 'maint_code' && !item.active).length;
  const roleCount = (role: string) => people.filter((p) => p.login?.role === role).length;
  const logins = people.filter((p) => p.login).length;
  const vendors = people.filter((p) => !p.login).map((p) => p.name);
  const segmentCounts = Object.fromEntries(
    SEGMENTS.map((s) => [`segment_${s}`, machines.filter((m) => m.segment === s).length]),
  );
  const conflicts = [
    ...machineConflicts(exp, files.machines),
    ...registers.conflicts,
    `${logins} logins (${roleCount('technician')} technician, ${roleCount('operator')} operator, ${roleCount('admin')} admin) + ${vendors.length} vendor person (${vendors.join(', ')}) without a login.`,
    ...SEED_CAVEATS,
  ];
  return {
    machines,
    pmPlans: pm.plans,
    assetRegisters: registers.items,
    people,
    lists,
    shifts: files.shifts,
    teamShifts,
    glossaryTerms,
    counts: {
      machines: machines.length,
      ...segmentCounts,
      people: people.length,
      logins,
      codes_active: activeCodes,
      codes_inactive: inactiveCodes,
      shifts: files.shifts.length,
      glossary: glossaryTerms.length,
      segments: 6,
      pm_plan_source_rows: pm.sourceRows,
      pm_plan_visits: Object.values(pm.visits).reduce((sum, n) => sum + n, 0),
      pm_plans: pm.plans.length,
      pm_plan_done: pm.plans.filter((plan) => plan.lastDoneOn !== null).length,
      pm_plan_checklists: pm.plans.filter((plan) => plan.checklist.length > 0).length,
      registers: registers.items.length,
      registers_amc: registers.counts.amc,
      registers_legal: registers.counts.legal,
    },
    conflicts,
  };
}
