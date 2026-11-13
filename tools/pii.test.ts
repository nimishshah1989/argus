import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanFiles, scanText, scannedPaths } from './check-pii.js';
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

  it('takes workbook phones from people sheets, never from machine registers', () => {
    const sheet = (header: string, value: string) =>
      `<worksheet><c r="A1" t="inlineStr"><is><t>${header}</t></is></c><c r="A2" t="inlineStr"><is><t>${value}</t></is></c></worksheet>`;
    const n = `${6 + Math.floor(Math.random() * 4)}${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
    const people = denyListFromSources({ workbook: sheet('Contact', `call ${n}`) });
    const register = denyListFromSources({ workbook: sheet('Serial No', `FX7 ${n}`) });
    expect(people.phones).toEqual([n]);
    expect(register.phones).toEqual([]);
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

const titleCase = (name: string): string => name.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

describe('pii scan', () => {
  it('fails on a planted real name from the source lists, passes without it', () => {
    const deny = loadDenyList();
    const name = deny.names[0] ?? '';
    const errors = scanText('planted.md', `intro\nReported by ${titleCase(name)}`, deny);
    expect(name.length > 0).toBe(true);
    expect(errors).toEqual(['planted.md:2: real name from the source lists']);
    expect(errors.join().includes(name)).toBe(false);
    expect(scanText('planted.md', 'Reported by a fake person', deny)).toEqual([]);
  });

  it('fails on a generated Indian mobile number in every written form', () => {
    const n = `${6 + Math.floor(Math.random() * 4)}${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
    const deny = denyListFromSources({
      users: JSON.stringify({ users: [{ name: 'Fake Person', note: `call +91${n}` }] }),
    });
    const other = `${n.slice(0, 9)}${(Number(n[9]) + 1) % 10}`;
    const text = [`+91${n}`, `+91 ${n.slice(0, 5)} ${n.slice(5)}`, `0${n}`, n, other].join('\n');
    const expected = [1, 2, 3, 4].map((line) => `p.md:${line}: real phone from the source lists`);
    expect(scanText('p.md', text, deny)).toEqual(expected);
  });

  it('flags a real name and a real phone planted in a temp file, and skips binary files', () => {
    const deny = loadDenyList();
    const dir = mkdtempSync(join(tmpdir(), 'pii-plant-'));
    const phone = deny.phones[0] ?? '';
    writeFileSync(join(dir, 'a.md'), `x\n${deny.names[0] ?? ''}\ncall ${phone}\n`);
    writeFileSync(join(dir, 'b.bin'), `\0${deny.names[0] ?? ''}`);
    expect(scanFiles(dir, ['a.md', 'b.bin'], deny)).toEqual([
      'a.md:2: real name from the source lists',
      'a.md:3: real phone from the source lists',
    ]);
  });

  it('never scans the source lists or the lockfile', () => {
    const paths = [SOURCES.users, 'pnpm-lock.yaml', 'apps/x.ts'];
    expect(scannedPaths(paths)).toEqual(['apps/x.ts']);
  });

  it('the repository holds no real name or phone outside docs/discovery', () => {
    const listed = execFileSync('git', ['ls-files', '-z'], {
      encoding: 'utf8',
      maxBuffer: 1 << 26,
    });
    const paths = listed.split('\0').filter(Boolean);
    expect(scanFiles(process.cwd(), scannedPaths(paths), loadDenyList())).toEqual([]);
  });
});
