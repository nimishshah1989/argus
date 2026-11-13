import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('union merge', () => {
  it('merges two appended wiki/log.md lines without a conflict', () => {
    const dir = mkdtempSync(join(tmpdir(), 'union-merge-'));
    const git = (...args: string[]): string =>
      execFileSync(
        'git',
        ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', ...args],
        {
          cwd: dir,
          encoding: 'utf8',
        },
      );
    const log = join(dir, 'wiki/log.md');
    const append = (text: string, message: string): void => {
      writeFileSync(log, readFileSync(log, 'utf8') + text);
      git('commit', '-qam', message);
    };
    git('init', '-q', '-b', 'main');
    mkdirSync(join(dir, 'wiki'));
    copyFileSync('.gitattributes', join(dir, '.gitattributes'));
    writeFileSync(log, 'base\n');
    git('add', '.');
    git('commit', '-qm', 'base');
    git('checkout', '-qb', 'a');
    append('line a\n', 'a');
    git('checkout', '-q', 'main');
    append('line b\n', 'b');
    git('merge', 'a', '--no-edit');
    const merged = readFileSync(log, 'utf8');
    for (const line of ['base', 'line a', 'line b']) expect(merged).toContain(line);
  });
});
