export interface ExportMachine {
  id: string;
  category?: string;
  make?: string;
  model?: string;
  serial?: string;
  controller?: string;
  ctrlModel?: string;
  ctrlSerial?: string;
  year?: number | string;
  datePurchase?: string;
  power?: number | string;
  location?: string;
  cell?: string;
  assetCode?: string;
  capacityKva?: number | string;
}

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

export interface PersonSeed {
  name: string;
  team: string;
  kind: string;
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
  people: PersonSeed[];
  lists: ListSeed[];
  shifts: Array<{
    code: string;
    name: string;
    startsAt: string;
    endsAt: string;
    crossesMidnight: boolean;
  }>;
  glossaryTerms: Array<{ source: string; english: string; direction: string }>;
  counts: Record<string, number>;
  conflicts: string[];
}

function toInt(value: number | string | undefined): number | null {
  const n = Number(value);
  return Number.isFinite(n) && value !== '' ? n : null;
}

function machineSeed(m: ExportMachine, segment: string): MachineSeed {
  return {
    code: m.id,
    segment,
    category: m.category ?? null,
    make: m.make ?? null,
    model: m.model ?? null,
    serial: m.serial ?? null,
    controller: m.controller ?? null,
    controllerModel: m.ctrlModel ?? null,
    controllerSerial: m.ctrlSerial ?? null,
    year: toInt(m.year),
    purchasedOn: m.datePurchase ? m.datePurchase : null,
    powerKw: toInt(m.power),
    location: m.location ?? null,
    cell: m.cell ?? null,
    assetCode: m.assetCode ?? null,
    capacityKva: toInt(m.capacityKva),
  };
}

function buildMachines(exp: Record<string, unknown>): MachineSeed[] {
  const arrays: Array<[string, ExportMachine[]]> = [
    ['CNC', exp.machines as ExportMachine[]],
    ['Conventional', exp.conv as ExportMachine[]],
    ['Process', exp.proc as ExportMachine[]],
    ['Utility', exp.util as ExportMachine[]],
    ['DG', exp.dg as ExportMachine[]],
  ];
  const out: MachineSeed[] = [];
  for (const [segment, items] of arrays) {
    for (const item of items)
      out.push(machineSeed(item, item.category === 'Robot' ? 'Robot' : segment));
  }
  out.push({ ...machineSeed({ id: 'VC-57' }, 'CNC'), category: 'Vertical Machining Center' });
  return out;
}

function buildPeople(team: Array<{ name: string; type: string; status: string }>): PersonSeed[] {
  return team.map((person) => ({
    name: person.name,
    team: person.type === 'Vendor' ? 'vendor' : 'maintenance',
    kind: person.type === 'Vendor' ? 'vendor' : 'staff',
  }));
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

function buildShifts(client: Record<string, unknown>): SeedResult['shifts'] {
  return (client.shiftTimes as Array<{ name: string; start: string; end: string }>).map(
    (shift, index) => ({
      code: shift.name,
      name: `Shift ${shift.name}`,
      startsAt: shift.start,
      endsAt: shift.end,
      crossesMidnight: index === 1,
    }),
  );
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

export function buildSeed(
  exp: Record<string, unknown>,
  live: Record<string, unknown>,
  glossary: Record<string, unknown>,
): SeedResult {
  const machines = buildMachines(exp);
  const people = buildPeople(
    (exp.settings as { team: Array<{ name: string; type: string; status: string }> }).team,
  );
  const lists = buildLists(exp, live);
  const shifts = buildShifts(live.client as Record<string, unknown>);
  const glossaryTerms = buildGlossary(glossary);
  const activeCodes = lists.filter((item) => item.list === 'maint_code' && item.active).length;
  const inactiveCodes = lists.filter((item) => item.list === 'maint_code' && !item.active).length;
  const conflicts = [
    'VC-57 exists only in the live ids; segment inferred as CNC, category as Vertical Machining Center, nameplate fields left blank.',
    'Robot is one machine inside the export CNC list; the live config counts it as its own segment.',
    '191 machines in the 28 Oct export, 192 live ids on 9 Nov — the difference is VC-57.',
    '14 people = 13 maintenance + 1 vendor (Imptex Team); the vendor is seeded as a vendor person, not staff.',
    '19 live maintenance codes; ELE, HYD, ROT are kept inactive. History also uses MEC, NI, INT, FS, PP, UTI — not seeded; resolve aliases (Q9).',
    'Two shift windows (08:00–18:30, 18:29–05:00) but the report form lists three shifts — pending Bhavin/Nimish (Q8).',
    'Glossary caveats are recorded in the source file and must be fixed at seed.',
  ];
  return {
    machines,
    people,
    lists,
    shifts,
    glossaryTerms,
    counts: {
      machines: machines.length,
      people: people.length,
      codes_active: activeCodes,
      codes_inactive: inactiveCodes,
      shifts: shifts.length,
      glossary: glossaryTerms.length,
      segments: 6,
    },
    conflicts,
  };
}
