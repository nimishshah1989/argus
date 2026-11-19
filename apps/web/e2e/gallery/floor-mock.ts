import type { Page, Route } from '@playwright/test';

/**
 * A made-up plant answered from the browser (no database, no server) for the floor phone: enough of /state,
 * /config, /tickets and /auth/me for every floor screen to render. Invented names and codes only.
 */
const NOW = Date.now();
const ago = (minutes: number): string => new Date(NOW - minutes * 60_000).toISOString();

const SEGMENTS = [
  { id: 's1', code: 'TURN', name: 'Turning', sort: 1, show_on_board: true, group_by: 'group' },
  { id: 's2', code: 'UTIL', name: 'Utilities', sort: 2, show_on_board: true, group_by: 'group' },
];
const GROUPS = [
  { id: 'g1', segment_id: 's1', code: 'CNC', name: 'CNC lathes', sort: 1, hidden: false },
  { id: 'g2', segment_id: 's1', code: 'DRL', name: 'Drills', sort: 2, hidden: false },
  { id: 'g3', segment_id: 's2', code: 'CMP', name: 'Compressors', sort: 1, hidden: false },
];
const MACHINES = [
  { id: 'm1', code: 'CNC-01', category: 'Turning Center', cell: 'Cell 6', group_id: 'g1' },
  { id: 'm2', code: 'CNC-02', category: 'Turning Center', cell: 'Cell 6', group_id: 'g1' },
  { id: 'm3', code: 'CNC-03', category: 'Turning Center', cell: 'Cell 6', group_id: 'g1' },
  { id: 'm4', code: 'DRL-04', category: 'Drill', cell: 'Cell 2', group_id: 'g2' },
  { id: 'm5', code: 'CMP-01', category: 'Compressor', cell: 'Utility', group_id: 'g3' },
].map((machine) => ({ ...machine, segment_id: null, criticality: 'B' as const }));

const PEOPLE = [
  { id: 'p1', name: 'Omi', team: 'Production', title: 'Operator', active: true },
  { id: 'p2', name: 'Ravi', team: 'Maintenance', title: 'Technician', active: true },
];

const item = (list: string, code: string, label: string, sort: number) => ({
  id: `${list}-${code}`,
  list,
  code,
  label,
  labelGu: null,
  labelHi: null,
  sort,
  active: true,
  isVendor: false,
  pausesSla: false,
  tag: null,
});

const CONFIG = {
  features: {},
  language: 'en',
  timeZone: 'Asia/Kolkata',
  lists: {
    quick_problem: [
      item('quick_problem', 'sp', 'Spindle alarm', 1),
      item('quick_problem', 'co', 'Coolant leak', 2),
      item('quick_problem', 'ha', 'Hydraulic pressure low', 3),
    ],
    work_type: [item('work_type', 'pm', 'Preventive', 1), item('work_type', 'el', 'Electrical', 2)],
    task_reason: [],
  },
  segments: SEGMENTS,
  groups: GROUPS,
  machines: MACHINES,
  people: PEOPLE,
  shifts: [],
  severityMatrix: {},
  i18nOverrides: {},
  slaPolicies: [],
  fp: 'fp',
};

type Fields = Record<string, unknown>;

function ticket(id: string, fields: Fields) {
  const machine = MACHINES.find((entry) => entry.id === fields.machineId);
  return {
    id,
    ref: `BD-${id.toUpperCase()}`,
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
    raisedChannel: 'floor',
    machineSnapshot: machine
      ? { code: machine.code, category: machine.category, cell: machine.cell, id: machine.id }
      : null,
    sla: null,
    handback: null,
    canAcknowledge: false,
    ...fields,
  };
}

const HANDBACK = {
  status: 'requested',
  requestedAt: ago(20),
  dueAt: new Date(NOW + 220 * 60_000).toISOString(),
  respondedAt: null,
  respondedByPersonId: null,
  disputeReason: null,
  reopenCount: 0,
  turnaround: { maintenanceMin: 40, productionMin: 0 },
};

/** CNC-02 has a support ticket (Step 2 "Needs support"), DRL-04 a stopped one (already reported). */
const OPEN = [
  ticket('a1', { machineId: 'm2', kind: 'support', problem: 'Coolant low', severity: 'S3' }),
  ticket('a2', { machineId: 'm4', problem: 'Chuck not clamping' }),
];
/** What Omi reported: one waiting for a fix, one in progress, one fixed and asking "Is it fixed?". */
const COMPLAINTS = [
  ticket('b1', { machineId: 'm4', problem: 'Chuck not clamping', raisedLoginId: 'u1' }),
  ticket('b2', { machineId: 'm1', status: 'working', leadPersonId: 'p2', startedAt: ago(30) }),
  ticket('b3', {
    machineId: 'm3',
    status: 'closed',
    problem: 'Door sensor stuck',
    closedAt: ago(15),
    closeKind: 'report',
    handback: HANDBACK,
  }),
];
/** What the maintenance login reported itself: the endpoint answers each person only their own. */
const OWN_TECH = ticket('t1', {
  machineId: 'm5',
  problem: 'Oil level low',
  reportedByPersonId: 'p2',
  raisedLoginId: 'u1',
});
const PM_JOBS = [
  ticket('c1', {
    machineId: 'm5',
    kind: 'general',
    problem: 'Monthly oil and filter check',
    raisedChannel: 'pm',
  }),
  ticket('c2', {
    machineId: 'm1',
    kind: 'general',
    problem: 'Quarterly spindle lubrication',
    raisedChannel: 'pm',
    status: 'working',
    leadPersonId: 'p2',
    startedAt: ago(20),
  }),
];

export type FloorRole = 'operator' | 'technician';

function me(role: FloorRole) {
  const operator = role === 'operator';
  return {
    user: {
      id: 'u1',
      username: operator ? 'omi' : 'ravi',
      name: operator ? 'Omi' : 'Ravi',
      title: operator ? 'Operator' : 'Technician',
      role,
      shared: false,
      actingPersonId: operator ? 'p1' : 'p2',
      cell: 'Cell 6',
    },
  };
}

/** Seed one refused close in the offline outbox so the Drafts card shows. */
function seedDraft(): void {
  const open = indexedDB.open('uptimo-offline', 1);
  open.onupgradeneeded = () => {
    for (const store of ['queue', 'drafts'])
      if (!open.result.objectStoreNames.contains(store))
        open.result.createObjectStore(store, { keyPath: 'id' });
  };
  open.onsuccess = () => {
    const at = new Date().toISOString();
    open.result.transaction('drafts', 'readwrite').objectStore('drafts').put({
      id: 'd1',
      action: 'close',
      ticketId: 'b2',
      ref: 'BD-B2',
      body: {},
      idempotencyKey: 'k1',
      at,
      createdAt: at,
      reason: 'The ticket changed while you were offline.',
      status: 'draft',
    });
  };
}

/** Answer every /api/v1 call from the invented plant and sign the page in. */
export async function mockFloor(
  page: Page,
  options: { role?: FloorRole; recent?: boolean; draft?: boolean } = {},
): Promise<void> {
  const role = options.role ?? 'operator';
  await page.addInitScript(() => localStorage.setItem('uptimo_token', 'e2e'));
  if (options.recent)
    await page.addInitScript(() => localStorage.setItem('floor.recent', '["m1","m4"]'));
  if (options.draft) await page.addInitScript(seedDraft);
  await page.route('**/api/v1/**', (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    const json = (body: unknown) => route.fulfill({ json: body });
    if (path === '/state') return json({ open: OPEN, needReport: [], now: ago(0) });
    if (path === '/config') return json(CONFIG);
    if (path === '/auth/me') return json(me(role));
    if (path === '/tickets' && route.request().method() === 'POST')
      return json({ ticket: ticket('n1', { machineId: 'm1', problem: 'Spindle alarm' }) });
    if (path === '/tickets') {
      const pm = url.searchParams.get('channel') === 'pm';
      const own = [...COMPLAINTS, OWN_TECH].filter(
        (item) => item.reportedByPersonId === url.searchParams.get('raisedBy'),
      );
      return json({ items: pm ? PM_JOBS : own, nextCursor: null });
    }
    return json({});
  });
}

/**
 * Every control and heading that is on screen, top to bottom, as "tag: first 40 letters". Fields are named by
 * their label or placeholder, so a restyle that moves, drops or adds a control changes the list.
 */
export function controlOrder(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const selector = 'h1,h2,h3,a[href],button,input,select,textarea';
    return Array.from(document.querySelectorAll<HTMLElement>(selector))
      .filter((el) => el.getBoundingClientRect().height > 0)
      .map((el) => {
        const field = el as HTMLInputElement;
        const own = el.getAttribute('aria-label') ?? field.labels?.[0]?.textContent ?? '';
        const name = (own || el.textContent || field.placeholder || '').replace(/\s+/g, ' ');
        return `${el.tagName.toLowerCase()}: ${name.trim().slice(0, 40)}`;
      });
  });
}
