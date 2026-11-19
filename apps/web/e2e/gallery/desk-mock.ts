import type { Page, Route } from '@playwright/test';

/**
 * A made-up plant answered from the browser (no database, no server): enough of /state, /config, /tickets and
 * /auth/me for the desk lists and the ticket detail to render. Invented names and codes only.
 */
const NOW = Date.now();
const ago = (minutes: number): string => new Date(NOW - minutes * 60_000).toISOString();

const MACHINES = [
  { id: 'm1', code: 'CNC-01', category: 'Turning Center', cell: 'Cell 6' },
  { id: 'm2', code: 'CNC-02', category: 'Turning Center', cell: 'Cell 6' },
  { id: 'm3', code: 'DRL-04', category: 'Drill', cell: 'Cell 2' },
  { id: 'm4', code: 'GRD-07', category: 'Grinder', cell: 'Cell 3' },
].map((machine) => ({
  ...machine,
  segment_id: null,
  group_id: null,
  criticality: 'B' as const,
}));

const PEOPLE = [
  { id: 'p1', name: 'Asha', team: 'Maintenance', title: 'Supervisor', active: true },
  { id: 'p2', name: 'Ravi', team: 'Maintenance', title: 'Technician', active: true },
];

export const CONFIG = {
  features: {},
  language: 'en',
  timeZone: 'Asia/Kolkata',
  lists: {},
  segments: [],
  groups: [],
  machines: MACHINES,
  people: PEOPLE,
  shifts: [],
  severityMatrix: {},
  i18nOverrides: {},
  slaPolicies: [],
  fp: 'fp',
};

const FIGURES = {
  responseMin: 12,
  activeMin: 45,
  waitMin: 10,
  vendorMin: 0,
  handoverWaitMin: 0,
  downAccMin: 55,
  downtimeMin: 55,
  followMin: 0,
  repairMin: 45,
  perPerson: { p2: 45 },
};

type Fields = Record<string, unknown>;

function ticket(id: string, fields: Fields) {
  const machine = MACHINES.find((item) => item.id === fields.machineId);
  return {
    id,
    ref: `T-${id.toUpperCase()}`,
    problem: 'Spindle stops under load',
    kind: 'stopped',
    status: 'open',
    machineId: null,
    reportedByPersonId: 'p1',
    leadPersonId: null,
    transferToPersonId: null,
    transferToShift: null,
    waitReason: null,
    assignedToPersonId: null,
    closedByPersonId: null,
    closeNote: null,
    taskReason: null,
    taskExpectedOn: null,
    location: null,
    workType: null,
    problemLang: null,
    reportedByRole: null,
    parentId: null,
    waitingSpare: null,
    raisedLoginId: null,
    reportedAt: ago(90),
    startedAt: null,
    segmentStartedAt: null,
    handoverSince: null,
    waitSince: null,
    machineRunningAt: null,
    machineStoppedAt: ago(90),
    closedAt: null,
    kindUpgradedAt: null,
    expectedBackAt: null,
    selfStarted: false,
    handedOver: false,
    urgent: false,
    transfers: 0,
    lastEventSeq: 1,
    taskDownMin: null,
    closeKind: null,
    figures: null,
    severity: 'S2',
    criticalitySnapshot: 'B',
    raisedChannel: 'web',
    machineSnapshot: machine
      ? { code: machine.code, category: machine.category, cell: machine.cell, id: machine.id }
      : null,
    sla: null,
    handback: null,
    canAcknowledge: false,
    ...fields,
  };
}

const OPEN = [
  ticket('a1', { machineId: 'm1' }),
  ticket('a2', { machineId: 'm2', kind: 'support', severity: 'S3', problem: 'Coolant low' }),
  ticket('b1', {
    machineId: 'm3',
    status: 'working',
    leadPersonId: 'p2',
    startedAt: ago(40),
    figures: FIGURES,
  }),
  ticket('c1', {
    machineId: 'm4',
    status: 'waiting',
    leadPersonId: 'p2',
    startedAt: ago(120),
    waitSince: ago(30),
    waitReason: 'spare',
    figures: FIGURES,
  }),
  ticket('w1', { kind: 'general', problem: 'Fix the store door', severity: 'S4' }),
];
const CLOSED = ticket('d1', {
  machineId: 'm1',
  status: 'closed',
  closeKind: 'no_report',
  leadPersonId: 'p2',
  closedByPersonId: 'p2',
  startedAt: ago(300),
  closedAt: ago(200),
  figures: FIGURES,
});
const NEED_REPORT = [CLOSED];

const TASKS = { pending: 0, inProgress: 0, overdue: 0, done: 0, box: 'none' };

function detail(source: ReturnType<typeof ticket>) {
  const lead = source.leadPersonId as string | null;
  return {
    ticket: source,
    events: [
      {
        seq: 1,
        type: 'raise',
        at: source.reportedAt,
        text: source.problem,
        reason: null,
        actingPersonId: 'p1',
        loginId: null,
        isVendor: false,
        changes: null,
      },
    ],
    people: lead ? [{ personId: lead, role: 'primary', leftAt: null, leftReason: null }] : [],
    tasks: [],
    taskSummary: TASKS,
    parent: null,
    intervals: lead ? [{ personId: lead, role: 'primary', startedAt: ago(40), endedAt: null }] : [],
    report: null,
    pmPlan: null,
  };
}

export type DeskRole = 'supervisor' | 'technician';

function me(role: DeskRole) {
  return {
    user: {
      id: 'u1',
      username: 'asha',
      name: 'Asha',
      title: role,
      role,
      shared: false,
      actingPersonId: role === 'supervisor' ? 'p1' : 'p2',
    },
  };
}

/** Answer every /api/v1 call from the invented plant and sign the page in. */
export async function mockDesk(page: Page, role: DeskRole = 'supervisor'): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('uptimo_token', 'e2e'));
  const everyone = [...OPEN, CLOSED];
  await page.route('**/api/v1/**', (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    const json = (body: unknown) => route.fulfill({ json: body });
    if (path === '/state') return json({ open: OPEN, needReport: NEED_REPORT, now: ago(0) });
    if (path === '/config') return json(CONFIG);
    if (path === '/auth/me') return json(me(role));
    if (path === '/board/signoff') return json({ items: [] });
    if (path === '/tickets') {
      const wanted = url.searchParams.getAll('status').flatMap((value) => value.split(','));
      const items = everyone.filter((item) => wanted.length === 0 || wanted.includes(item.status));
      return json({ items, nextCursor: null });
    }
    const one = path.match(/^\/tickets\/(\w+)$/)?.[1];
    const found = everyone.find((item) => item.id === one);
    if (found) return json(detail(found));
    return json({});
  });
}

export const TICKETS = { working: 'b1', open: 'a1', closed: 'd1' };

/**
 * Every control and heading that is on screen, top to bottom, as "tag: first 12 letters". Card names carry
 * the machine code and the ticket reference first, so the list is the same on every run of the invented plant.
 */
export function controlOrder(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const selector = 'h1,h2,h3,a[href],button,input,select,textarea';
    return Array.from(document.querySelectorAll<HTMLElement>(selector))
      .filter((el) => el.getBoundingClientRect().height > 0)
      .map((el) => {
        const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ');
        return `${el.tagName.toLowerCase()}: ${name.trim().slice(0, 12)}`;
      });
  });
}
