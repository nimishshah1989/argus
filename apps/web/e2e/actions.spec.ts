import {
  availableActions,
  canWork,
  type ActionCrewMember,
  type ActorContext,
  type TicketAction,
} from '@uptimo/domain';
import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from './test.js';
import { apiLogin, raiseTicketViaApi, signIn } from './fixtures.js';
import { actionMachines, commandViaApi, getJson } from './fixtures-actions.js';

/**
 * The action matrix: six tickets in six states, eight logins, one rule. Every button the ticket
 * page shows must be what the domain `availableActions` offers (the server's rule), and nothing
 * else. The six tickets are raised through the API, so the spec does not depend on the floor form.
 */
test.describe.configure({ mode: 'serial' });

const LOGINS = ['asha', 'bina', 'op', 'sup', 'head', 'ph', 'brd', 'admin'] as const;
const BUTTON: Record<TicketAction, string> = {
  start: 'Start',
  resume: 'Resume',
  update: 'Update',
  pause: 'Pause',
  transfer: 'Transfer',
  'machine-running': 'Machine running',
  'machine-stopped': 'Machine stopped',
  join: 'Add me as support',
  leave: 'Leave',
  close: 'Close',
  cancel: 'Cancel',
};

interface Seeded {
  id: string;
  ref: string;
}
type Name = 'open' | 'working' | 'handed over' | 'waiting' | 'closed' | 'cancelled';
const seeded = {} as Record<Name, Seeded>;
const tokens = {} as Record<(typeof LOGINS)[number], string>;
const details = {} as Record<Name, DetailReply>;

interface MeReply {
  user: { id: string; role: ActorContext['role']; shared: boolean; actingPersonId: string };
}
interface DetailReply {
  ticket: Parameters<typeof availableActions>[0] & { handedOver: boolean };
  people: { personId: string; role: string; leftAt: string | null }[];
}

async function personOf(login: (typeof LOGINS)[number]): Promise<string> {
  return (await getJson<MeReply>(tokens[login], '/api/v1/auth/me')).user.actingPersonId;
}

test.beforeAll(async () => {
  for (const login of LOGINS) tokens[login] = await apiLogin(login);
  const { a, b } = actionMachines();
  const [asha, bina, op] = await Promise.all([personOf('asha'), personOf('bina'), personOf('op')]);
  const as =
    (token: string, personId: string) =>
    (id: string, action: string, extra = {}) =>
      commandViaApi(token, id, action, { personId, ...extra });
  const byAsha = as(tokens.asha, asha);
  const byOp = as(tokens.op, op);

  seeded.open = await raiseTicketViaApi(tokens.op, a.id, 'Matrix: open stopped');
  seeded.working = await raiseTicketViaApi(tokens.asha, b.id, 'Matrix: working stopped');
  await byAsha(seeded.working.id, 'start');
  await as(tokens.bina, bina)(seeded.working.id, 'join', { role: 'support' });

  seeded['handed over'] = await raiseTicketViaApi(tokens.asha, null, 'Matrix: handed over');
  await byAsha(seeded['handed over'].id, 'start');
  await byAsha(seeded['handed over'].id, 'transfer', { note: 'Night shift' });

  seeded.waiting = await raiseTicketViaApi(tokens.asha, null, 'Matrix: waiting');
  await byAsha(seeded.waiting.id, 'start');
  await byAsha(seeded.waiting.id, 'pause', { reasonCode: 'spare' });

  seeded.closed = await raiseTicketViaApi(tokens.asha, null, 'Matrix: closed');
  await byAsha(seeded.closed.id, 'start');
  await byAsha(seeded.closed.id, 'close', { kind: 'done' });

  seeded.cancelled = await raiseTicketViaApi(tokens.op, null, 'Matrix: cancelled');
  await byOp(seeded.cancelled.id, 'cancel', { reason: 'Raised by mistake' });

  // The six tickets do not change while the matrix runs, so read them once (the API rate limit is shared).
  for (const name of Object.keys(seeded) as Name[]) {
    details[name] = await getJson<DetailReply>(tokens.admin, `/api/v1/tickets/${seeded[name].id}`);
  }
});

/** Later specs on this worker must not see the live tickets this one raised. */
test.afterAll(async () => {
  const admin = await personOf('admin');
  for (const name of ['open', 'working', 'handed over', 'waiting'] as const) {
    await commandViaApi(tokens.admin, seeded[name].id, 'cancel', {
      personId: admin,
      reason: 'Matrix cleanup',
    });
  }
});

/** The literal bars three rows must show, so one wrong rule cannot hide behind the shared function. */
const LITERAL: Partial<Record<`${string}/${Name}`, string[]>> = {
  'asha/working': ['Update', 'Pause', 'Transfer', 'Machine running', 'Close', 'Cancel'],
  'bina/working': ['Update', 'Pause', 'Transfer', 'Machine running', 'Leave', 'Cancel'],
  'asha/open': ['Start', 'Cancel'],
};

/**
 * The API allows 1000 requests a minute from one address and the whole run shares it. The matrix
 * loads 48 ticket pages, so the read-only lookups around each page (brand, config, tags, me) are
 * answered from the first real reply per login; the ticket itself is always read from the server.
 */
const LOOKUPS = /\/api\/v1\/(brand|config|tags|auth\/me|tickets\/[0-9a-f-]+\/tags)(\?|$)/;
const lookups = new Map<
  string,
  { status: number; headers: Record<string, string>; body: Buffer }
>();

function lookupKey(url: string, headers: Record<string, string>): string {
  return `${headers.authorization ?? ''} ${url}`;
}

async function answerLookupsOnce(context: BrowserContext): Promise<void> {
  await context.route(LOOKUPS, (route) => {
    const request = route.request();
    const hit = lookups.get(lookupKey(request.url(), request.headers()));
    return hit ? route.fulfill(hit) : route.continue();
  });
  context.on('response', async (response) => {
    if (!LOOKUPS.test(response.url()) || !response.ok()) return;
    const key = lookupKey(response.url(), response.request().headers());
    if (lookups.has(key)) return;
    const body = await response.body().catch(() => null);
    if (body) lookups.set(key, { status: response.status(), headers: response.headers(), body });
  });
}

async function expectBar(
  page: Page,
  actor: ActorContext,
  login: (typeof LOGINS)[number],
  name: Name,
): Promise<void> {
  const { id, ref } = seeded[name];
  const detail = details[name];
  const crew = detail.people.flatMap((member): ActionCrewMember[] =>
    member.role === 'primary' || member.role === 'support'
      ? [{ personId: member.personId, role: member.role, leftAt: member.leftAt }]
      : [],
  );
  // Operator, plant head and board never get the action bar on the ticket page.
  const expected = canWork(actor)
    ? availableActions({ ...detail.ticket, crew }, actor).map((action) =>
        action === 'start' && detail.ticket.handedOver ? 'Pick up' : BUTTON[action],
      )
    : [];
  const literal = LITERAL[`${login}/${name}`];
  if (literal) expect(expected).toEqual(literal);

  await page.goto(`/desk/${id}`);
  await expect(page.getByRole('heading', { name: ref })).toBeVisible();
  await page.waitForLoadState('networkidle');
  const region = page.getByRole('region', { name: 'Actions', exact: true });
  if (expected.length === 0) await expect(region).toHaveCount(0);
  else await expect(region.getByRole('button')).toHaveText(expected);
}

for (const login of LOGINS) {
  test(`E1 shows exactly availableActions on the ticket for ${login}`, async ({
    page,
    context,
  }) => {
    await answerLookupsOnce(context);
    const { user } = await getJson<MeReply>(tokens[login], '/api/v1/auth/me');
    const actor: ActorContext = {
      role: user.role,
      loginId: user.id,
      personId: user.actingPersonId,
      shared: user.shared,
    };
    await signIn(page, login);
    for (const name of Object.keys(seeded) as Name[]) await expectBar(page, actor, login, name);
  });
}

test('E2 shows the quick action on the desk card', async ({ page }) => {
  await signIn(page, 'asha');
  await page.goto('/desk');
  // v3: Open lists the breakdowns nobody has started (Breakdowns) and work requests (Work); a job
  // someone is working on, or has paused, is under Mine.
  const expectQuick = async (name: Name, label: string) => {
    const card = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('link', { name: new RegExp(seeded[name].ref) }) });
    await expect(card.getByRole('button', { name: label, exact: true })).toBeVisible();
  };
  await expectQuick('open', 'Start');
  await page.getByRole('button', { name: /^Work \(\d+\)$/ }).click();
  await expectQuick('handed over', 'Pick up');
  await page.getByRole('button', { name: 'Mine', exact: true }).click();
  await expectQuick('waiting', 'Resume');
  await expectQuick('working', 'Machine running');
});

test('E3 offers Cancel on My complaints exactly when the server would', async ({ page }) => {
  await signIn(page, 'op');
  await expect(page.getByRole('heading', { name: 'My complaints' })).toBeVisible();
  const card = (name: Name) =>
    page
      .getByRole('listitem')
      .filter({ has: page.getByRole('link', { name: new RegExp(seeded[name].ref) }) });
  await expect(card('open').getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
  await expect(card('cancelled')).toBeVisible();
  await expect(card('cancelled').getByRole('button', { name: 'Cancel' })).toHaveCount(0);
  // No other card on the page offers Cancel: the open, unstarted ticket is the only one.
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(1);
});
