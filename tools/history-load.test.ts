import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/** Ticket 69d: infra/instance/history-load.sh with fake aws, docker and timeout on PATH. */
const root = new URL('..', import.meta.url).pathname;
let dir: string;
let bin: string;

function stub(name: string, body: string) {
  writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(join(bin, name), 0o755);
}
const log = () => readFileSync(join(dir, 'calls.log'), 'utf8');
const load = (args: string[] = [], env: Record<string, string> = {}) =>
  spawnSync('bash', [join(dir, 'instance/history-load.sh'), ...args], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, UPTIMO_DIR: dir, ...env },
  });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'uptimo-history-'));
  bin = join(dir, 'bin');
  mkdirSync(bin);
  mkdirSync(join(dir, 'instance'));
  copyFileSync(join(root, 'infra/instance/history-load.sh'), join(dir, 'instance/history-load.sh'));
  writeFileSync(join(dir, '.env'), 'AWS_REGION=ap-south-1\nECR_REGISTRY=registry.test\n');
  writeFileSync(join(dir, '.current_tag'), 'abc123\n');
  writeFileSync(join(dir, 'calls.log'), '');
  writeFileSync(
    join(dir, 'instance/refresh-env.sh'),
    '#!/usr/bin/env bash\necho "${APP_ENV_LINE:-APP_ENV=staging}" > "$UPTIMO_DIR/app.env"\n',
  );
  chmodSync(join(dir, 'instance/refresh-env.sh'), 0o755);
  stub('docker', 'echo "docker $*" >> "$UPTIMO_DIR/calls.log"');
  stub('timeout', 'shift; exec "$@"');
  stub(
    'aws',
    `echo "aws $*" >> "$UPTIMO_DIR/calls.log"
case "$*" in
  *create-db-snapshot*) [ -z "$SNAPSHOT_FAILS" ] || exit 1 ;;
  *"s3 cp"*) [ -z "$UPLOADED" ] || { mkdir -p "$5/2022"; echo x > "$5/2022/bd-2022.xlsx"; } ;;
esac`,
  );
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('staging history load (infra/instance/history-load.sh)', () => {
  it('snapshots first, then loads the 2026 log with the data-from date in the running image', () => {
    const res = load();
    expect(res.status, res.stdout + res.stderr).toBe(0);
    const calls = log();
    const snap = calls.indexOf('create-db-snapshot');
    expect(snap).toBeGreaterThan(-1);
    expect(calls.indexOf('seed/history-load.ts')).toBeGreaterThan(snap);
    expect(calls).toMatch(/--db-snapshot-identifier uptimo-pre-history-\d{14}/);
    expect(calls).toContain('registry.test/uptimo-server:abc123');
    expect(calls).toContain('--tenant cosmos --data-from 2026-01-01');
    expect(calls).not.toMatch(/load-legacy|s3 cp/);
    expect(res.stdout).toMatch(/backup: snapshot uptimo-pre-history-\d{14} is available/);
  });

  it('loads nothing when the snapshot fails', () => {
    const res = load([], { SNAPSHOT_FAILS: '1' });
    expect(res.status).toBe(1);
    expect(res.stdout).toMatch(/STOP: snapshot .* failed or timed out; nothing loaded/);
    expect(log()).not.toMatch(/docker/);
  });

  it('refuses anything that is not staging', () => {
    const res = load([], { APP_ENV_LINE: 'APP_ENV=production' });
    expect(res.status).toBe(1);
    expect(res.stdout).toMatch(/STOP: this is not staging/);
    expect(log()).toBe('');
  });

  it('with --legacy, stops before the snapshot when nothing was uploaded', () => {
    const res = load(['--legacy'], { FILES_BUCKET: 'fake-files' });
    expect(res.status).toBe(1);
    expect(res.stdout).toMatch(/STOP: no \.xlsx under s3:\/\/fake-files\/legacy\//);
    expect(log()).not.toMatch(/create-db-snapshot|docker/);
  });

  it('with --legacy, loads the uploaded workbooks after the 2026 log', () => {
    const res = load(['--legacy'], { FILES_BUCKET: 'fake-files', UPLOADED: '1' });
    expect(res.status, res.stdout + res.stderr).toBe(0);
    expect(res.stdout).toContain('legacy workbooks: 1');
    const calls = log();
    expect(calls).toContain('aws s3 cp --recursive s3://fake-files/legacy/');
    const legacy = calls.indexOf(
      'tools/load-legacy.ts --data /data/legacy --tenant cosmos --allow-remote',
    );
    expect(legacy).toBeGreaterThan(calls.indexOf('seed/history-load.ts'));
  });
});
