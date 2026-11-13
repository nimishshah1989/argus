import { execSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const root = new URL('..', import.meta.url).pathname;
let dir: string;
let bin: string;

function stub(name: string, body: string) {
  writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(join(bin, name), 0o755);
}
const log = () => readFileSync(join(dir, 'calls.log'), 'utf8');
const dump = (env: Record<string, string> = {}) =>
  spawnSync('bash', [join(dir, 'instance/dump.sh')], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      UPTIMO_DIR: dir,
      BACKUP_BUCKET: 'fake-backups',
      ...env,
    },
  });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'uptimo-dump-'));
  bin = join(dir, 'bin');
  mkdirSync(bin);
  mkdirSync(join(dir, 'instance'));
  copyFileSync(join(root, 'infra/instance/dump.sh'), join(dir, 'instance/dump.sh'));
  writeFileSync(join(dir, '.env'), 'AWS_REGION=ap-south-1\n');
  writeFileSync(
    join(dir, 'instance/refresh-env.sh'),
    '#!/usr/bin/env bash\necho "MIGRATION_DATABASE_URL=postgresql://fake-u:fake-pw@db.test/uptimo?sslmode=no-verify" > "$UPTIMO_DIR/migrate.env"\n',
  );
  chmodSync(join(dir, 'instance/refresh-env.sh'), 0o755);
  // The fake database client: says whether the login is exempt from row security, writes a 5-byte "dump".
  stub(
    'docker',
    `echo "docker DBURL=$DBURL" >> "$UPTIMO_DIR/calls.log"
case "$*" in
  *psql*) echo "\${LOGIN_EXEMPT:-t}" ;;
  *pg_dump*) vol=$(echo "$*" | sed -E 's/.* -v ([^ ]+):\\/out.*/\\1/'); f=$(echo "$*" | grep -o '/out/[^ "\\\\]*[.]dump' | head -1); echo data > "$vol/$(basename "$f")" ;;
  *pg_restore*) echo "\${RESTORE_LIST:-1; 1259 16385 TABLE DATA public ticket uptimo}" ;;
esac`,
  );
  stub(
    'aws',
    `echo "aws $*" >> "$UPTIMO_DIR/calls.log"
case "$*" in *head-object*) echo "\${REMOTE_SIZE:-5}" ;; esac`,
  );
});

afterEach(() => {
  execSync(`rm -rf ${dir}`);
});

describe('weekly dump (infra/instance/dump.sh)', () => {
  it('dumps, checks the archive and uploads it to the backup bucket', () => {
    const res = dump();
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/dump ok: s3:\/\/fake-backups\/dumps\/uptimo-.*\.dump \(5 bytes\)/);
    expect(log()).toMatch(/aws s3 cp .* s3:\/\/fake-backups\/dumps\/uptimo-.*\.dump/);
    // libpq cannot read node-pg's `sslmode=no-verify`, and the password stays out of the output.
    expect(log()).toContain('DBURL=postgresql://fake-u:fake-pw@db.test/uptimo\n');
    expect(res.stdout + res.stderr).not.toMatch(/fake-pw/);
  });

  it('stops before dumping when the login is subject to row security: that dump would be empty', () => {
    const res = dump({ LOGIN_EXEMPT: 'f' });
    expect(res.status).toBe(1);
    expect(res.stdout).toMatch(/STOP: .*incomplete/);
    expect(log()).not.toMatch(/pg_dump|aws s3/);
  });

  it('does not upload an archive with no ticket data, or one the bucket holds at another size', () => {
    const empty = dump({ RESTORE_LIST: '1; 1259 16385 TABLE DATA public tenant uptimo' });
    expect(empty.status).toBe(1);
    expect(empty.stdout).toMatch(/no ticket data/);
    expect(log()).not.toMatch(/aws s3 cp/);
    const short = dump({ REMOTE_SIZE: '3' });
    expect(short.status).toBe(1);
    expect(short.stdout).toMatch(/uploaded 3 bytes, dump is 5 bytes/);
  });

  it('refuses to run without a bucket', () => {
    const res = dump({ BACKUP_BUCKET: '' });
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/BACKUP_BUCKET is required/);
  });
});

describe('weekly dump workflow', () => {
  it('runs weekly and on request, from main only, and skips quietly until the bucket is configured', () => {
    const wf = parse(readFileSync(join(root, '.github/workflows/backup.yml'), 'utf8'));
    expect(wf.on.schedule[0].cron).toMatch(/^\d+ \d+ \* \* 0$/);
    expect(wf.on).toHaveProperty('workflow_dispatch');
    expect(wf.jobs.dump.if).toBe("github.ref == 'refs/heads/main'");
    const text = readFileSync(join(root, '.github/workflows/backup.yml'), 'utf8');
    expect(text).toContain('backups not set up yet');
    expect(text).not.toMatch(/secrets\.(?!AWS_ROLE_ARN)/);
  });
});

describe('what the server can reach', () => {
  it('the compose file hands the server app.env only, never the operator credentials', () => {
    const compose = readFileSync(join(root, 'infra/docker-compose.yml'), 'utf8');
    expect(compose).toContain('env_file: app.env');
    expect(compose).not.toMatch(/migrate\.env|ROUTER_DATABASE_URL|MIGRATION_DATABASE_URL/);
  });
});
