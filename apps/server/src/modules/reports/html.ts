/** What every report PDF template shares: one place that escapes text and one that names a machine. */

/** Text for HTML: the five characters that could break out of an element or an attribute. */
export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function cellLabel(cell: string | null): string | null {
  if (!cell) return null;
  return /^cell[\s-]/i.test(cell) ? cell : `Cell ${cell}`;
}

export function machineLabel(machine: {
  code: string | null;
  category: string | null;
  cell: string | null;
}): string {
  if (!machine.code) return '—';
  const meta = [machine.category, cellLabel(machine.cell)].filter(Boolean).join(', ');
  return meta ? `${machine.code} (${meta})` : machine.code;
}
