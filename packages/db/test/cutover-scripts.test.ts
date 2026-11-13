import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HAND_REVIEW } from '../../../scripts/erase-person.js';
import { startMigratedDb } from './migrated.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const MIGRATIONS = new URL('../migrations/', import.meta.url);
const ALPHA = '80000000-0000-0000-0000-000000000001';
const BETA = '81000000-0000-0000-0000-000000000001';
const ALPHA_MACHINE = '80000000-0000-0000-0000-000000000008';
const BETA_MACHINE = '81000000-0000-0000-0000-000000000008';

let container: StartedPostgreSqlContainer;
let db: Client;
let url: string;
let refs = 0;
const tagIds: string[] = [];

function run(script: string, args: string[], env: Record<string, string> = {}) {
  const result = spawnSync('pnpm', ['--silent', 'tsx', `scripts/${script}.ts`, ...args], {
    cwd: ROOT,
    env: { ...process.env, MIGRATION_DATABASE_URL: url, ...env },
    encoding: 'utf8',
    timeout: 60_000,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

async function tenantWithRows(id: string, slug: string, machine: string, tickets: string[]) {
  await db.query('INSERT INTO tenant (id, slug, name) VALUES ($1, $2, $2)', [id, slug]);
  await db.query("INSERT INTO machine (id, tenant_id, code) VALUES ($1, $2, 'VC-1')", [
    machine,
    id,
  ]);
  for (const [index, ref] of tickets.entries()) {
    const ticket = randomUUID();
    const item = randomUUID();
    await db.query(
      `INSERT INTO ticket (id, tenant_id, ref, kind, status, machine_id, problem, reported_at, severity)
       VALUES ($1, $2, $3, 'stopped', 'open', $4, 'Synthetic', now(), 'S3')`,
      [ticket, id, ref, machine],
    );
    await db.query(
      "INSERT INTO list_item (id, tenant_id, list, code, label) VALUES ($1, $2, 'tag', $3, $3)",
      [item, id, `t${index}`],
    );
    const tag = await db.query(
      'INSERT INTO ticket_tag (tenant_id, ticket_id, item_id) VALUES ($1, $2, $3) RETURNING id',
      [id, ticket, item],
    );
    tagIds.push(tag.rows[0].id);
  }
}

/** A leaver of alpha with one ticket naming them and one report (with a stored PDF) per key. */
async function leaver(
  name: string,
  pdfKeys: string[],
  extra: { short?: string | null; phone?: string | null } = {},
): Promise<string> {
  const person = randomUUID();
  const fields = { short: 'Testa', phone: '+910000000099', ...extra };
  await db.query(
    'INSERT INTO person (id, tenant_id, name, short_name, phone) VALUES ($1, $2, $3, $4, $5)',
    [person, ALPHA, name, fields.short ?? null, fields.phone ?? null],
  );
  await ticketFor(`${name} checked the press`);
  for (const key of pdfKeys) {
    const ticket = await ticketFor('Report ticket');
    const file = randomUUID();
    await db.query(
      `INSERT INTO file (id, tenant_id, kind, s3_key, mime, bytes, sha256)
       VALUES ($1, $2, 'pdf', $3, 'application/pdf', 1, $3)`,
      [file, ALPHA, key],
    );
    await db.query(
      `INSERT INTO breakdown_report (tenant_id, ticket_id, machine_id, date, shift_code, problem, pdf_file_id)
       VALUES ($1, $2, $3, current_date, '1', 'Press stopped', $4)`,
      [ALPHA, ticket, ALPHA_MACHINE, file],
    );
  }
  return person;
}

async function ticketFor(problem: string): Promise<string> {
  refs += 1;
  const id = randomUUID();
  await db.query(
    `INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, severity)
     VALUES ($1, $2, $3, 'general', 'open', $4, now(), 'S3')`,
    [id, ALPHA, `WR-${String(refs).padStart(4, '0')}`, problem],
  );
  return id;
}

function filesDir(): { base: string; dir: string } {
  const base = mkdtempSync(join(tmpdir(), 'erase-'));
  const dir = join(base, 'files');
  mkdirSync(join(dir, 'alpha'), { recursive: true });
  return { base, dir };
}

function eraseArgs(person: string, request: string, dir: string, tenant = 'alpha'): string[] {
  return [
    '--tenant',
    tenant,
    '--person',
    person,
    '--request',
    request,
    '--operator',
    'agent-test',
    '--files-dir',
    dir,
  ];
}

function reviewArgs(person: string, request: string): string[] {
  return [
    '--tenant',
    'alpha',
    '--person',
    person,
    '--review-done',
    '--request',
    request,
    '--operator',
    'agent-test',
  ];
}

/** Erasure drops every cached PDF of the plant, so rows an earlier case left behind must go first. */
async function clearPdfs(): Promise<void> {
  await db.query('UPDATE breakdown_report SET pdf_file_id = NULL WHERE tenant_id = $1', [ALPHA]);
  await db.query("DELETE FROM file WHERE tenant_id = $1 AND kind = 'pdf'", [ALPHA]);
}

beforeAll(async () => {
  ({
    container,
    client: db,
    url,
  } = await startMigratedDb({
    through: '0008_ai_suggestion.sql',
    seed: false,
  }));
  await tenantWithRows(ALPHA, 'alpha', ALPHA_MACHINE, ['BD-0001', 'BD-0002']);
  await tenantWithRows(BETA, 'beta', BETA_MACHINE, ['BD-0001']);
  await db.query(
    `INSERT INTO platform_access (tenant_id, platform_user, granted_by, expires_at, reason)
     VALUES ($1, 'support-a', 'nimish', now() + interval '1 day', 'test')`,
    [ALPHA],
  );
}, 180_000);

afterAll(async () => {
  await db?.end();
  await container?.stop();
});

describe('cutover scripts, before 0009', () => {
  it('preflight lists duplicates and exits 3', async () => {
    const found = run('preflight-cutover', []);
    expect(found.status).toBe(3);
    expect(found.stdout).toContain('machine VC-1: open breakdowns BD-0001, BD-0002');

    await db.query(
      "UPDATE ticket SET status = 'cancelled' WHERE tenant_id = $1 AND ref = 'BD-0002'",
      [ALPHA],
    );
    const clean = run('preflight-cutover', []);
    expect(clean.status).toBe(0);
    expect(clean.stdout.trim().split('\n').at(-1)).toBe(
      'preflight: 0 machines with duplicates, 3 tag rows, 1 grants',
    );

    await db.query('CREATE DATABASE empty_preflight');
    const empty = new URL(url);
    empty.pathname = '/empty_preflight';
    const none = run('preflight-cutover', [], { MIGRATION_DATABASE_URL: empty.toString() });
    expect(none.status).toBe(0);
    expect(none.stdout).toContain('preflight: schema not installed');
  });

  it('export-tags writes every row and its count opens the guard', async () => {
    const out = mkdtempSync(join(tmpdir(), 'tags-'));
    const result = run('export-tags', ['--out', out]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('3 rows written to');
    expect(result.stdout).toContain("PGOPTIONS='-c uptimo.tags_exported=3'");
    const [name, ...others] = readdirSync(out);
    expect(others).toEqual([]);
    expect(name).toMatch(/^ticket_tag-\d{8}T\d{6}Z\.csv$/);
    const lines = readFileSync(join(out, name ?? ''), 'utf8')
      .trim()
      .split('\n');
    expect(lines[0]).toBe(
      'id,tenant_id,ticket_id,item_id,applied_at,applied_by_login_id,applied_by_person_id,created_at,updated_at',
    );
    expect(lines).toHaveLength(4);
    for (const id of tagIds) expect(lines.some((line) => line.startsWith(`${id},`))).toBe(true);

    // Two runs in the same second never overwrite each other.
    const twice = mkdtempSync(join(tmpdir(), 'tags-'));
    expect(run('export-tags', ['--out', twice]).status).toBe(0);
    expect(run('export-tags', ['--out', twice]).status).toBe(0);
    const names = readdirSync(twice);
    expect(names).toHaveLength(2);
    expect(new Set(names.map((n) => readFileSync(join(twice, n), 'utf8'))).size).toBe(1);

    await db.query("SET uptimo.tags_exported = '3'");
    await db.query(readFileSync(new URL('0009_history_cannot_be_lost.sql', MIGRATIONS), 'utf8'));
    await db.query('RESET uptimo.tags_exported');
  }, 120_000);
});

describe('cutover scripts, at 0009', () => {
  it('export-tags has nothing to export after the cutover', () => {
    const out = mkdtempSync(join(tmpdir(), 'tags-'));
    const result = run('export-tags', ['--out', out]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('nothing to export');
    expect(readdirSync(out)).toEqual([]);
  });

  it('erase-person completes a searchable erasure and deletes the stored files', async () => {
    const { dir } = filesDir();
    const key = 'alpha/report-41.pdf';
    writeFileSync(join(dir, key), 'pdf');
    const person = await leaver('Testa Leaver', [key]);
    const result = run('erase-person', eraseArgs(person, 'REQ-1', dir));
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('erase: complete');
    expect(result.stdout).not.toContain(key);
    expect(existsSync(join(dir, key))).toBe(false);
    const problem = await db.query(
      "SELECT problem FROM ticket WHERE tenant_id = $1 AND problem LIKE '%checked the press'",
      [ALPHA],
    );
    expect(problem.rows.map((r) => r.problem)).toContain('Former staff checked the press');
    expect(problem.rows.map((r) => r.problem).join()).not.toMatch(/Testa/);
  }, 120_000);

  it('erase-person holds a no-term erasure until the review is recorded', async () => {
    const { dir } = filesDir();
    const person = await leaver('Om', [], { short: null, phone: null });
    const held = run('erase-person', eraseArgs(person, 'REQ-2', dir));
    expect(held.status).toBe(3);
    for (const line of HAND_REVIEW) expect(held.stdout).toContain(line);
    expect(held.stdout).toContain('review pending');
    expect(held.stdout).not.toContain('erase: complete');

    const review = reviewArgs(person, 'REQ-2');
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const done = run('erase-person', review);
      expect(done.status, done.stderr).toBe(0);
      expect(done.stdout).toContain('erase: complete');
    }
    const rows = await db.query(
      "SELECT entity_id, login_id, after FROM audit_log WHERE tenant_id = $1 AND action = 'person.erase.review'",
      [ALPHA],
    );
    expect(rows.rows).toEqual([
      {
        entity_id: person,
        login_id: null,
        after: { request_ref: 'REQ-2', operator: 'agent-test' },
      },
    ]);
    const unknown = run('erase-person', reviewArgs(person, 'REQ-404'));
    expect(unknown.status).toBe(1);
    expect(unknown.stderr).toContain('no erasure with that request reference');
  }, 120_000);

  it('erase-person refuses bad input', async () => {
    const { dir } = filesDir();
    const noOperator = run('erase-person', [
      '--tenant',
      'alpha',
      '--person',
      randomUUID(),
      '--request',
      'REQ-3',
      '--files-dir',
      dir,
    ]);
    expect(noOperator.status).toBe(2);
    expect(noOperator.stderr).toContain('usage');

    const stranger = randomUUID();
    await db.query("INSERT INTO person (id, tenant_id, name) VALUES ($1, $2, 'Beta Person')", [
      stranger,
      BETA,
    ]);
    const wrongTenant = run('erase-person', eraseArgs(stranger, 'REQ-3', dir));
    expect(wrongTenant.status).toBe(1);
    const row = await db.query('SELECT name, active FROM person WHERE id = $1', [stranger]);
    expect(row.rows[0]).toEqual({ name: 'Beta Person', active: true });
  }, 120_000);

  it('erase-person refuses an unsafe storage key and deletes nothing', async () => {
    const { base, dir } = filesDir();
    const outside = join(base, 'outside.pdf');
    const safe = join(dir, 'alpha', 'safe-56.pdf');
    writeFileSync(outside, 'pdf');
    writeFileSync(safe, 'pdf');
    const person = await leaver('Testa Leaver', ['../outside.pdf', 'alpha/safe-56.pdf']);
    const result = run('erase-person', eraseArgs(person, 'REQ-56', dir));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('erase: unsafe storage key ../outside.pdf');
    expect(existsSync(outside)).toBe(true);
    expect(existsSync(safe)).toBe(true);
    expect((await db.query('SELECT name FROM person WHERE id = $1', [person])).rows[0].name).toBe(
      'Testa Leaver',
    );

    // Erasure drops every cached PDF of the plant, so the first scenario's rows must go first.
    await db.query('UPDATE breakdown_report SET pdf_file_id = NULL WHERE tenant_id = $1', [ALPHA]);
    await db.query("DELETE FROM file WHERE tenant_id = $1 AND kind = 'pdf'", [ALPHA]);
    const absolute = join(base, 'absolute.pdf');
    writeFileSync(absolute, 'pdf');
    const other = await leaver('Testa Leaver', [absolute], { phone: '+910000000098' });
    const second = run('erase-person', eraseArgs(other, 'REQ-57', dir));
    expect(second.status).toBe(1);
    expect(second.stderr).toContain(`erase: unsafe storage key ${absolute}`);
    expect(existsSync(absolute)).toBe(true);
  }, 120_000);

  it('erase-person stops on a mistyped files directory before it changes anything', async () => {
    await clearPdfs();
    const { base, dir } = filesDir();
    const person = await leaver('Testa Leaver', ['alpha/a.pdf'], { phone: '+910000000060' });
    const missing = run('erase-person', eraseArgs(person, 'REQ-60', join(base, 'nope')));
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('is not a directory');
    const plain = join(base, 'plain.txt');
    writeFileSync(plain, 'x');
    expect(run('erase-person', eraseArgs(person, 'REQ-60', plain)).status).toBe(1);
    expect((await db.query('SELECT name FROM person WHERE id = $1', [person])).rows[0].name).toBe(
      'Testa Leaver',
    );
    expect(dir).toBeTruthy();
  }, 120_000);

  it('erase-person lists stored files it could not remove, after the counts, and exits 1', async () => {
    await clearPdfs();
    const { dir } = filesDir();
    mkdirSync(join(dir, 'alpha', 'stuck.pdf'));
    const person = await leaver('Testa Leaver', ['alpha/gone.pdf', 'alpha/stuck.pdf'], {
      phone: '+910000000061',
    });
    const result = run('erase-person', eraseArgs(person, 'REQ-61', dir));
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('"text_searched":true');
    expect(result.stdout).not.toContain('erase: complete');
    expect(result.stderr).toContain('alpha/gone.pdf');
    expect(result.stderr).toContain('alpha/stuck.pdf');
    expect((await db.query('SELECT name FROM person WHERE id = $1', [person])).rows[0].name).toBe(
      'Former staff',
    );
  }, 120_000);

  it('erase-person refuses a key whose folder is a link leading outside the files directory', async () => {
    await clearPdfs();
    const { base, dir } = filesDir();
    const outside = join(base, 'outside');
    mkdirSync(outside);
    writeFileSync(join(outside, 'x.pdf'), 'pdf');
    symlinkSync(outside, join(dir, 'link'));
    const person = await leaver('Testa Leaver', ['link/x.pdf'], { phone: '+910000000062' });
    const result = run('erase-person', eraseArgs(person, 'REQ-62', dir));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('erase: unsafe storage key link/x.pdf');
    expect(existsSync(join(outside, 'x.pdf'))).toBe(true);
    expect((await db.query('SELECT name FROM person WHERE id = $1', [person])).rows[0].name).toBe(
      'Testa Leaver',
    );
  }, 120_000);

  it('erase-person does not call an erasure complete while a short name was left unsearched', async () => {
    await clearPdfs();
    const { dir } = filesDir();
    const person = await leaver('Ravi Kumar', [], { short: 'RK', phone: null });
    await ticketFor('RK adjusted the feed');
    const held = run('erase-person', eraseArgs(person, 'REQ-63', dir));
    expect(held.status).toBe(3);
    expect(held.stdout).toContain('review pending');
    expect(held.stdout).not.toContain('erase: complete');
    for (const line of HAND_REVIEW) expect(held.stdout).toContain(line);
    const notes = await db.query(
      "SELECT problem FROM ticket WHERE tenant_id = $1 AND problem LIKE 'RK adjusted%'",
      [ALPHA],
    );
    expect(notes.rows).toHaveLength(1); // the short name stays for the hand review
    const done = run('erase-person', reviewArgs(person, 'REQ-63'));
    expect(done.status, done.stderr).toBe(0);
    expect(done.stdout).toContain('erase: complete');
  }, 120_000);

  it('erase-person keeps two leavers on one reference apart and refuses an erased person', async () => {
    await clearPdfs();
    const { dir } = filesDir();
    const first = await leaver('Al', [], { short: null, phone: null });
    const second = await leaver('Bo', [], { short: null, phone: null });
    expect(run('erase-person', eraseArgs(first, 'REQ-64', dir)).status).toBe(3);
    expect(run('erase-person', eraseArgs(second, 'REQ-64', dir)).status).toBe(3);
    const again = run('erase-person', eraseArgs(first, 'REQ-65', dir));
    expect(again.status).toBe(1);
    expect(again.stderr).toContain('already erased');
    expect(run('erase-person', reviewArgs(second, 'REQ-64')).status).toBe(0);
    expect(run('erase-person', reviewArgs(first, 'REQ-64')).status).toBe(0);
    const rows = await db.query(
      `SELECT entity_id FROM audit_log WHERE tenant_id = $1 AND action = 'person.erase.review'
         AND after ->> 'request_ref' = 'REQ-64'`,
      [ALPHA],
    );
    expect(rows.rows.map((r) => r.entity_id).sort()).toEqual([first, second].sort());
  }, 120_000);
});
