import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { MACHINES, apiLogin, raiseTicketViaApi, signIn } from '../e2e/fixtures.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const EVIDENCE = resolve(ROOT, 'docs/design/evidence/d01');
const MANIFEST = resolve(EVIDENCE, 'baseline-manifest.json');
const CANDIDATE = resolve(ROOT, 'tmp/d01-candidate.json');
const CAPTURE = process.env.D01_CAPTURE === '1';
const REF_PATTERN = '^BD-\\d{4,}$';
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const VIEWPORT_PAIRS = [
  { width: 360, height: 800 },
  { width: 1440, height: 1000 },
] as const;

test.describe.configure({ mode: 'serial' });

interface CaptureInput {
  page: Page;
  id: string;
  route: string;
  role: 'anonymous' | 'technician';
  state: string;
  width: 360 | 1440 | 1920;
  height: 800 | 1000 | 1080;
  machineCode?: 'VC-5';
}

interface BaselineEntry {
  id: string;
  route: string;
  role: 'anonymous' | 'technician';
  state: string;
  viewport: { width: number; height: number };
  image: { width: number; height: number };
  file: string;
  machineCode: string | null;
  refPattern: string | null;
}

interface BaselineManifest {
  schemaVersion: 1;
  sourceCommit: string;
  visualApproval: false;
  fakeData: 'Playwright E2E fixtures only';
  captures: BaselineEntry[];
}

interface PairInput extends Omit<CaptureInput, 'id' | 'width' | 'height'> {
  id: string;
}

function pngDimensions(png: Buffer): { width: number; height: number } {
  if (png.length < 24 || !png.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Not a PNG with a complete IHDR');
  }
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

async function captureRoute(input: CaptureInput): Promise<BaselineEntry> {
  await input.page.setViewportSize({ width: input.width, height: input.height });
  await input.page.evaluate(async () => {
    await document.fonts.ready;
  });
  await input.page.evaluate(
    () =>
      new Promise<void>((settled) => {
        requestAnimationFrame(() => requestAnimationFrame(() => settled()));
      }),
  );
  const file = `docs/design/evidence/d01/${input.id}.png`;
  if (CAPTURE) {
    await mkdir(EVIDENCE, { recursive: true });
    await input.page.screenshot({
      path: resolve(ROOT, file),
      fullPage: true,
      animations: 'disabled',
    });
  }
  const image = pngDimensions(await readFile(resolve(ROOT, file)));
  return {
    id: input.id,
    route: input.route,
    role: input.role,
    state: input.state,
    viewport: { width: input.width, height: input.height },
    image,
    file,
    machineCode: input.machineCode ?? null,
    refPattern: input.machineCode ? REF_PATTERN : null,
  };
}

async function capturePair(input: PairInput): Promise<BaselineEntry[]> {
  const entries: BaselineEntry[] = [];
  for (const viewport of VIEWPORT_PAIRS) {
    entries.push(
      await captureRoute({
        ...input,
        id: `${input.id}-${viewport.width}`,
        width: viewport.width,
        height: viewport.height,
      }),
    );
  }
  return entries;
}

function expectedEntry(input: Omit<CaptureInput, 'page'>): Omit<BaselineEntry, 'image'> {
  return {
    id: input.id,
    route: input.route,
    role: input.role,
    state: input.state,
    viewport: { width: input.width, height: input.height },
    file: `docs/design/evidence/d01/${input.id}.png`,
    machineCode: input.machineCode ?? null,
    refPattern: input.machineCode ? REF_PATTERN : null,
  };
}

const EXPECTED = [
  expectedEntry({
    id: 'login-360',
    route: '/login',
    role: 'anonymous',
    state: 'default',
    width: 360,
    height: 800,
  }),
  expectedEntry({
    id: 'login-1440',
    route: '/login',
    role: 'anonymous',
    state: 'default',
    width: 1440,
    height: 1000,
  }),
  expectedEntry({
    id: 'floor-360',
    route: '/floor',
    role: 'technician',
    state: 'report',
    width: 360,
    height: 800,
  }),
  expectedEntry({
    id: 'floor-1440',
    route: '/floor',
    role: 'technician',
    state: 'report',
    width: 1440,
    height: 1000,
  }),
  expectedEntry({
    id: 'desk-open-360',
    route: '/desk',
    role: 'technician',
    state: 'open',
    width: 360,
    height: 800,
    machineCode: 'VC-5',
  }),
  expectedEntry({
    id: 'desk-open-1440',
    route: '/desk',
    role: 'technician',
    state: 'open',
    width: 1440,
    height: 1000,
    machineCode: 'VC-5',
  }),
  expectedEntry({
    id: 'ticket-working-360',
    route: '/desk/{ticket.id}',
    role: 'technician',
    state: 'working',
    width: 360,
    height: 800,
    machineCode: 'VC-5',
  }),
  expectedEntry({
    id: 'ticket-working-1440',
    route: '/desk/{ticket.id}',
    role: 'technician',
    state: 'working',
    width: 1440,
    height: 1000,
    machineCode: 'VC-5',
  }),
  expectedEntry({
    id: 'board-kiosk-1920',
    route: '/desk/board?kiosk=1',
    role: 'technician',
    state: 'kiosk',
    width: 1920,
    height: 1080,
    machineCode: 'VC-5',
  }),
];

type Machine = (typeof MACHINES)[number];
type RaisedTicket = Awaited<ReturnType<typeof raiseTicketViaApi>>;

async function captureLoginAndFloor(page: Page): Promise<BaselineEntry[]> {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  const entries = await capturePair({
    page,
    id: 'login',
    route: '/login',
    role: 'anonymous',
    state: 'default',
  });
  await signIn(page, 'asha');
  await expect(page.getByRole('heading', { name: 'Report a problem' })).toBeVisible();
  entries.push(
    ...(await capturePair({
      page,
      id: 'floor',
      route: '/floor',
      role: 'technician',
      state: 'report',
    })),
  );
  return entries;
}

async function captureOpen(
  page: Page,
  machine: Machine,
  ticket: RaisedTicket,
): Promise<BaselineEntry[]> {
  await page.goto('/desk');
  const refLink = page.getByRole('link', { name: new RegExp(ticket.ref) });
  await expect(refLink).toBeVisible();
  await expect(refLink).toContainText(machine.code);
  await expect(refLink).toContainText('Open');
  return capturePair({
    page,
    id: 'desk-open',
    route: '/desk',
    role: 'technician',
    state: 'open',
    machineCode: 'VC-5',
  });
}

async function captureWorking(
  page: Page,
  machine: Machine,
  ticket: RaisedTicket,
): Promise<BaselineEntry[]> {
  await page.goto(`/desk/${ticket.id}`);
  await expect(page.getByRole('heading', { name: ticket.ref })).toBeVisible();
  await expect(page.getByText(machine.code, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('header').getByText('In progress', { exact: true })).toBeVisible();
  return capturePair({
    page,
    id: 'ticket-working',
    route: '/desk/{ticket.id}',
    role: 'technician',
    state: 'working',
    machineCode: 'VC-5',
  });
}

async function captureKiosk(
  page: Page,
  machine: Machine,
  ticket: RaisedTicket,
): Promise<BaselineEntry> {
  await page.goto('/desk/board?kiosk=1');
  const tile = page.getByTestId('tile').filter({ hasText: machine.code });
  await expect(tile).toHaveCount(1);
  await expect(tile).toContainText(ticket.ref);
  await expect(tile).toContainText('In progress');
  await expect(page.getByRole('link')).toHaveCount(0);
  return captureRoute({
    page,
    id: 'board-kiosk-1920',
    route: '/desk/board?kiosk=1',
    role: 'technician',
    state: 'kiosk',
    width: 1920,
    height: 1080,
    machineCode: 'VC-5',
  });
}

test('captures current-truth routes in one ordered session', async ({ page }) => {
  const entries = await captureLoginAndFloor(page);
  const machine = MACHINES[4];
  if (!machine) throw new Error('VC-5 fixture is missing');
  expect(machine.code).toBe('VC-5');
  const token = await apiLogin('asha');
  const ticket = await raiseTicketViaApi(token, machine.id, `Spindle alarm on ${machine.code}`);
  entries.push(...(await captureOpen(page, machine, ticket)));
  entries.push(...(await captureWorking(page, machine, ticket)));
  entries.push(await captureKiosk(page, machine, ticket));
  expect(entries).toHaveLength(9);
  if (CAPTURE) {
    await mkdir(resolve(ROOT, 'tmp'), { recursive: true });
    await writeFile(CANDIDATE, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
  }
});

test('verifies all nine baseline images and manifest entries', async () => {
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8')) as BaselineManifest;
  expect(manifest.schemaVersion).toBe(1);
  expect(manifest.sourceCommit).toMatch(/^[0-9a-f]{40}$/);
  expect(manifest.visualApproval).toBe(false);
  expect(manifest.fakeData).toBe('Playwright E2E fixtures only');
  expect(manifest.captures).toHaveLength(9);

  for (const [index, expected] of EXPECTED.entries()) {
    const actual = manifest.captures[index];
    expect(actual).toBeDefined();
    if (!actual) throw new Error(`Missing manifest entry ${expected.id}`);
    const { image, ...metadata } = actual;
    expect(metadata).toEqual(expected);
    const png = await readFile(resolve(ROOT, expected.file));
    expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
    expect(image).toEqual(pngDimensions(png));
    expect(image.width).toBe(expected.viewport.width);
    expect(image.height).toBeGreaterThanOrEqual(expected.viewport.height);
  }
});
