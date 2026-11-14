import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import QRCode from 'qrcode';
import { createRenderGate } from './render-gate.js';

const exec = promisify(execFile);

const MAX_QR_CHARS = 650;
// ref.js grows the text down in this order until the ASCII-escaped JSON fits in a scan-able QR.
const SHRINK_LENGTHS = [400, 300, 220, 160, 120, 80] as const;

/** The fields the platform's v1 QR importer understands (ref.js `bdQR`, keys in this order). */
export interface QrReportFields {
  machineId: string;
  date: string;
  shiftCode: string;
  problem: string;
  observedBy: string | null;
  correctiveAction: string | null;
  doneBy: string;
  supportedBy: string;
  downtimeMin: number;
  maintCode: string | null;
  breakdownCategory: string | null;
  spareUsed: string | null;
  kind: string;
  ref: string;
  responseMin: number | null;
  repairMin: number | null;
}

export type QrPayload = Record<string, string | number | null>;

export function buildQrPayload(fields: QrReportFields): QrPayload {
  return {
    v: 1,
    mid: fields.machineId,
    d: fields.date,
    sh: fields.shiftCode,
    pr: fields.problem,
    ob: fields.observedBy ?? '',
    ca: fields.correctiveAction ?? '',
    db: fields.doneBy,
    sb: fields.supportedBy,
    dm: fields.downtimeMin,
    mc: fields.maintCode ?? '',
    bc: fields.breakdownCategory ?? '',
    sp: fields.spareUsed ?? '',
    ty: fields.kind,
    tk: fields.ref,
    rs: fields.responseMin,
    rp: fields.repairMin,
  };
}

/** JSON with every non-ASCII character escaped, exactly as the platform's importer emits it. */
function asciiJson(value: unknown): string {
  return JSON.stringify(value).replace(
    /[\u007f-\uffff]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

function shortened(payload: QrPayload, length: number): QrPayload {
  return {
    ...payload,
    pr: String(payload.pr ?? '').slice(0, length),
    ca: String(payload.ca ?? '').slice(0, length),
    sp: String(payload.sp ?? '').slice(0, Math.min(length, 120)),
  };
}

/** The QR text: v1 keys, ASCII-escaped, with the long free-text fields shrunk until ≤650 chars. */
export function qrText(payload: QrPayload): string {
  let text = payload;
  for (const length of SHRINK_LENGTHS) {
    if (asciiJson(text).length <= MAX_QR_CHARS) break;
    text = shortened(payload, length);
  }
  return asciiJson(text);
}

export async function qrSvg(text: string): Promise<string> {
  for (const errorCorrectionLevel of ['M', 'L'] as const) {
    try {
      return await QRCode.toString(text, {
        type: 'svg',
        errorCorrectionLevel,
        margin: 1,
        width: 240,
      });
    } catch {
      // Too much data for this correction level; try the lower one like ref.js does.
    }
  }
  throw new Error('Could not encode the QR payload');
}

const EXECUTABLE_NAMES = new Set([
  'chrome-headless-shell',
  'chrome',
  'Chromium',
  'Google Chrome for Testing',
]);

function findExecutable(dir: string, depth: number): string | null {
  if (depth > 7) return null;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isFile() && EXECUTABLE_NAMES.has(entry.name)) return path;
    if (entry.isDirectory()) {
      const found = findExecutable(path, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function findInRoot(root: string): string | null {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return null;
  }
  const ordered = [
    ...entries.filter((name) => name.startsWith('chromium_headless_shell-')),
    ...entries.filter((name) => name.startsWith('chromium-')),
  ];
  for (const name of ordered) {
    const found = findExecutable(join(root, name), 0);
    if (found) return found;
  }
  return null;
}

/** Where the Playwright E2E harness and the deployment put Chromium. */
function browserRoots(): string[] {
  const roots: string[] = [];
  const fromEnv = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (fromEnv && fromEnv !== '0') roots.push(fromEnv);
  // Playwright's own default cache, where `playwright install chromium` puts the browser
  // (CI installs it there; macOS dev machines and Linux runners use different dirs).
  roots.push(join(homedir(), '.cache', 'ms-playwright'));
  roots.push(join(homedir(), 'Library', 'Caches', 'ms-playwright'));
  let dir = process.cwd();
  for (let level = 0; level < 4; level += 1) {
    roots.push(join(dir, '.tools', 'ms-playwright'));
    dir = dirname(dir);
  }
  return roots;
}

let cachedChromium: string | null = null;

export function resolveChromium(override?: string): string {
  if (override) return override;
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  if (cachedChromium) return cachedChromium;
  for (const root of browserRoots()) {
    const found = findInRoot(root);
    if (found) {
      cachedChromium = found;
      return found;
    }
  }
  throw new Error('Chromium not found: set CHROMIUM_PATH or PLAYWRIGHT_BROWSERS_PATH');
}

// One Chromium at a time and three waiting (D25): a render is hundreds of MB and seconds of CPU on a 2-vCPU
// machine that also serves the API. A fifth caller gets RenderBusyError instead of piling up processes.
const renderGate = createRenderGate(1, 3);

// `--no-sandbox` stays because the Docker default seccomp profile blocks the user namespaces Chromium's own
// sandbox needs, and the only fix is a looser container for the whole server. What it renders is our own
// template, every value escaped, no script, no network; the container runs as a non-root user (D25).
const CHROMIUM_ARGS = [
  '--headless',
  '--disable-gpu',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--no-pdf-header-footer',
  '--run-all-compositor-stages-before-draw',
  '--virtual-time-budget=2000',
];

/** Render an HTML document to a PDF buffer with headless Chromium (queued: see `renderGate`). */
export function renderPdf(html: string, chromiumPath?: string): Promise<Buffer> {
  return renderGate(() => renderNow(html, chromiumPath));
}

async function renderNow(html: string, chromiumPath?: string): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), 'uptimo-pdf-'));
  try {
    const htmlPath = join(dir, 'report.html');
    const pdfPath = join(dir, 'report.pdf');
    await writeFile(htmlPath, html);
    await exec(
      resolveChromium(chromiumPath),
      [...CHROMIUM_ARGS, `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href],
      { timeout: 30_000, maxBuffer: 8 * 1024 * 1024 },
    );
    const bytes = await readFile(pdfPath);
    if (bytes.subarray(0, 5).toString() !== '%PDF-') {
      throw new Error('Chromium produced an unreadable PDF');
    }
    return bytes;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
