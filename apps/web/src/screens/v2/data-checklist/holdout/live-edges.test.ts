import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Point } from '../../../../ui/v2/points.js';
import { keyReply } from '../../printed-page/key-reply.js';
import { realT } from '../../printed-page/test-support.js';
import { checklistModel, itemsOf, type ChecklistItem } from '../adapter.js';
import { KEY, liveChecklist } from '../live.js';
import type { DataChecklistModel } from '../model.js';

const say = (point: Point) => point.map((seg) => seg.text).join('');
const ASOF = '2026-11-20';
const run = (items: ChecklistItem[]) => checklistModel(items, ASOF, realT);
/** A breakdown item: `head` is `"<date> · <machine>"`, as the engine prints it. */
const bd = (group: string, id: string, head: string, what = 'missing') => ({
  group,
  key: `${group}|${id}`,
  plain: `${head} — ${what}`,
});
const mc = (group: string, code: string, what = 'location missing') => ({
  group,
  key: `${group}|machines|${code}`,
  plain: `${code} — ${what}`,
});

describe('Data Checklist live adapter: the engine’s own answer key (11-Nov-2026 plant)', () => {
  const file = JSON.parse(
    readFileSync(
      new URL('../../../../../../../fixtures/answer-key/data-checklist.json', import.meta.url),
      'utf8',
    ),
  ) as { asOf: string; extra: { counts: Record<string, number>; items: ChecklistItem[] } };
  let model: DataChecklistModel;
  beforeAll(() => {
    model = liveChecklist(keyReply(KEY, 1, { asOf: file.asOf, ...file.extra }), realT);
  });

  it('counts what the platform printed: 245 to do, 136 log, 86 machines, 23 analysis', () => {
    expect(model.kpis.map((k) => k.value)).toEqual(['245', '136', '86', '23']);
    expect(model.records).toHaveLength(245);
    expect(new Set(model.records.map((r) => r.id)).size).toBe(245);
  });

  it('keeps every failing group as a check and every other as passing', () => {
    const checks = model.groups.flatMap((g) => g.checks);
    expect(checks).toHaveLength(11);
    expect(model.passing).toHaveLength(5);
    expect(model.groups.map((g) => g.summary)).toEqual(['4 gaps · 2 checks', '4 gaps', '1 gap']);
    expect(say(model.verdict.headline)).toBe(
      '5 of 16 data checks pass. 9 gaps change figures you see today.',
    );
    for (const check of checks)
      expect(Number(check.records)).toBe(file.extra.counts[check.id as string]);
  });

  it('puts the oldest breakdown first and names its machine in the verdict', () => {
    expect(model.records[0]!.id).toBe('bd_done|bd_muxluadaa9mn9');
    expect(model.records[0]!.open).toEqual({ shown: '314 days', value: 314 });
    expect(say(model.verdict.why[1]!)).toBe('The oldest record has been open 314 days: VC-22');
    const values = model.records.map((r) => r.open.value);
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  it('ages "log not updated since" from the first missing day', () => {
    const latest = model.records.find((r) => r.id === 'log_gap|latest|07-11-2026')!;
    expect(latest.open).toEqual({ shown: '3 days', value: 3 });
    expect(latest.what).toBe('log not updated since 07-11-2026');
  });

  it('never prints an engine key or a database id as a chip', () => {
    for (const record of model.records)
      expect(record.entity.label).not.toMatch(/\||bd_live_|bd_mux/);
  });
});

describe('Data Checklist live adapter: edges', () => {
  it('is all clear when nothing is missing', () => {
    const model = run([]);
    expect(model.groups).toEqual([]);
    expect(model.records).toEqual([]);
    expect(model.passing).toHaveLength(16);
    expect(say(model.verdict.headline)).toBe('Every check passes. The figures can be trusted.');
    expect(model.verdict.why).toEqual([]);
    expect(model.kpis.map((k) => k.value)).toEqual(['0', '0', '0', '0']);
    expect(model.words.passingSub).toBe('16 checks pass');
  });

  it('says one gap in the singular, and no gap when only checks fail', () => {
    expect(say(run([bd('bd_hrs', 'a', '19-11-2026 · VC-1')]).verdict.headline)).toBe(
      '15 of 16 data checks pass. 1 gap changes figures you see today.',
    );
    expect(say(run([bd('bd_obs', 'a', '19-11-2026 · VC-1')]).verdict.headline)).toBe(
      '15 of 16 data checks pass. What fails changes no figure, but is worth a look.',
    );
  });

  it('names four machines once each, then "and N more"', () => {
    const items = ['VC-1', 'VC-2', 'VC-1', 'VC-3', 'VC-4', 'VC-5', 'VC-6'].map((m, i) =>
      bd('bd_shift', String(i), `19-11-2026 · ${m}`),
    );
    const state = run(items).groups[0]!.checks[0]!.state;
    expect(say(state)).toBe('VC-1 VC-2 VC-3 VC-4 and 2 more');
    expect(state.filter((s) => s.entity).map((s) => s.entity!.label)).toEqual([
      'VC-1',
      'VC-2',
      'VC-3',
      'VC-4',
    ]);
    expect(run(items).groups[0]!.checks[0]!.records).toBe('7');
  });

  it('prints a dash for a breakdown with no date and sorts it after every dated record', () => {
    const model = run([
      bd('bd_date', 'x', 'No date · VC-9', 'date missing or invalid'),
      bd('bd_code', 'y', '20-11-2026 · VC-8'),
    ]);
    expect(model.records.map((r) => [r.id, r.open.shown, r.what])).toEqual([
      ['bd_code|y', '0 days', '20-Nov-2026 · missing'],
      ['bd_date|x', '—', 'No date · date missing or invalid'],
    ]);
    expect(model.records[1]!.open.value).toBeLessThan(0);
  });

  it('ranks the part with more gaps first even when it is later in v1 order', () => {
    const model = run([
      bd('bd_obs', 'a', '19-11-2026 · VC-1'),
      mc('mc_loc', 'BS-1'),
      mc('mc_cell', 'BS-2', 'cell missing'),
    ]);
    expect(model.groups.map((g) => [g.id, g.summary])).toEqual([
      ['machines', '2 gaps'],
      ['log', '1 check'],
    ]);
  });

  it('groups counts of a thousand and more the Indian way', () => {
    const items = Array.from({ length: 1234 }, (_, i) => mc('mc_loc', `M-${i}`));
    const model = run(items);
    expect(model.kpis[0]!.value).toBe('1,234');
    expect(model.kpis[2]!.value).toBe('1,234');
    expect(model.groups[0]!.checks[0]!.records).toBe('1,234');
  });

  it('reads only well-formed items of the sixteen groups', () => {
    expect(itemsOf(null)).toEqual([]);
    expect(itemsOf('x')).toEqual([]);
    expect(itemsOf({ counts: {}, items: 'x' })).toEqual([]);
    const good = mc('mc_loc', 'BS-1');
    expect(
      itemsOf({
        items: [
          good,
          null,
          { group: 'zz', key: 'zz|1', plain: 'x — y' },
          { group: 'mc_dim', key: 'mc_dim|1' },
          { group: 'mc_dim', key: 3, plain: 'x — y' },
        ],
      }),
    ).toEqual([good]);
  });
});
