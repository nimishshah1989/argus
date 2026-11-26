import { SEGMENT, TENANT, scopedId, type MachineFixture, type SeedStatement } from './fixtures.js';

const PROJECTS = ['chromium', 'phone', 'gujarati'];

/**
 * Five machines per project, lettered so no floor search by number finds them: A to C for the sign-off spec (ticket
 * 34), D and E for the desk-data spec (sign-off outcomes, the close form's code picker).
 */
const SIGNOFF_MACHINES: MachineFixture[] = Array.from({ length: 15 }, (_, i) => ({
  id: scopedId(`10000000-0000-0000-0002-${String(i).padStart(12, '0')}`),
  code: `SO-${'ABCDE'[Math.floor(i / 3)]}${i % 3}`,
  category: 'VMC',
  cell: 'Cell-6',
}));

/** SO-<A to C><project>: one machine per sign-off test per project, so nothing else raises on them. */
export function signoffMachine(
  test: 'A' | 'B' | 'C' | 'D' | 'E',
  projectName: string,
): MachineFixture {
  const code = `SO-${test}${Math.max(0, PROJECTS.indexOf(projectName))}`;
  const machine = SIGNOFF_MACHINES.find((m) => m.code === code);
  if (!machine) throw new Error(`No sign-off machine ${code}`);
  return machine;
}

export function signoffSeedStatements(): SeedStatement[] {
  return SIGNOFF_MACHINES.map((machine) => ({
    text: 'INSERT INTO machine (id, tenant_id, code, segment_id, category, cell) VALUES ($1, $2, $3, $4, $5, $6)',
    values: [machine.id, TENANT.id, machine.code, SEGMENT.id, machine.category, machine.cell],
  }));
}
