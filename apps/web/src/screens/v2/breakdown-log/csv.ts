import { toCsv } from '../../analytics/machine-values.js';

/** The table as the client-export pattern writes it: the data columns, the eye column left out. */
export function logCsv(header: readonly string[], rows: readonly (readonly string[])[]): string {
  return toCsv([header.slice(1), ...rows.map((row) => row.slice(1))]);
}

/** The client export pattern: a Blob, a link and the browser's download, with no new dependency. */
export function downloadCsv(csv: string, day = new Date().toISOString().slice(0, 10)): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `breakdown-log-${day}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
