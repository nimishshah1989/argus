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
    'echo "IMAGE_TAG=${IMAGE_TAG:-} aws $*" >> "$UPTIMO_DIR/calls.log"\necho fake-password',
  );
  stub(
    'docker',
    `echo "IMAGE_TAG=\${IMAGE_TAG:-} docker $*" >> "$UPTIMO_DIR/calls.log"
if [ "$1" = "login" ]; then cat > /dev/null; fi
if [ "$1 $2" = "compose up" ]; then echo "$IMAGE_TAG" > "$UPTIMO_DIR/lastup"; fi
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
      'DATABASE_URL=postgresql://fake-app:fake-pw-1@db.test/uptimo\n',
    );
    expect(readFileSync(join(dir, 'migrate.env'), 'utf8')).toBe(
      'MIGRATION_DATABASE_URL=postgresql://fake-master:fake-pw-2@db.test/uptimo\nAPP_API_PASSWORD=fake-pw-3\n',
    );
    for (const f of ['app.env', 'migrate.env'])
      expect(statSync(join(dir, f)).mode & 0o777).toBe(0o600);
    expect(calls().join('\n')).toContain('--secret-id uptimo/staging');
    expect(res.stdout + res.stderr).not.toMatch(/fake-/);
  });
});
