import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  STACK_FILES,
  drizzleErrors,
  instructionPaths,
  processErrors,
  readDocs,
} from './check-docs.js';

describe('docs check', () => {
  it.each([
    ['route to DeepSeek Flash', 'DeepSeek'],
    ['the OpenRouter provider', 'OpenRouter'],
    ['nemotron-3', 'nemotron'],
    ['local TwIL', 'TwIL'],
    ['ollama/x', 'ollama'],
    ['the hosted free coder', 'free coder'],
    ['in DSH', 'DSH'],
  ])('flags another process in an instruction file: %s', (line, label) => {
    expect(processErrors([{ path: 'AGENTS.md', text: `intro\n${line}` }])).toEqual([
      `AGENTS.md:2: names a process other than Athena v3 (${label})`,
    ]);
  });

  it.each(['the dsh profile', 'Athena v3: Opus plans and reviews, Sonnet builds'])(
    'accepts %s',
    (line) => {
      expect(processErrors([{ path: 'AGENTS.md', text: line }])).toEqual([]);
    },
  );

  it('fails a stack document that names Drizzle', () => {
    expect(drizzleErrors([{ path: 'THIRD_PARTY.md', text: '| Drizzle ORM | database |' }])).toEqual(
      ['THIRD_PARTY.md:1: names Drizzle; the repo uses raw SQL on pg (D02)'],
    );
  });

  it('goes red on a planted marker in a temp root and green without it', () => {
    const root = mkdtempSync(join(tmpdir(), 'docs-check-'));
    for (const path of [...instructionPaths(root), ...STACK_FILES]) {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), 'clean\n');
    }
    const errors = (): string[] => processErrors(readDocs(instructionPaths(root), root));
    expect(errors()).toEqual([]);
    writeFileSync(join(root, 'AGENTS.md'), 'clean\nroute to DeepSeek\n');
    expect(errors()).toEqual(['AGENTS.md:2: names a process other than Athena v3 (DeepSeek)']);
    expect(() => readDocs(['docs/nope.md'], root)).toThrow('docs: missing docs/nope.md');
  });

  it("the repository's instruction and stack files pass", () => {
    expect(processErrors(readDocs(instructionPaths()))).toEqual([]);
    expect(drizzleErrors(readDocs([...STACK_FILES]))).toEqual([]);
  });
});
