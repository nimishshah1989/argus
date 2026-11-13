import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '../src');

function offenders(pattern: RegExp, skip: string[] = []): string[] {
  const hits: string[] = [];
  for (const rel of readdirSync(SRC, { recursive: true, encoding: 'utf8' })) {
    if (!rel.endsWith('.ts') || skip.includes(rel)) continue;
    const text = readFileSync(join(SRC, rel), 'utf8');
    for (const m of text.matchAll(new RegExp(pattern.source, 'gi')))
      hits.push(`${rel}:${text.slice(0, m.index).split('\n').length}`);
  }
  return hits;
}

describe('history is never destroyed by server SQL', () => {
  it('no server SQL deletes a work segment, list entry, login, person or ticket event', () => {
    // Matched over the whole file text, so a statement broken across lines is still caught.
    expect(
      offenders(/delete\s+from\s+(work_segment|list_item|login|person|ticket_event)\b/i),
    ).toEqual([]);
  });

  it('no server SQL names ticket_tag', () => {
    expect(offenders(/ticket_tag/, ['modules/manifest.ts'])).toEqual([]);
  });
});
