import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const DIRECTIONS = ['instrument', 'control-room', 'ledger'];
const ACCENT = ['#0f766e', '#0e7490', '#3538cd'];
const stage = (page: Page) => page.getByTestId('directions-stage');

async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`/gallery?view=directions${query}`);
  await expect(stage(page)).toBeVisible();
}

const inline = (page: Page, name: string) =>
  page.evaluate((n) => document.documentElement.style.getPropertyValue(n), name);

/** What one attribute reads on the first element that carries it, in each direction in turn. */
async function acrossDirections(page: Page, name: string): Promise<(string | null)[]> {
  const seen: (string | null)[] = [];
  for (const v of [1, 2, 3]) {
    await open(page, `&v=${v}`);
    seen.push(await page.locator(`[data-${name}]`).first().getAttribute(`data-${name}`));
  }
  return seen;
}

/** The same tests at a phone's width and at a laptop's. */
function atBothWidths(title: string, define: () => void): void {
  for (const width of [360, 1440]) {
    test.describe(`${title} at ${width} px`, () => {
      test.use({ viewport: { width, height: 900 } });
      define();
    });
  }
}

atBothWidths('the picker', () => {
  test('keys 1, 2 and 3 flip the direction and the address keeps ?v=', async ({ page }) => {
    await open(page);
    await expect(stage(page)).toHaveAttribute('data-direction', 'instrument');
    for (const [i, id] of DIRECTIONS.entries()) {
      await page.keyboard.press(String(i + 1));
      await expect(stage(page)).toHaveAttribute('data-direction', id);
      await expect(page).toHaveURL(new RegExp(`[?&]v=${i + 1}(&|$)`));
      expect(await inline(page, '--color-accent')).toBe(ACCENT[i]);
    }
    await page.reload();
    await expect(stage(page)).toHaveAttribute('data-direction', 'ledger');
  });

  test('the three buttons flip it too, and one is current', async ({ page }) => {
    await open(page);
    const nav = page.getByRole('navigation', { name: 'Design directions' });
    await nav.getByRole('button', { name: 'Control Room' }).click();
    await expect(stage(page)).toHaveAttribute('data-direction', 'control-room');
    await expect(nav.locator('[aria-current="true"]')).toHaveText('Control Room');
    await expect(page).toHaveURL(/[?&]v=2(&|$)/);
  });

  test('each direction, light and dark, has no sideways scroll and no axe violation', async ({
    page,
  }) => {
    for (const theme of ['light', 'dark']) {
      for (const [i, id] of DIRECTIONS.entries()) {
        await open(page, `&v=${i + 1}&theme=${theme}`);
        await expect(stage(page)).toHaveAttribute('data-direction', id);
        await expect(page.getByTestId('chart')).toHaveAttribute('data-chart-state', 'ready');
        const room = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(room, `${id} ${theme} scrolls sideways`).toBeLessThanOrEqual(0);
        const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
        expect(violations, `${id} ${theme}`).toEqual([]);
      }
    }
  });

  test('leaving the view removes every inline property it set on the page', async ({ page }) => {
    await open(page, '&v=3&theme=dark');
    expect(await inline(page, '--color-accent')).not.toBe('');
    await page.getByRole('link', { name: 'Back to the gallery' }).click();
    await expect(page.getByTestId('gallery-root')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.style.length)).toBe(0);
  });
});

atBothWidths('the Elements screen', () => {
  test('chart variants: key place, frame and height differ, and series 3 to 8 and both ramps show', async ({
    page,
  }) => {
    expect(await acrossDirections(page, 'legend')).toEqual(['above', 'inline', 'below']);
    expect(await acrossDirections(page, 'chart-frame')).toEqual(['card', 'panel', 'rules']);
    for (const [v, height] of [192, 160, 224].entries()) {
      await open(page, `&v=${v + 1}`);
      const chart = page.getByTestId('chart');
      await expect(chart).toHaveAttribute('data-chart-state', 'ready');
      expect((await chart.boundingBox())?.height).toBe(height);
      await expect(page.locator('[data-series]')).toHaveCount(8);
      for (const ramp of ['seq', 'div'])
        await expect(page.locator(`[data-ramp="${ramp}"] [data-step]`)).toHaveCount(5);
    }
  });

  test('variants differ: tile shape, delta form and the Indian sample', async ({ page }) => {
    expect(await acrossDirections(page, 'tile')).toEqual(['card', 'edge', 'ruled']);
    expect(await acrossDirections(page, 'delta')).toEqual(['chip', 'inline', 'words']);
    for (const v of [1, 2, 3]) {
      await open(page, `&v=${v}`);
      await expect(page.locator('[data-sample]')).toHaveText('10,00,000');
    }
  });
});

atBothWidths('the picker polish', () => {
  test('a fractional ?v= falls back to the first direction instead of crashing', async ({
    page,
  }) => {
    await open(page, '&v=1.5');
    await expect(stage(page)).toHaveAttribute('data-direction', 'instrument');
  });

  test('every chart caption is the first or last child of its figure', async ({ page }) => {
    await open(page);
    await expect(page.getByTestId('chart')).toHaveAttribute('data-chart-state', 'ready');
    const stray = await page.locator('figure').evaluateAll(
      (figures) =>
        figures.filter((f) => {
          const caption = f.querySelector(':scope > figcaption');
          return !caption || (caption !== f.firstElementChild && caption !== f.lastElementChild);
        }).length,
    );
    expect(stray).toBe(0);
  });

  test('the pill stays inside the screen in Gujarati and its highlight follows the words', async ({
    page,
  }) => {
    await open(page, '&lang=gu');
    const pill = page.locator('.proto-picker');
    await expect(pill).toContainText('ક ખ ગ');
    const width = page.viewportSize()!.width;
    const box = (await pill.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const item = document.querySelector<HTMLElement>('.proto-picker-item[data-active]')!;
          const mark = document.querySelector<HTMLElement>('.proto-picker-highlight')!;
          return Math.abs(mark.offsetWidth - item.offsetWidth);
        }),
      )
      .toBeLessThan(1);
  });

  test('headings wear the direction’s display type and tracking, not only the figures', async ({
    page,
  }) => {
    const headings = () => [
      page.locator('h1'),
      stage(page).getByRole('heading', { level: 2 }),
      stage(page).locator('h3').first(),
    ];
    const style = (h: Locator, name: 'fontFamily' | 'letterSpacing') =>
      h.evaluate((e, n) => getComputedStyle(e)[n], name);
    await open(page, '&v=3');
    await expect(stage(page).locator('h3').first()).toBeVisible();
    for (const h of headings()) expect(await style(h, 'fontFamily')).toContain('Georgia');
    await open(page, '&v=2');
    await expect(stage(page).locator('h3').first()).toBeVisible();
    for (const h of headings()) expect(await style(h, 'letterSpacing')).not.toBe('normal');
  });
});

/** Every figure the screens print, in the words of the answer key (the plant's 11 November snapshot). */
const PRINTS: Record<string, RegExp[]> = {
  today: [/1,279/, /3,060\.1 h/, /99\.32 %/, /4\.11/, /759\.3 h/, /53 of 125/],
  machine: [/27/, /151\.32 h/, /5\.6 h/, /216\.6 h/],
  breakdowns: [/1,279/, /3,060\.1 h/, /0\.54 %/, /24\.29 h/],
};

/** The screen's text with no-break spaces made plain, so a figure and its unit read as one run. */
async function printed(page: Page, screen: string, selector: string): Promise<string> {
  const texts = await page.locator(`[data-screen="${screen}"] ${selector}`).allInnerTexts();
  return texts.join(' | ').replaceAll(String.fromCharCode(160), ' ');
}

async function arrive(page: Page, screen: string, v: number, theme: string): Promise<void> {
  await open(page, `&v=${v}&theme=${theme}&s=${screen}`);
  await expect(page.locator(`[data-screen="${screen}"]`)).toBeVisible();
  await expect(page.locator('[data-chart-state]:not([data-chart-state="ready"])')).toHaveCount(0);
}

/** What holds on every screen: nothing sideways, axe clean, icon and word on every status, at most 50 rows a list. */
async function holdsEverywhere(page: Page, label: string): Promise<void> {
  const room = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(room, `${label} scrolls sideways`).toBeLessThanOrEqual(0);
  const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(violations, label).toEqual([]);
  const bare = await page
    .locator('[data-status]')
    .evaluateAll(
      (chips) => chips.filter((c) => !c.querySelector('svg') || !c.textContent?.trim()).length,
    );
  expect(bare, `${label}: a status without its icon or word`).toBe(0);
  const longest = await page.evaluate(() =>
    Math.max(
      0,
      ...[...document.querySelectorAll('tbody')].map((b) => b.rows.length),
      ...[...document.querySelectorAll('ol, ul')].map((l) => l.children.length),
    ),
  );
  expect(longest, `${label}: a list paints more than 50 rows`).toBeLessThanOrEqual(50);
}

/** The Running chip wears the direction's neutral ink and not its good one. */
async function runningIsGrey(page: Page): Promise<void> {
  const chip = page.locator('[data-status="ticket.running"]').first();
  await expect(chip).toHaveAttribute('data-tone', 'neutral');
  const colours = await chip.evaluate((el) => {
    const read = (value: string) => {
      const probe = document.createElement('span');
      probe.style.color = value;
      document.body.append(probe);
      const colour = getComputedStyle(probe).color;
      probe.remove();
      return colour;
    };
    return {
      chip: getComputedStyle(el).color,
      neutral: read('var(--color-muted-ink)'),
      good: read('var(--color-ok-ink)'),
    };
  });
  expect(colours.chip).toBe(colours.neutral);
  expect(colours.chip).not.toBe(colours.good);
}

atBothWidths('the three screens', () => {
  for (const screen of ['today', 'machine', 'breakdowns']) {
    test(`${screen}: every direction and theme prints the snapshot, status and row rules hold`, async ({
      page,
    }) => {
      for (const theme of ['light', 'dark']) {
        for (const [i, id] of DIRECTIONS.entries()) {
          await arrive(page, screen, i + 1, theme);
          const label = `${screen} ${id} ${theme}`;
          const tiles = await printed(page, screen, '[data-tile]');
          for (const figure of PRINTS[screen]!) expect(tiles, label).toMatch(figure);
          await holdsEverywhere(page, label);
          if (screen !== 'breakdowns') await runningIsGrey(page);
        }
      }
    });
  }

  test('today ranks the costliest problems and shows each tone with icon and word', async ({
    page,
  }) => {
    await arrive(page, 'today', 1, 'light');
    expect(await printed(page, 'today', '[data-problem]:first-child')).toMatch(
      /Axis motor.*485 h.*15\.85 %/s,
    );
    await expect(page.locator('[data-problem]')).toHaveCount(3);
    await expect(page.locator('[data-tone-strip] [data-status]')).toHaveCount(5);
    await expect(page.getByText(/as of 11 Nov 2026/i).first()).toBeVisible();
  });

  test('machine lists ten breakdowns and breakdowns lists fifty with a Pareto and a heat grid', async ({
    page,
  }) => {
    await arrive(page, 'machine', 2, 'dark');
    await expect(page.locator('[data-machine-header]')).toContainText('VC-28');
    await expect(page.locator('[data-screen="machine"] [data-log] tbody tr')).toHaveCount(10);
    await arrive(page, 'breakdowns', 2, 'dark');
    await expect(page.locator('[data-screen="breakdowns"] [data-log] tbody tr')).toHaveCount(50);
    await expect(page.locator('[data-heat] tbody td')).toHaveCount(54);
    await expect(page.getByTestId('chart')).toHaveCount(3);
  });
});

/** The floor step's three landmarks in page order, each with the third of the frame its top edge falls in. */
const floorLayout = (page: Page) =>
  page.evaluate(() => {
    const frame = document.querySelector('[data-floor-frame]')!.getBoundingClientRect();
    return [...document.querySelectorAll('[data-part]')].map((el) => ({
      part: el.getAttribute('data-part'),
      third: Math.floor(((el.getBoundingClientRect().top - frame.top) / frame.height) * 3),
    }));
  });

/** Every box of the floor step that leaves its frame, or has text wider or taller than itself, and every placeholder that does not fit. */
const clipped = (page: Page) =>
  page.evaluate(() => {
    const frame = document.querySelector('[data-floor-frame]')!.getBoundingClientRect();
    const bad: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('[data-floor-frame] *')) {
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const name = `${el.tagName} ${el.textContent?.trim().slice(0, 24) ?? ''}`;
      if (box.left < frame.left - 0.5 || box.right > frame.right + 0.5)
        bad.push(`${name}: outside`);
      const block = style.display !== 'inline';
      if (block && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1))
        bad.push(`${name}: clipped`);
      if (el instanceof HTMLInputElement) {
        const ctx = document.createElement('canvas').getContext('2d')!;
        ctx.font = style.font;
        const room =
          el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        if (ctx.measureText(el.placeholder).width > room) bad.push(`${name}: placeholder`);
      }
    }
    return bad;
  });

atBothWidths('the floor step', () => {
  test('keeps its words and order in every direction and theme, and says Running is still green', async ({
    page,
  }) => {
    for (const theme of ['light', 'dark']) {
      for (const [i, id] of DIRECTIONS.entries()) {
        await arrive(page, 'floor', i + 1, theme);
        const label = `floor ${id} ${theme}`;
        const screen = page.locator('[data-screen="floor"]');
        for (const words of [
          'Report a problem',
          'Which machine?',
          'Find a machine',
          'Other work (not a machine)',
          'Vertical Machining Center',
          '52 machines',
          'My complaints',
        ])
          await expect(screen.getByText(words).first(), label).toBeVisible();
        await expect(screen, label).toContainText(
          'The real floor step still shows Running in green until ticket 82',
        );
        expect(
          (await floorLayout(page)).map((p) => p.part),
          label,
        ).toEqual(['search', 'other', 'groups']);
        await holdsEverywhere(page, label);
        // The real browse step shows no status chip, so the floor screen draws none (neither grey nor green Running).
        await expect(screen.locator('[data-status]'), label).toHaveCount(0);
      }
    }
  });
});

test.describe('the floor step in Gujarati at 360 px', () => {
  test.use({ viewport: { width: 360, height: 900 } });

  test('no label clips, and search, Other work and the group tiles keep their place in all three', async ({
    page,
  }) => {
    for (const theme of ['light', 'dark']) {
      const layouts: unknown[] = [];
      for (const [i, id] of DIRECTIONS.entries()) {
        await open(page, `&v=${i + 1}&theme=${theme}&s=floor&lang=gu`);
        const label = `floor gu ${id} ${theme}`;
        const screen = page.locator('[data-screen="floor"]');
        await expect(screen, label).toContainText('કયું મશીન?');
        await expect(screen, label).toContainText('બીજું કામ (મશીન નહીં)');
        await expect(screen, label).toContainText('“ચાલુ”');
        expect(await clipped(page), label).toEqual([]);
        await holdsEverywhere(page, label);
        layouts.push(await floorLayout(page));
      }
      expect(layouts[1], `control room ${theme}`).toEqual(layouts[0]);
      expect(layouts[2], `ledger ${theme}`).toEqual(layouts[0]);
    }
  });
});
