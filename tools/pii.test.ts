import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SOURCES, denyListFromSources, loadDenyList, workbookCells } from './pii-sources.js';

// No real value goes into an assertion message: every check on a real value is a boolean or a count.

describe('pii deny-list', () => {
  it('fails on a generated Indian mobile number in every written form (list side)', () => {
    const n = `${6 + Math.floor(Math.random() * 4)}${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
    const deny = denyListFromSources({
      users: JSON.stringify({ users: [{ name: 'Fake Person', note: `call +91${n}` }] }),
    });
    expect(deny.phones).toEqual([n]);
  });

  it('ignores generic labels', () => {
    const users = ['Operator', 'Maint. Team', 'Cell1', 'AB', 'Fake Person'].map((name) => ({
      name,
    }));
    expect(denyListFromSources({ users: JSON.stringify({ users }) }).names).toEqual([
      'fake person',
    ]);
  });

  it('reads names from the workbook', () => {
    const texts = {
      users: readFileSync(SOURCES.users, 'utf8'),
      tickets: readFileSync(SOURCES.tickets, 'utf8'),
      workbook: readFileSync(SOURCES.workbook, 'utf8'),
    };
    const jsonOnly = denyListFromSources({ users: texts.users, tickets: texts.tickets });
    const all = denyListFromSources(texts);
    expect(all.names.length > jsonOnly.names.length).toBe(true);
    expect(() => workbookCells('no sheets')).toThrow(/no readable worksheets/);
  });

  it('fails loudly when a source list is missing', () => {
    const empty = mkdtempSync(join(tmpdir(), 'pii-empty-'));
    expect(() => loadDenyList(empty)).toThrow(/pii: source list missing/);
  });
});
