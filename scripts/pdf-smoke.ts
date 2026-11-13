// Runs inside the deployed server container after a release (infra/instance/deploy.sh): makes one real PDF
// the way the report routes do, so a missing Chromium, a missing Gujarati font or a user that cannot run
// Chromium fails the release instead of the first report a supervisor prints.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { renderPdf } from '../apps/server/src/modules/reports/pdf.js';

const run = promisify(execFile);

for (const [name, lang] of [
  ['Gujarati', 'gu'],
  ['Devanagari', 'hi'],
] as const) {
  const fonts = (await run('fc-list', [`:lang=${lang}`, 'family'])).stdout.trim();
  if (!fonts) throw new Error(`no ${name} font is installed`);
}

const html = '<!doctype html><meta charset="utf-8"><p>સ્પિન્ડલ બેરિંગ बदलना पड़ा · Report 1234</p>';
const bytes = await renderPdf(html); // throws unless the output starts with %PDF-
console.log(`pdf ok: ${bytes.length} bytes`);
