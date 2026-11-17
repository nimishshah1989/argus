/**
 * The audit trail as CSV (LOCK: `at,action,entity,entityId,actor,ip,before,after`). RFC-4180: fields are quoted
 * only when they hold a comma, a quote or a line break, and a quote inside is doubled. A leading `=`, `+`, `-`,
 * `@`, tab or CR is what a spreadsheet evaluates as a formula, so every cell gets a single quote in front of it
 * (the conventional CSV-injection guard) before quoting: a person's name is free text. The values are the
 * stored JSON, compact, so a spreadsheet shows the same before/after the screen does.
 */

export const CSV_HEADER = 'at,action,entity,entityId,actor,ip,before,after';

export interface CsvRow {
  at: string;
  action: string;
  entity: string;
  entityId: string | null;
  actor: string | null;
  ip: string | null;
  before: unknown;
  after: unknown;
}

const RISKY = /^[=+\-@\t\r]/;
const neutralise = (text: string): string => (RISKY.test(text) ? `'${text}` : text);

const quote = (text: string): string =>
  /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;

/** One cell: neutralised so a spreadsheet never runs it, then quoted only when RFC-4180 needs it. */
const cell = (text: string): string => quote(neutralise(text));

const json = (value: unknown): string => JSON.stringify(value ?? null);

/**
 * `cappedAt` is set when the export hit its cap: one comment line says so and how to narrow it, so a caller never
 * mistakes a bounded export for the whole trail.
 */
export function auditCsv(rows: readonly CsvRow[], cappedAt: number | null): string {
  const lines = [CSV_HEADER];
  for (const row of rows)
    lines.push(
      [
        row.at,
        row.action,
        row.entity,
        row.entityId ?? '',
        row.actor ?? '',
        row.ip ?? '',
        json(row.before),
        json(row.after),
      ]
        .map(cell)
        .join(','),
    );
  if (cappedAt !== null)
    lines.push(
      quote(`# Export capped at the newest ${cappedAt} rows; narrow the filters to see the rest`),
    );
  return `${lines.join('\r\n')}\r\n`;
}
