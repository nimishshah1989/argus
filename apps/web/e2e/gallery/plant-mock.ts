import type { Page, Route } from '@playwright/test';
import { CONFIG, mockDesk } from './desk-mock.js';

/**
 * The live board and the Settings screens answered from the browser (ticket 88b): the desk's invented plant, a
 * signed-in admin, the day score, the severity and SLA settings and the plant lists. Anything not answered here
 * falls through to `mockDesk`. Invented names only; no database, no server.
 */
const SEGMENTS = [
  {
    id: 's1',
    code: 'TC',
    name: 'Turning',
    sort: 1,
    showOnBoard: true,
    groupBy: 'category',
    active: true,
  },
];

const MATRIX_ROW = { stopped: 'S1', support: 'S3' };
const MATRIX = {
  default: {
    A: MATRIX_ROW,
    B: { stopped: 'S2', support: 'S3' },
    C: { stopped: 'S3', support: 'S4' },
  },
  workRequest: 'S4',
  urgentWorkRequest: 'S3',
};

const POLICY_IDS = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004',
];
const SLA = ['S1', 'S2', 'S3', 'S4'].map((severity, at) => ({
  id: POLICY_IDS[at],
  severity,
  ackMinutes: 10 * (at + 1),
  restoreMinutes: 60 * (at + 1),
  pauseMaxMinutes: null,
  handbackMinutes: null,
  businessHoursOnly: at > 1,
}));

const WAIT_REASON = [
  {
    id: 'w1',
    list: 'wait_reason',
    code: 'spare',
    label: 'Spare part',
    labelGu: null,
    labelHi: null,
  },
].map((item) => ({
  ...item,
  sort: 1,
  active: true,
  isVendor: false,
  pausesSla: true,
  tag: null,
  aliases: [],
}));

const MACHINE_ROWS = ['CNC-01', 'CNC-02', 'DRL-04'].map((code, at) => ({
  id: `m${at + 1}`,
  code,
  category: at < 2 ? 'Turning Center' : 'Drill',
  cell: at < 2 ? 'Cell 6' : 'Cell 2',
  area: null,
  location: null,
  segmentId: 's1',
  groupId: null,
  make: null,
  model: null,
  serial: null,
  year: null,
  status: 'in_service',
  criticality: 'B',
  excludedFromProduction: at === 1,
  active: true,
}));

const SHIFTS = [
  { id: 'h1', code: 'A', name: 'Day', startsAt: '06:00', endsAt: '14:00', crossesMidnight: false },
  {
    id: 'h2',
    code: 'B',
    name: 'Evening',
    startsAt: '14:00',
    endsAt: '22:00',
    crossesMidnight: false,
  },
].map((shift) => ({ ...shift, active: true }));

const ADMIN = {
  user: {
    id: 'u9',
    username: 'ops',
    name: 'Asha',
    title: 'Plant admin',
    role: 'admin',
    shared: false,
    actingPersonId: 'p1',
  },
};

/** Reads on the plant lists, by path; each Settings list reads `{ items }`. */
const LISTS: Record<string, unknown[]> = {
  '/segments': SEGMENTS.map(({ showOnBoard, ...rest }) => ({ ...rest, showOnBoard })),
  '/machines': MACHINE_ROWS,
  '/groups': [],
  '/shifts': SHIFTS,
};

/** Answer the board, the Settings screens and everything the desk mock answers. */
export async function mockPlant(page: Page): Promise<void> {
  await mockDesk(page);
  await page.route('**/api/v1/**', (route: Route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    const json = (body: unknown) => route.fulfill({ json: body });
    if (path === '/auth/me') return json(ADMIN);
    if (path === '/config') {
      return json({
        ...CONFIG,
        segments: SEGMENTS.map((s) => ({
          id: s.id,
          code: s.code,
          name: s.name,
          sort: s.sort,
          show_on_board: true,
          group_by: s.groupBy,
        })),
        lists: { wait_reason: WAIT_REASON },
        severityMatrix: MATRIX,
        slaPolicies: SLA,
      });
    }
    if (path === '/board/today') {
      const now = new Date().toISOString();
      return json({
        now,
        from: now,
        to: now,
        tickets: 5,
        notStarted: 2,
        stillOpen: 4,
        responseMin: 12,
        repairMin: 45,
        waitingMin: 10,
        responseCount: 5,
        responseClosed: 3,
        repairCount: 4,
        repairClosed: 2,
      });
    }
    if (path === '/jobs/failed') {
      const at = new Date().toISOString();
      const job = { id: 'j1', queue: 'report-mail', error: 'Mail server said no', attempts: 3 };
      return json({ items: [{ ...job, createdAt: at, failedAt: at }] });
    }
    if (path === '/settings') {
      return json([
        { key: 'company_name', value: 'Sample Works' },
        { key: 'language', value: 'en' },
        { key: 'time_zone', value: 'Asia/Kolkata' },
        { key: 'features', value: {} },
      ]);
    }
    if (path in LISTS) return json({ items: LISTS[path], nextCursor: null });
    // Any other Settings list (people, logins, registers, the audit trail...) is empty.
    if (!/^\/(state|tickets|board)/.test(path) && route.request().method() === 'GET') {
      return json({ items: [], nextCursor: null });
    }
    return route.fallback();
  });
}
