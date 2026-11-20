import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const root = join(import.meta.dirname, '..');
const jobs = parse(readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8')).jobs;
type Step = {
  run?: string;
  uses?: string;
  env?: Record<string, string>;
  with?: { name?: string; path?: string; key?: string };
};
const stepsOf = (job: string): Step[] => jobs[job].steps;
const runOf = (job: string, start: string) =>
  stepsOf(job).find((step) => step.run?.startsWith(start));

describe('the CI gallery job', () => {
  it('runs in four shards, each failing alone, within the 15 minute limit', () => {
    expect(jobs.gallery.strategy.matrix.shard).toEqual([1, 2, 3, 4]);
    expect(jobs.gallery.strategy['fail-fast']).toBe(false);
    expect(jobs.gallery['timeout-minutes']).toBe(15);
  });

  it('gives each shard its quarter of the specs and its own diffs artifact', () => {
    expect(runOf('gallery', 'pnpm gallery:test')?.run).toBe(
      'pnpm gallery:test --shard=${{ matrix.shard }}/4',
    );
    const upload = stepsOf('gallery').find((step) =>
      step.uses?.startsWith('actions/upload-artifact'),
    );
    expect(upload?.with?.name).toBe('gallery-diffs-${{ matrix.shard }}');
  });

  it('builds no production site in a shard; its own job runs the one spec that needs it', () => {
    expect(runOf('gallery', 'pnpm gallery:test')?.env?.GALLERY_PROD).toBe('off');
    expect(runOf('gallery-prod', 'pnpm gallery:test')?.env?.GALLERY_PROD).toBe('only');
  });

  it('installs the pinned fonts from the script, not with apt-get update', () => {
    expect(runOf('gallery', 'bash tools/install-fonts.sh')).toBeDefined();
    for (const step of stepsOf('gallery')) expect(step.run ?? '').not.toMatch(/apt-get/);
  });
});

describe('the pinned fonts cache', () => {
  const warm = parse(readFileSync(join(root, '.github/workflows/warm-fonts-cache.yml'), 'utf8'));
  const fontStep = (steps: Step[]) =>
    steps.find((s) => s.run?.startsWith('bash tools/install-fonts.sh'));
  const cacheStep = (steps: Step[]) => steps.find((s) => s.uses?.startsWith('actions/cache@'));

  it('restores the two font files before the gallery installs them, from the folder the script reads', () => {
    const steps = stepsOf('gallery');
    const cache = cacheStep(steps);
    const font = fontStep(steps);
    expect(cache?.with?.key).toBe("fonts-debs-${{ hashFiles('tools/install-fonts.sh') }}");
    expect(steps.indexOf(cache!)).toBeLessThan(steps.indexOf(font!));
    expect(font?.env?.FONTS_DEB_DIR).toBe(cache?.with?.path);
  });

  it('is filled from main on a push, by hand, and daily, under the same key, path and image', () => {
    const on = warm.on;
    expect(on.push.branches).toEqual(['main']);
    expect(on.push.paths).toContain('tools/install-fonts.sh');
    expect(on).toHaveProperty('workflow_dispatch');
    expect(on.schedule).toHaveLength(1);
    const steps: Step[] = warm.jobs.warm.steps;
    expect(cacheStep(steps)?.with).toEqual(cacheStep(stepsOf('gallery'))?.with);
    expect(fontStep(steps)?.run).toBe('bash tools/install-fonts.sh --download-only');
    expect(fontStep(steps)?.env?.FONTS_DEB_DIR).toBe(cacheStep(steps)?.with?.path);
    expect(warm.jobs.warm.container.image).toBe(jobs.gallery.container.image);
  });
});

describe('tools/install-fonts.sh', () => {
  const script = join(root, 'tools/install-fonts.sh');
  const made: string[] = [];
  afterEach(() => {
    for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  /** Runs the script with stand-in curl, sha256sum, dpkg and apt-get that log their calls to `calls`. */
  function run(opts: {
    curlFails?: boolean;
    sumFails?: boolean;
    cached?: boolean;
    args?: string[];
  }) {
    const work = mkdtempSync(join(tmpdir(), 'fonts-'));
    made.push(work);
    const bin = join(work, 'bin');
    const cache = join(work, 'debs');
    const calls = join(work, 'calls');
    mkdirSync(bin);
    const stub = (name: string, body: string) => {
      writeFileSync(
        join(bin, name),
        `#!/usr/bin/env bash\necho "${name} $*" >> "${calls}"\n${body}\n`,
      );
      chmodSync(join(bin, name), 0o755);
    };
    stub(
      'curl',
      opts.curlFails
        ? 'exit 28'
        : 'while [ $# -gt 1 ]; do [ "$1" = -o ] && echo deb > "$2"; shift; done',
    );
    // Matches any file that exists, so a missing file is a miss and a fetched one verifies.
    stub('sha256sum', opts.sumFails ? 'exit 1' : 'read -r _ file; [ -s "$file" ]');
    for (const name of ['dpkg', 'apt-get']) stub(name, 'exit 0');
    if (opts.cached) {
      mkdirSync(cache);
      for (const f of ['fonts-noto-core_20201225-2_all.deb', 'fonts-noto-mono_20201225-2_all.deb'])
        writeFileSync(join(cache, f), 'deb');
    }
    let status = 0;
    try {
      execFileSync('bash', [script, ...(opts.args ?? [])], {
        env: { PATH: `${bin}:${process.env.PATH}`, FONTS_DEB_DIR: cache },
        stdio: 'pipe',
      });
    } catch (error) {
      status = (error as { status: number }).status;
    }
    const log = existsSync(calls) ? readFileSync(calls, 'utf8') : '';
    return {
      status,
      log,
      cache,
      has: (cmd: string) => log.split('\n').some((l) => l.startsWith(`${cmd} `)),
    };
  }

  it('downloads nothing when the cached files check out, and installs them', () => {
    const r = run({ cached: true });
    expect(r.has('curl')).toBe(false);
    expect(r.log).toMatch(/dpkg -i .*fonts-noto-mono.*fonts-noto-core/);
    expect(existsSync(r.cache)).toBe(true);
  });

  it('on a cache miss fetches both files with short timeouts and keeps them for the cache', () => {
    const r = run({});
    expect(r.log.match(/^curl /gm)).toHaveLength(2);
    expect(r.log).toMatch(/curl .*--connect-timeout 5 --max-time 30 --retry 1 /);
    expect(r.log).toMatch(/dpkg -i /);
    expect(existsSync(join(r.cache, 'fonts-noto-core_20201225-2_all.deb'))).toBe(true);
  });

  it('fails over to the second mirror quickly, then to apt, leaving no partial cache to save', () => {
    const r = run({ curlFails: true });
    expect(r.log.match(/^curl /gm)).toHaveLength(2);
    expect(r.log).toContain('archive.ubuntu.com/ubuntu/pool/main/f/fonts-noto/');
    expect(r.has('apt-get')).toBe(true);
    expect(existsSync(r.cache)).toBe(false);
  });

  it('refuses a file whose checksum does not match, even from the cache', () => {
    const r = run({ cached: true, sumFails: true });
    expect(r.has('curl')).toBe(true);
    expect(r.log).not.toContain('dpkg -i');
    expect(r.has('apt-get')).toBe(true);
  });

  it('with --download-only fills the folder and installs nothing; exits 1 when it cannot', () => {
    const ok = run({ args: ['--download-only'] });
    expect(ok.status).toBe(0);
    expect(ok.has('dpkg') || ok.has('apt-get')).toBe(false);
    expect(existsSync(ok.cache)).toBe(true);
    const bad = run({ curlFails: true, args: ['--download-only'] });
    expect(bad.status).toBe(1);
    expect(bad.has('apt-get')).toBe(false);
    expect(existsSync(bad.cache)).toBe(false);
  });
});

describe('the CI test shards', () => {
  it('splits the api and browser suites five ways, with the shard count in the command', () => {
    for (const job of ['api', 'browser']) {
      expect(jobs[job].strategy.matrix.shard).toEqual([1, 2, 3, 4, 5]);
      expect(jobs[job].name).toBe(`${job} (\${{ matrix.shard }}/5)`);
    }
    expect(runOf('api', 'pnpm exec vitest run')?.run).toContain('--shard=${{ matrix.shard }}/5');
    expect(runOf('browser', 'pnpm exec playwright test')?.run).toContain(
      '--shard=${{ matrix.shard }}/5',
    );
  });
});
