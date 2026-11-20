import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const root = join(import.meta.dirname, '..');
const jobs = parse(readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8')).jobs;
type Step = { run?: string; uses?: string; env?: Record<string, string>; with?: { name?: string } };
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
