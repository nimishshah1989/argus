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

const root = new URL('..', import.meta.url).pathname;
let dir: string;
let bin: string;

function stub(name: string, body: string) {
  writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(join(bin, name), 0o755);
}
const log = () => readFileSync(join(dir, 'calls.log'), 'utf8');
const exec = (script: string, args: string[] = [], env: Record<string, string> = {}) =>
  spawnSync('bash', [join(dir, 'instance', script), ...args], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, UPTIMO_DIR: dir, ...env },
  });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'uptimo-files-'));
  bin = join(dir, 'bin');
  mkdirSync(bin);
  mkdirSync(join(dir, 'instance'));
  for (const f of ['files-backup.sh', 'files-restore.sh'])
    copyFileSync(join(root, 'infra/instance', f), join(dir, 'instance', f));
  writeFileSync(
    join(dir, '.env'),
    'ECR_REGISTRY=registry.test\nAWS_REGION=ap-south-1\nSECRET_ID=uptimo/staging\n',
  );
  writeFileSync(join(dir, '.current_tag'), 'abc123\n');
  // A real tar archive stands in for the volume's contents: docker "prints" it, aws "downloads" it.
  execSync(
    `mkdir ${dir}/vol && echo logo > ${dir}/vol/a.png && tar czf ${dir}/vol.tgz -C ${dir}/vol .`,
  );
  stub(
    'docker',
    `echo "docker $*" >> "$UPTIMO_DIR/calls.log"
case "$*" in
  *"tar czf -"*) cat "$UPTIMO_DIR/vol.tgz" ;;
  *"uptimo_files_drill"*"find ."*) echo "5 ./a.png" ;;
  *"find ."*) echo "\${LIVE_LIST:-5 ./a.png}" ;;
esac`,
  );
  stub(
    'aws',
    `echo "aws $*" >> "$UPTIMO_DIR/calls.log"
case "$*" in
  *get-secret-value*) echo '{"BACKUP_BUCKET":"fake-backups"}' ;;
  *head-object*) echo "\${REMOTE_SIZE:-$(stat -c %s "$UPTIMO_DIR/vol.tgz")}" ;;
  *list-objects-v2*) echo "\${NEWEST:-files-volume/files-2026-11-14T2030Z.tar.gz}" ;;
  "s3 cp s3://"*) cp "$UPTIMO_DIR/vol.tgz" "$4" ;;
esac`,
  );
});
afterEach(() => execSync(`rm -rf ${dir}`));

describe('nightly files backup (infra/instance/files-backup.sh)', () => {
  it('archives the volume read-only and uploads it under files-volume/ in the backup bucket', () => {
    const res = exec('files-backup.sh');
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(
      /files backup ok: s3:\/\/fake-backups\/files-volume\/files-.*\.tar\.gz \(\d+ bytes\)/,
    );
    expect(log()).toContain('-v uptimo_files:/data/files:ro registry.test/uptimo-server:abc123');
    expect(log()).toMatch(/aws s3 cp .* s3:\/\/fake-backups\/files-volume\/files-.*\.tar\.gz/);
  });

  it('does not report success when the bucket holds a different size', () => {
    const res = exec('files-backup.sh', [], { REMOTE_SIZE: '3' });
    expect(res.status).toBe(1);
    expect(res.stdout).toMatch(/uploaded 3 bytes/);
  });

  it('uploads nothing when what the volume produced is not a readable archive', () => {
    writeFileSync(join(dir, 'vol.tgz'), 'not an archive');
    const res = exec('files-backup.sh');
    expect(res.status).toBe(1);
    expect(log()).not.toMatch(/aws s3 cp/);
  });

  it('stops before the first deploy, when there is no release to read the volume with', () => {
    execSync(`rm ${dir}/.current_tag`);
    const res = exec('files-backup.sh');
    expect(res.status).toBe(1);
    expect(res.stdout).toMatch(/nothing is deployed yet/);
  });

  it('keeps the archives 13 weeks and lets the server reach only dumps/ and files-volume/', () => {
    const tf = readFileSync(join(root, 'infra/terraform/backup.tf'), 'utf8');
    expect(tf).toMatch(/prefix = "files-volume\/" }\s+expiration \{ days = 91 \}/);
    expect(tf).toContain('"${aws_s3_bucket.backups.arn}/files-volume/*"');
    expect(tf).toContain('"s3:prefix" = ["dumps/*", "files-volume/*"]');
    expect(tf).not.toMatch(/s3:Delete/);
  });

  it('the timer fires nightly', () => {
    const timer = readFileSync(join(root, 'infra/instance/uptimo-files-backup.timer'), 'utf8');
    expect(timer).toMatch(/\[Timer\][\s\S]*OnCalendar=\*-\*-\* 20:30:00 UTC/);
  });
});

describe('files restore drill (infra/instance/files-restore.sh)', () => {
  it('restores the newest archive into a scratch volume and says SAME when it matches live', () => {
    const res = exec('files-restore.sh', ['drill']);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('RESTORED files-volume/files-2026-11-14T2030Z.tar.gz: 1 files');
    expect(res.stdout).toContain('SAME as the live volume');
    expect(log()).toContain('-v uptimo_files_drill:/data/files');
    expect(log()).not.toMatch(/-v uptimo_files:\/data\/files(?!:ro)/);
    expect(log()).toContain('docker volume rm uptimo_files_drill');
  });

  it('says DIFFERENT when the live volume holds something the archive does not', () => {
    const res = exec('files-restore.sh', ['drill'], { LIVE_LIST: '5 ./a.png\n9 ./b.png' });
    expect(res.stdout).toContain('DIFFERENT from the live volume');
  });

  it('live mode writes into the real volume', () => {
    const res = exec('files-restore.sh', ['live']);
    expect(res.status).toBe(0);
    expect(log()).toMatch(/-v uptimo_files:\/data\/files -v .*:\/in:ro/);
  });

  it('stops when the bucket has no archive', () => {
    const res = exec('files-restore.sh', ['drill'], { NEWEST: 'None' });
    expect(res.status).toBe(1);
    expect(res.stdout).toMatch(/no archive/);
  });
});
