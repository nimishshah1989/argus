import { chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import type { PageSpec } from './screens.js';
import type { Sheets } from './xlsx.js';

/**
 * Runs Bhavin's analytics platform (the 11 November single-file HTML) in headless Chromium on his 11 November
 * workbook, through the platform's own "restore from Excel" code, at a frozen date. Nothing leaves the machine:
 * every network request is refused, the charting library is a recorder, and the spreadsheet reader is a shim
 * that hands the platform the sheets we already parsed.
 */

const SHIM = `
  window.__figures = []; window.__name = (fn) => fn;
  window.Chart = class { constructor(canvas, config) { this.config = config; this.options = config.options || {}; this.scales = { x: { min: 0, max: 1 }, y: { min: 0, max: 1 } }; window.__figures.push(this); this.canvas = canvas; } destroy() { const i = window.__figures.indexOf(this); if (i >= 0) window.__figures.splice(i, 1); } update() {} resize() {} };
  const dense = (rows) => rows.map((r) => { const o = []; r.forEach((v, i) => { if (v !== null) o[i] = v; }); return o; });
  window.XLSX = {
    read: () => ({ Sheets: window.__sheets }),
    utils: { sheet_to_json: (sheet) => dense(sheet) },
    SSF: { parse_date_code: (n) => { const d = new Date(Math.round((n - 25569) * 86400000)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }; } },
  };
  window.confirm = () => true;
`;

export async function openPlatform(html: string, sheets: Sheets, asOf: Date): Promise<Page> {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  const context = await browser.newContext({
    viewport: { width: 1500, height: 1000 },
    timezoneId: 'Asia/Kolkata',
    locale: 'en-IN',
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.error(`platform: ${error.message}`));
  await page.route(/^https?:\/\//, (route) => route.abort());
  await page.clock.setFixedTime(asOf);
  await page.addInitScript(`window.__sheets = ${JSON.stringify(sheets)}; ${SHIM}`);
  await page.goto(pathToFileURL(html).href);
  // The shim is installed before the page's own scripts, which replace window.Chart/XLSX only when the CDN loads.
  await page.evaluate(() => {
    const w = window as unknown as { importFromExcel: (file: File) => void };
    w.importFromExcel(new File(['x'], 'cosmos-export.xlsx'));
  });
  await page.waitForFunction('state.breakdowns.length > 1300');
  return page;
}

interface ChartConfig {
  type: string;
  data: { labels?: unknown[]; datasets?: { label?: string; data: unknown[] }[] };
}

export interface Figure {
  title: string;
  kpis: { label: string; value: string; sub: string }[];
  tables: { title: string; header: string[]; rows: string[][] }[];
  text: string;
  charts: {
    id: string;
    type: string;
    labels: unknown[];
    datasets: { label: string; data: unknown[] }[];
  }[];
}

/** What a page shows once opened: its tiles, its tables and the data behind its charts. */
export async function readPage(page: Page, spec: PageSpec): Promise<Figure> {
  const name = spec.page;
  await page.evaluate(
    ([n, code]) => {
      if (code) new Function(code)();
      (window as unknown as { nav: (p: string) => void }).nav(n as string);
    },
    [name, spec.before ?? ''],
  );
  if (spec.wait) await page.waitForFunction(spec.wait);
  return page.evaluate((n) => {
    const root = document.getElementById(`page-${n}`) as HTMLElement;
    const text = (el: Element | null | undefined): string =>
      (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const own = (el: Element | null | undefined): string =>
      [...(el?.childNodes ?? [])]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent)
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
    const titleOf = (el: Element): string => {
      const head = el.closest('.card, .tbl-wrap, section')?.querySelector('h3, h2, h4');
      return own(head) || text(head);
    };
    const figures = (window as unknown as { __figures: { config: ChartConfig; canvas: Element }[] })
      .__figures;
    return {
      title: text(document.getElementById('pageTitle')),
      kpis: [...root.querySelectorAll('.kpi')].map((el) => ({
        label: text(el.querySelector('.lbl')),
        value: text(el.querySelector('.val')),
        sub: text(el.querySelector('.sub')),
      })),
      tables: [...root.querySelectorAll('table')].map((table) => ({
        title: titleOf(table),
        header: [...table.querySelectorAll('thead th')].map((th) => text(th)),
        rows: [...table.querySelectorAll('tbody tr')].map((tr) =>
          [...tr.children].map((td) => text(td)),
        ),
      })),
      text: text(root).slice(0, 40000),
      charts: figures
        .filter((f) => root.contains(f.canvas))
        .map((f) => ({
          id: (f.canvas as HTMLElement).id,
          type: String(f.config.type),
          labels: f.config.data.labels ?? [],
          datasets: (f.config.data.datasets ?? []).map((d) => ({
            label: String(d.label ?? ''),
            data: d.data,
          })),
        })),
    };
  }, name);
}
