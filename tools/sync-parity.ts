import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { stringify } from 'yaml';
import { loadParity, parseImportSourceRow, type ParityFile, type ParityRow } from './parity.js';

const IMPORT_SOURCE = 'PARITY.md §v3 / Import and cutover; SPEC 1.10 / NEEDS N1';
const EXTERNAL_REASON =
  'Real N1 export/Worker schema/compatibility and cutover remain external; only argus.synthetic-bhavin/v1 is accepted.';

function importRow(
  source: Pick<ParityRow, 'id' | 'feature' | 'disposition' | 'milestone'>,
): ParityRow {
  return {
    ...source,
    milestones: [source.milestone],
    status: 'in-progress',
    evidence: [
      'apps/server/test/import-cli.test.ts :: T13 imports as app_api and reports exact ticket and completion data',
      'apps/server/test/import-integration.test.ts :: T44 persists fatal batch state without partial work',
      'apps/server/test/import-commands.test.ts :: T46 runs start/update/running/stopped/pause/resume/cancel/restore with sequential events',
      'apps/server/test/import-undo.test.ts :: T25 undoes an empty failed batch once and ignores stale skipped rows',
    ],
    source: IMPORT_SOURCE,
    external_reason: EXTERNAL_REASON,
  };
}

export function syncImportRow(
  file: ParityFile,
  source: Pick<ParityRow, 'id' | 'feature' | 'disposition' | 'milestone'>,
): ParityFile {
  const rows = file.rows.filter((row) => row.id !== source.id);
  const index = file.rows.findIndex((row) => row.id === source.id);
  rows.splice(index < 0 ? file.rows.length : index, 0, importRow(source));
  return { ...file, expected_rows: rows.length, rows };
}

function main(): void {
  const source = parseImportSourceRow(readFileSync('docs/spec/PARITY.md', 'utf8'));
  const synced = syncImportRow(loadParity(), source);
  const header = `# Parity ledger — generated from PARITY.md.\n# One row per parity feature. Do not hand-edit ids; update PARITY.md and regenerate.\n# status: todo | in-progress | done | waived | external. A done row must name at least one test or PR in evidence.\n# A row is done only when the whole v3 behaviour is covered; in-progress means part of it ships.\n`;
  writeFileSync('docs/spec/parity.yaml', `${header}${stringify(synced, { lineWidth: 100 })}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
