import { expect, test, type Page } from '@playwright/test';
import { CONFIG } from './desk-mock.js';
import { mockPlant } from './plant-mock.js';

/**
 * The wall TV fits its screen (bug, Nimish on staging 26 Nov): a TV cannot be scrolled, so at every size nothing is
 * clipped or overlaps, each column shows its oldest stops with code and age, and the rest are counted. No database:
 * the API is answered in the browser. `BOARD_SHOTS=<folder>` also saves a screenshot of every case.
 */
const SIZES = [
  [1000, 545],
  [1280, 720],
  [1366, 768],
  [1920, 1080],
  [3840, 2160],
] as const;
const COUNTS = [0, 4, 25] as const;
const MACHINES = 192;
const ROWS = 3;
/** Which column the n-th stop sits in: three of five are not started. */
const STATUSES = ['open', 'working', 'waiting', 'open', 'open'] as const;

/** A plant of `MACHINES` machines with `stopped` of them stopped; the first has waited longest (days). */
async function mockStops(page: Page, stopped: number): Promise<void> {
  await mockPlant(page);
  const now = Date.now();
  const machines = Array.from({ length: MACHINES }, (_, i) => ({
    id: `m${i}`,
    code: `CNC-${String(i + 1).padStart(3, '0')}`,
    category: null,
    cell: 'Cell 12',
    segment_id: 's1',
    group_id: null,
    criticality: 'B',
  }));
  const open = machines.slice(0, stopped).map((machine, i) => {
    // The next to last has the widest age the board prints, "23 h 59 min".
    const at = new Date(now - ((stopped - i) * 713 + 13) * 60_000).toISOString();
    const status = STATUSES[i % STATUSES.length];
    return {
      id: `t${i}`,
      ref: `BD-${i}`,
      kind: 'stopped',
      status,
      machineId: machine.id,
      machineSnapshot: { code: machine.code },
      machineRunningAt: null,
      machineStoppedAt: at,
      reportedAt: at,
      figures: null,
      waitReason: status === 'waiting' ? 'spare' : null,
    };
  });
  const segment = { id: 's1', code: 'cnc', name: 'Turning', sort: 1, show_on_board: true };
  const spare = { id: 'w1', list: 'wait_reason', code: 'spare', label: 'Spare part (vendor)' };
  await page.route('**/api/v1/config', (route) =>
    route.fulfill({
      json: {
        ...CONFIG,
        segments: [{ ...segment, group_by: 'group' }],
        lists: { wait_reason: [spare] },
        machines,
      },
    }),
  );
  await page.route('**/api/v1/state', (route) =>
    route.fulfill({ json: { open, needReport: [], now: new Date(now).toISOString() } }),
  );
}

async function openTv(page: Page, [width, height]: readonly [number, number]): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto('/desk/board?kiosk=1');
  await expect(page.getByTestId('age-overDay')).toBeVisible();
  // The tiles come from `/board/today`, which may answer after the board is drawn.
  await expect(page.getByText(/(average of|માંથી|સરેરાશ)/).first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

/** Everything on the TV that is cut off, pushed off the screen, overlapping or wrapped where it must not be. */
function layoutProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const name = (el: Element) =>
      `${el.tagName.toLowerCase()}.${el.getAttribute('class') ?? ''} "${el.textContent?.slice(0, 40)}"`;
    const screen = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    const inside = (el: Element, box: typeof screen) => {
      const r = el.getBoundingClientRect();
      return (
        r.left >= box.left - 0.5 &&
        r.top >= box.top - 0.5 &&
        r.right <= box.right + 0.5 &&
        r.bottom <= box.bottom + 0.5
      );
    };
    const clipped = (el: Element) =>
      el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;
    const main = document.querySelector('main')!;

    /** The page, the frame and the blocks of the frame: no scroll, on screen, one under the other. */
    const frame = () => {
      const found: string[] = [];
      if (clipped(document.documentElement)) found.push('the document scrolls');
      if (main.scrollHeight > main.clientHeight) found.push('the frame is too tall');
      const blocks = Array.from(main.children);
      blocks.forEach((block, i) => {
        if (!inside(block, screen)) found.push(`off screen: ${name(block)}`);
        const above = blocks[i - 1]?.getBoundingClientRect();
        if (above && block.getBoundingClientRect().top < above.bottom - 0.5)
          found.push(`overlaps the block above: ${name(block)}`);
      });
      return found;
    };
    /** Each card holds everything it has, and so does the screen. */
    const cards = () =>
      Array.from(main.querySelectorAll('.board-card')).flatMap((card) => [
        ...(clipped(card) ? [`card clipped: ${name(card)}`] : []),
        ...Array.from(card.querySelectorAll('li, p, h2, span, svg'))
          .filter((el) => !inside(el, card.getBoundingClientRect()) || !inside(el, screen))
          .map((el) => `outside its card: ${name(el)}`),
      ]);
    /** No word is cut sideways; the clock and the date line stay on one line; the stopped count stays beside running. */
    const lines = () => {
      const found = Array.from(main.querySelectorAll('p, h2, span'))
        .filter((el) => el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1)
        .map((el) => `cut sideways: ${name(el)}`);
      for (const el of main.querySelectorAll('.board-clock, .board-day')) {
        const line = parseFloat(getComputedStyle(el).lineHeight);
        if (el.getBoundingClientRect().height > line * 1.5) found.push(`wraps: ${name(el)}`);
      }
      const [running, stopped] = Array.from(main.querySelector('section')!.children).map((el) =>
        el.getBoundingClientRect(),
      );
      if (stopped!.left < running!.right) found.push('the stopped count dropped under running');
      return found;
    };
    return [...frame(), ...cards(), ...lines()];
  });
}

/** Minutes behind an age as the board prints it ("2 d 9 h", "5 h 10 min", "12 min"). */
function minutes(age: string): number {
  const part = (unit: string) => Number(new RegExp(`(\\d+) ${unit}\\b`).exec(age)?.[1] ?? 0);
  return part('d') * 1440 + part('h') * 60 + part('min');
}

async function shot(page: Page, file: string): Promise<void> {
  if (process.env.BOARD_SHOTS)
    await page.screenshot({ path: `${process.env.BOARD_SHOTS}/${file}.png` });
}

for (const size of SIZES) {
  for (const stopped of COUNTS) {
    test(`TV at ${size.join('x')} with ${stopped} stopped: everything fits`, async ({ page }) => {
      await mockStops(page, stopped);
      await openTv(page, size);
      await shot(page, `${size.join('x')}-${stopped}`);
      expect(await layoutProblems(page)).toEqual([]);

      const columns = ['Nobody has started', 'Being repaired', 'Paused and waiting'];
      for (const [at, title] of columns.entries()) {
        const column = page.getByRole('region', { name: title, exact: true });
        const total = Array.from({ length: stopped }, (_, i) => i % STATUSES.length).filter(
          (i) => ['open', 'working', 'waiting'].indexOf(STATUSES[i]!) === at,
        ).length;
        const rows = column.getByTestId('tile');
        await expect(rows).toHaveCount(Math.min(total, ROWS));
        const ages = (await column.locator('.board-age').allInnerTexts()).map(minutes);
        expect(ages).toEqual([...ages].sort((a, b) => b - a));
        for (const row of await rows.all()) await expect(row).toContainText(/CNC-\d{3}/);
        if (total > ROWS) await expect(column).toContainText(`+${total - ROWS} more`);
        else await expect(column).not.toContainText('more');
      }
    });
  }

  // The tallest case: Gujarati lines, the longest verdict and the offline line under everything.
  test(`TV at ${size.join('x')} in Gujarati and offline: everything fits`, async ({
    page,
    context,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('uptimo.gujarati', 'on');
      localStorage.setItem('uptimo.language', 'gu');
    });
    await mockStops(page, 25);
    await openTv(page, size);
    await context.setOffline(true);
    await expect(page.getByRole('status')).toBeVisible();
    await shot(page, `${size.join('x')}-gu-offline`);
    expect(await layoutProblems(page)).toEqual([]);
    await expect(page.getByTestId('tile')).toHaveCount(ROWS * 3);
  });
}
