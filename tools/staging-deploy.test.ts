import { execSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// SendCommand rejects a document over 64 KB ("MaxDocumentSizeExceeded"):
// https://docs.aws.amazon.com/systems-manager/latest/APIReference/API_SendCommand.html
const RUN_COMMAND_LIMIT_BYTES = 64 * 1024;

const root = new URL('..', import.meta.url).pathname;
const script = (name: string) => join(root, 'infra/instance', name);

let dir: string;
let bin: string;
const run = (args: string[], env: Record<string, string> = {}) =>
  spawnSync('bash', [join(dir, 'instance/deploy.sh'), ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      UPTIMO_DIR: dir,
      HEALTH_TIMEOUT: '2',
      ...env,
    },
  });
const calls = () => readFileSync(join(dir, 'calls.log'), 'utf8').split('\n').filter(Boolean);
const state = (name: string) => readFileSync(join(dir, name), 'utf8').trim();

function stub(name: string, body: string) {
  writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(join(bin, name), 0o755);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'uptimo-deploy-'));
  bin = join(dir, 'bin');
  mkdirSync(bin);
  mkdirSync(join(dir, 'instance'));
  copyFileSync(script('deploy.sh'), join(dir, 'instance/deploy.sh'));
  writeFileSync(
    join(dir, 'instance/refresh-env.sh'),
    '#!/usr/bin/env bash\ntouch "$UPTIMO_DIR/app.env" "$UPTIMO_DIR/migrate.env"\n',
  );
  chmodSync(join(dir, 'instance/refresh-env.sh'), 0o755);
  writeFileSync(join(dir, 'docker-compose.yml'), '');
  writeFileSync(
    join(dir, '.env'),
    'ECR_REGISTRY=registry.test\nAWS_REGION=ap-south-1\nSECRET_ID=uptimo/staging\n',
  );
  stub(
    'aws',
    `echo "IMAGE_TAG=\${IMAGE_TAG:-} aws $*" >> "$UPTIMO_DIR/calls.log"
if [ "$1 $2" = "rds create-db-snapshot" ] && [ -n "\${FAIL_SNAPSHOT:-}" ]; then exit 1; fi
echo fake-password`,
  );
  stub(
    'docker',
    `echo "IMAGE_TAG=\${IMAGE_TAG:-} docker $*" >> "$UPTIMO_DIR/calls.log"
if [ "$1" = "login" ]; then cat > /dev/null; fi
if [ "$1 $2" = "image ls" ]; then printf '%b' "\${IMAGES:-}"; fi
if [ "$1 $2" = "compose up" ]; then echo "$IMAGE_TAG" > "$UPTIMO_DIR/lastup"; fi
if [[ "$*" == *"migrate.ts --pending"* ]]; then
  [ -z "\${BAD_STATE:-}" ] || exit 1
  echo "pending: \${PENDING:-0}"
fi
if [[ "$*" == *pdf-smoke* ]]; then
  [ -z "\${BAD_PDF:-}" ] || { echo "Chromium not found: set CHROMIUM_PATH"; exit 1; }
  exit 0
fi
if [ "$1 $2" = "compose exec" ]; then [ "$(cat "$UPTIMO_DIR/lastup")" != "\${BAD_TAG:-}" ]; fi`,
  );
});

afterEach(() => {
  execSync(`rm -rf ${dir}`);
});

describe('staging deploy', () => {
  it('deploy workflow runs on merges to main and offers rollback', () => {
    const wf = parse(readFileSync(join(root, '.github/workflows/deploy.yml'), 'utf8'));
    expect(wf.on.push.branches).toEqual(['main']);
    expect(wf.on.push.tags).toBeUndefined();
    expect(wf.on.workflow_dispatch.inputs.action.options).toEqual(['deploy', 'rollback']);
    expect(wf.concurrency).toEqual({ group: 'deploy', 'cancel-in-progress': false });
    const job = wf.jobs.staging;
    expect(job.if).toBe("github.ref == 'refs/heads/main'");
    expect(job.steps[0].run).toContain('staging not provisioned yet');
    expect(job.steps[0].run).toContain('ready=');
    const builds = job.steps.filter((s: { run?: string }) =>
      s.run?.includes('docker buildx build'),
    );
    expect(builds.length).toBeGreaterThan(0);
    for (const step of builds) expect(step.if).toContain("env.ACTION == 'deploy'");
    const payload = execSync('tar czf - -C infra docker-compose.yml instance | base64 -w0', {
      cwd: root,
    });
    expect(payload.length).toBeLessThan(RUN_COMMAND_LIMIT_BYTES / 2);
  });

  it('deploy migrates before starting the new release and records it', () => {
    writeFileSync(join(dir, '.current_tag'), 'aaa');
    const res = run(['deploy', 'bbb']);
    expect(res.status).toBe(0);
    const log = calls();
    const migrate = log.findIndex(
      (l) =>
        l.includes('run --rm --env-file') &&
        !l.includes('--pending') &&
        l.includes('migrate.env') &&
        l.includes('registry.test/uptimo-server:bbb') &&
        l.includes('scripts/migrate.ts'),
    );
    const up = log.findIndex((l) => l.startsWith('IMAGE_TAG=bbb') && l.includes('compose up -d'));
    expect(migrate).toBeGreaterThanOrEqual(0);
    expect(up).toBeGreaterThan(migrate);
    expect(state('.current_tag')).toBe('bbb');
    expect(state('.previous_tag')).toBe('aaa');
  });

  it('frees disk space before pulling, keeping the running and the rollback release', () => {
    writeFileSync(join(dir, '.current_tag'), 'aaa');
    writeFileSync(join(dir, '.previous_tag'), 'zzz');
    const images = [
      'registry.test/uptimo-server:aaa',
      'registry.test/uptimo-server:zzz',
      'registry.test/uptimo-server:old1',
      'registry.test/uptimo-web:old2',
      'caddy:2-alpine',
    ].join('\\n');
    const res = run(['deploy', 'bbb'], { IMAGES: images });
    expect(res.status).toBe(0);
    const log = calls();
    const removed = log.filter((l) => l.includes('docker image rm')).join(' ');
    expect(removed).toContain('uptimo-server:old1');
    expect(removed).toContain('uptimo-web:old2');
    expect(removed).not.toMatch(/:aaa|:zzz|caddy/);
    const rm = log.findIndex((l) => l.includes('docker image rm'));
    const pull = log.findIndex((l) => l.includes('compose pull'));
    expect(rm).toBeGreaterThanOrEqual(0);
    expect(pull).toBeGreaterThan(rm);
  });

  it('a release that fails its health check is rolled back automatically', () => {
    writeFileSync(join(dir, '.current_tag'), 'aaa');
    const res = run(['deploy', 'bbb'], { BAD_TAG: 'bbb' });
    expect(res.status).not.toBe(0);
    expect(res.stdout + res.stderr).toContain('rolled back to aaa');
    const ups = calls().filter((l) => l.includes('compose up -d'));
    expect(ups.at(-1)).toMatch(/^IMAGE_TAG=aaa /);
    expect(state('.current_tag')).toBe('aaa');
    expect(existsSync(join(dir, '.previous_tag'))).toBe(false);
  });

  it('takes an RDS snapshot before migrating when migrations are pending, and waits for it', () => {
    writeFileSync(join(dir, '.current_tag'), 'aaa');
    const res = run(['deploy', 'bbb-1.2'], { PENDING: '2' });
    expect(res.status).toBe(0);
    const log = calls();
    const create = log.findIndex((l) => l.includes('rds create-db-snapshot'));
    const wait = log.findIndex((l) => l.includes('rds wait db-snapshot-available'));
    const migrate = log.findIndex(
      (l) => l.includes('scripts/migrate.ts') && !l.includes('--pending'),
    );
    const up = log.findIndex((l) => l.includes('compose up -d'));
    expect(create).toBeGreaterThanOrEqual(0);
    expect(wait).toBeGreaterThan(create);
    expect(migrate).toBeGreaterThan(wait);
    expect(up).toBeGreaterThan(migrate);
    expect(log[create]).toMatch(/--db-instance-identifier uptimo-postgres /);
    // Unique per attempt, and only letters, digits and hyphens (what RDS accepts).
    const name = /--db-snapshot-identifier (\S+)/.exec(log[create] ?? '')?.[1] ?? '';
    expect(name).toMatch(/^uptimo-pre-bbb12-\d{14}$/);
    expect(log[wait]).toContain(`--db-snapshot-identifier ${name}`);
  });

  it('takes no snapshot when nothing is waiting to be migrated', () => {
    const res = run(['deploy', 'bbb'], { PENDING: '0' });
    expect(res.status).toBe(0);
    expect(calls().some((l) => l.includes('rds '))).toBe(false);
  });

  it('does not migrate, and leaves the running release alone, when the snapshot fails', () => {
    writeFileSync(join(dir, '.current_tag'), 'aaa');
    const res = run(['deploy', 'bbb'], { PENDING: '1', FAIL_SNAPSHOT: '1' });
    expect(res.status).not.toBe(0);
    expect(res.stdout + res.stderr).toMatch(
      /snapshot uptimo-pre-bbb-\d+ failed.*nothing migrated.*aaa still running/,
    );
    const log = calls();
    expect(log.some((l) => l.includes('scripts/migrate.ts') && !l.includes('--pending'))).toBe(
      false,
    );
    expect(log.some((l) => l.includes('compose up -d'))).toBe(false);
    expect(state('.current_tag')).toBe('aaa');
  });

  it('treats an unreadable migration state as a reason to stop, not to skip the snapshot', () => {
    const res = run(['deploy', 'bbb'], { BAD_STATE: '1' });
    expect(res.status).not.toBe(0);
    expect(res.stdout + res.stderr).toContain('could not read');
    expect(calls().some((l) => l.includes('compose up -d'))).toBe(false);
  });

  it('after a migration, a failed health check says the database is already migrated', () => {
    writeFileSync(join(dir, '.current_tag'), 'aaa');
    const res = run(['deploy', 'bbb'], { PENDING: '1', BAD_TAG: 'bbb' });
    const out = res.stdout + res.stderr;
    expect(res.status).not.toBe(0);
    expect(out).toContain('rolled back to aaa');
    expect(out).toMatch(/already migrated for bbb.*aaa is running on the NEW schema/);
    expect(out).toContain('additive');
    expect(out).toMatch(/restore snapshot uptimo-pre-bbb-\d+/);
    expect(state('.current_tag')).toBe('aaa');
  });

  it('a release that cannot make a PDF is rolled back like one that is unhealthy', () => {
    writeFileSync(join(dir, '.current_tag'), 'aaa');
    const res = run(['deploy', 'bbb'], { BAD_PDF: '1' });
    const out = res.stdout + res.stderr;
    expect(res.status).not.toBe(0);
    expect(out).toContain('PDF check failed: Chromium not found');
    expect(out).toContain('rolled back to aaa');
    expect(out).not.toContain('already migrated');
    expect(state('.current_tag')).toBe('aaa');
  });

  it('a first deploy that cannot make a PDF fails and records nothing', () => {
    const res = run(['deploy', 'bbb'], { BAD_PDF: '1' });
    expect(res.status).not.toBe(0);
    expect(res.stdout + res.stderr).toContain('first deploy');
    expect(existsSync(join(dir, '.current_tag'))).toBe(false);
  });

  it('rollback returns to the previous release without migrating', () => {
    expect(run(['rollback']).stderr + run(['rollback']).stdout).toContain('no previous release');
    expect(run(['rollback']).status).not.toBe(0);
    writeFileSync(join(dir, '.current_tag'), 'bbb');
    writeFileSync(join(dir, '.previous_tag'), 'aaa');
    const res = run(['rollback']);
    expect(res.status).toBe(0);
    const log = calls();
    expect(log.filter((l) => l.includes('compose up -d')).at(-1)).toMatch(/^IMAGE_TAG=aaa /);
    expect(log.some((l) => l.includes('migrate.ts'))).toBe(false);
    expect(state('.current_tag')).toBe('aaa');
    expect(state('.previous_tag')).toBe('bbb');
  });

  it('env files come from the secret store and are private', () => {
    const secret = JSON.stringify({
      DATABASE_URL: 'postgresql://fake-app:fake-pw-1@db.test/uptimo',
      MIGRATION_DATABASE_URL: 'postgresql://fake-master:fake-pw-2@db.test/uptimo',
      APP_API_PASSWORD: 'fake-pw-3',
    });
    stub('aws', `echo "aws $*" >> "$UPTIMO_DIR/calls.log"\necho '${secret}'`);
    const res = spawnSync('bash', [script('refresh-env.sh')], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, UPTIMO_DIR: dir },
    });
    expect(res.status).toBe(0);
    expect(readFileSync(join(dir, 'app.env'), 'utf8')).toBe(
      'DATABASE_URL=postgresql://fake-app:fake-pw-1@db.test/uptimo\nAPP_ENV=staging\n',
    );
    // D24: the operator credential (migrations, import undo) lives in migrate.env only, never where the server reads.
    expect(readFileSync(join(dir, 'migrate.env'), 'utf8')).toBe(
      'MIGRATION_DATABASE_URL=postgresql://fake-master:fake-pw-2@db.test/uptimo\n' +
        'ROUTER_DATABASE_URL=postgresql://fake-master:fake-pw-2@db.test/uptimo\n' +
        'APP_API_PASSWORD=fake-pw-3\n',
    );
    expect(readFileSync(join(dir, 'app.env'), 'utf8')).not.toMatch(/ROUTER|MIGRATION|fake-pw-[23]/);
    for (const f of ['app.env', 'migrate.env'])
      expect(statSync(join(dir, f)).mode & 0o777).toBe(0o600);
    expect(calls().join('\n')).toContain('--secret-id uptimo/staging');
    expect(res.stdout + res.stderr).not.toMatch(/fake-/);
  });

  it('names the environment from the secret when the secret does not, production unless staging', () => {
    const secret = JSON.stringify({
      DATABASE_URL: 'postgresql://fake-app:fake-pw-1@db.test/uptimo',
      MIGRATION_DATABASE_URL: 'postgresql://fake-master:fake-pw-2@db.test/uptimo',
      APP_API_PASSWORD: 'fake-pw-3',
    });
    stub('aws', `echo '${secret}'`);
    for (const [secretId, expected] of [
      ['uptimo/staging', 'APP_ENV=staging'],
      ['uptimo/production', 'APP_ENV=production'],
      ['something-else', 'APP_ENV=production'],
    ]) {
      writeFileSync(join(dir, '.env'), `AWS_REGION=ap-south-1\nSECRET_ID=${secretId}\n`);
      const res = spawnSync('bash', [script('refresh-env.sh')], {
        encoding: 'utf8',
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, UPTIMO_DIR: dir },
      });
      expect(res.status).toBe(0);
      expect(readFileSync(join(dir, 'app.env'), 'utf8').trimEnd().split('\n')).toContain(expected);
    }
  });

  it('copies the optional AI settings from the secret store', () => {
    const ai = {
      APP_ENV: 'staging',
      ANTHROPIC_API_KEY: 'fake-key-for-tests',
      AI_MODEL: 'fake-model-id',
      AI_PRICE_INPUT_USD_PER_MTOK: '1',
      AI_PRICE_OUTPUT_USD_PER_MTOK: '5',
      AI_MAX_OUTPUT_TOKENS: '512',
      AI_DEFAULT_MONTHLY_CAP_USD: '20',
    };
    const secret = JSON.stringify({
      DATABASE_URL: 'postgresql://fake-app:fake-pw-1@db.test/uptimo',
      MIGRATION_DATABASE_URL: 'postgresql://fake-master:fake-pw-2@db.test/uptimo',
      APP_API_PASSWORD: 'fake-pw-3',
      ...ai,
    });
    stub('aws', `echo '${secret}'`);
    const res = spawnSync('bash', [script('refresh-env.sh')], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, UPTIMO_DIR: dir },
    });
    expect(res.status).toBe(0);
    const lines = readFileSync(join(dir, 'app.env'), 'utf8').trimEnd().split('\n');
    expect(lines).toEqual([
      'DATABASE_URL=postgresql://fake-app:fake-pw-1@db.test/uptimo',
      ...Object.entries(ai).map(([k, v]) => `${k}=${v}`),
    ]);
    expect(statSync(join(dir, 'app.env')).mode & 0o777).toBe(0o600);
    expect(res.stdout + res.stderr).not.toMatch(/fake-/);
  });
});
