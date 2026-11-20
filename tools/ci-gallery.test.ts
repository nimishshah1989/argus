import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const root = join(import.meta.dirname, '..');
const gallery = parse(readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8')).jobs.gallery;
const steps: { run?: string; uses?: string; with?: { name?: string } }[] = gallery.steps;

describe('the CI gallery job', () => {
  it('runs in two shards, each failing alone, within the 15 minute limit', () => {
    expect(gallery.strategy.matrix.shard).toEqual([1, 2]);
    expect(gallery.strategy['fail-fast']).toBe(false);
    expect(gallery['timeout-minutes']).toBe(15);
  });

  it('gives each shard its half of the specs and its own diffs artifact', () => {
    const test = steps.find((step) => step.run?.startsWith('pnpm gallery:test'));
    expect(test?.run).toBe('pnpm gallery:test --shard=${{ matrix.shard }}/2');
    const upload = steps.find((step) => step.uses?.startsWith('actions/upload-artifact'));
    expect(upload?.with?.name).toBe('gallery-diffs-${{ matrix.shard }}');
  });
});
