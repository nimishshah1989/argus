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
  trackerErrors,
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
      `AGENTS.md:2: names a process other than pstack (${label})`,
    ]);
  });

  it.each(['the dsh profile', 'pstack: Opus designs and reviews, Sonnet builds'])(
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
    expect(errors()).toEqual(['AGENTS.md:2: names a process other than pstack (DeepSeek)']);
    expect(() => readDocs(['docs/nope.md'], root)).toThrow('docs: missing docs/nope.md');
  });

  it("the repository's instruction and stack files pass", () => {
    expect(processErrors(readDocs(instructionPaths()))).toEqual([]);
    expect(drizzleErrors(readDocs([...STACK_FILES]))).toEqual([]);
  });

  describe('tracker against merged commits', () => {
    const tracker = (status: string): string =>
      `## Progress tracker\n\n| #   | Ticket | Milestone | Status | PR |\n| --- | --- | --- | --- | --- |\n| 52  | Nudges | M4b | ${status} | #405 |\n| 53  | Other | M4b | todo | |\n\n## Next\n\n| 99 | Not a tracker row | M9 | todo | |\n`;

    it('fails a todo row whose ticket has a feat commit, and names the ticket', () => {
      const errors = trackerErrors(tracker('todo'), [
        'feat(52c): an accepted nudge opens a ticket',
      ]);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('ticket 52');
      expect(errors[0]).toContain('todo');
    });

    it('fails a todo row whose ticket has a fix commit', () => {
      expect(trackerErrors(tracker('todo'), ['fix(52): a nudge bug'])).toHaveLength(1);
    });

    it.each(['in progress', 'done', 'parked'])('passes when the row says %s', (status) => {
      expect(trackerErrors(tracker(status), ['feat(52c): x'])).toEqual([]);
    });

    it('does not count a docs commit, a plan is not a build', () => {
      expect(trackerErrors(tracker('todo'), ['docs(52): plan the nudges'])).toEqual([]);
    });

    it.each([
      ['feat(52c): x', 52],
      ['feat(52): x', 52],
      ['fix(53.5): x', 53],
    ])('maps %s to its ticket %i', (subject, ticket) => {
      expect(trackerErrors(tracker('todo'), [subject]).join()).toContain(`ticket ${ticket}`);
    });

    it('ignores subjects with no ticket number, tickets with no row and rows outside the tracker', () => {
      expect(
        trackerErrors(tracker('todo'), [
          'chore: tidy',
          'feat(web): x',
          'feat(77): x',
          'feat(99): x',
        ]),
      ).toEqual([]);
    });

    it('passes with no commits', () => {
      expect(trackerErrors(tracker('todo'), [])).toEqual([]);
    });
  });
});
