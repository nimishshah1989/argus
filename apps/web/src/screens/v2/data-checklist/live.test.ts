import { beforeAll, describe, expect, it } from 'vitest';
import type { Point } from '../../../ui/v2/points.js';
import { NotComputed } from '../figures/live-error.js';
import { keyReply } from '../printed-page/key-reply.js';
import type { FiguresPart } from '../printed-page/printed.js';
import { realT } from '../printed-page/test-support.js';
import { checklistModel, itemsOf, type ChecklistItem } from './adapter.js';
import { KEY, liveChecklist } from './live.js';
import type { DataChecklistModel } from './model.js';

/** A small reply shaped exactly as the engine's `data-checklist` figure (ADR 0017), run on 20-Nov-2026. */
const ITEMS: ChecklistItem[] = [
  { group: 'bd_hrs', key: 'bd_hrs|r1', plain: '10-11-2026 · VC-1 — downtime hours missing' },
  { group: 'bd_hrs', key: 'bd_hrs|r2', plain: '18-11-2026 · VC-2 — downtime hours missing' },
  { group: 'bd_obs', key: 'bd_obs|r1', plain: '10-11-2026 · VC-1 — Observed By missing' },
  {
    group: 'log_gap',
    key: 'log_gap|01-11-2026|05-11-2026',
    plain: '01-11-2026 to 05-11-2026 — 5 days with no entries',
  },
  { group: 'ww', key: 'ww|r3', plain: '19-11-2026 · TC-3 — 12.0 hrs, Why-Why not done' },
  { group: 'mc_age', key: 'mc_age|machines|m1', plain: 'BS-04 — purchase date or year missing' },
  { group: 'mc_pw', key: 'mc_pw|machines|m1', plain: 'BS-04 — power missing' },
  { group: 'mc_pw', key: 'mc_pw|dgMachines|m2', plain: 'DG-1 — capacity (kVA) missing' },
];
const VALUE = {
  counts: { bd_hrs: 2, bd_obs: 1, log_gap: 1, ww: 1, mc_age: 1, mc_pw: 2 },
  items: ITEMS,
};
const REPLY: FiguresPart = keyReply(KEY, 1, { asOf: '2026-11-20', ...VALUE });
let model: DataChecklistModel;

const say = (point: Point) => point.map((seg) => seg.text).join('');
const chips = (point: Point) => point.flatMap((seg) => (seg.entity ? [seg.entity.label] : []));
const role = (id: string, label: string) => ({ kind: 'person', id: `role:${id}`, label });
const SUPERVISOR = role('supervisor', 'Supervisor');
const ADMIN = role('admin', 'Admin');
const HEAD = role('head', 'Head');

describe('Data Checklist live adapter (DC-1)', () => {
  beforeAll(() => {
    model = liveChecklist(REPLY, realT);
  });

  it('reads the figure value through itemsOf and checklistModel', () => {
    expect(itemsOf(VALUE)).toEqual(ITEMS);
    expect(model).toEqual(checklistModel(ITEMS, '2026-11-20', realT));
  });

  it('says "not computed yet" for a missing or not-ready figure, never an empty plant', () => {
    const held: FiguresPart = {
      ...REPLY,
      figures: [{ ...REPLY.figures[0]!, status: 'not_computed' as const }],
    };
    expect(() => liveChecklist(held, realT)).toThrow(NotComputed);
    expect(() => liveChecklist({ ...REPLY, figures: [] }, realT)).toThrow(NotComputed);
  });

  it('lists the failing parts of the data, most gaps first, ties in v1 order, gaps before checks', () => {
    expect(model.groups.map((g) => g.id)).toEqual(['log', 'machines', 'analysis']);
    expect(model.groups.map((g) => g.name)).toEqual([
      'Breakdown log',
      'Machines and utilities',
      'Analysis',
    ]);
    expect(model.groups.map((g) => g.summary)).toEqual(['2 gaps · 1 check', '2 gaps', '1 gap']);
    expect(model.groups.map((g) => g.checks.map((c) => c.id))).toEqual([
      ['bd_hrs', 'log_gap', 'bd_obs'],
      ['mc_age', 'mc_pw'],
      ['ww'],
    ]);
  });

  it('prints owners as roles, never invented people', () => {
    expect(model.groups.map((g) => g.owner)).toEqual([SUPERVISOR, ADMIN, HEAD]);
    for (const group of model.groups)
      for (const check of group.checks) expect(check.owner).toEqual(group.owner);
  });

  it('fills each check from the engine group: title, gap or check, count, impact, why, fix, never done', () => {
    const [hours, gap, observed] = model.groups[0]!.checks;
    expect(hours).toEqual({
      id: 'bd_hrs',
      status: 'gap',
      statusLabel: 'Gap',
      title: 'Breakdown entries with no downtime hours',
      state: hours!.state,
      impact: 'Changes downtime and MTTR',
      records: '2',
      recordsNote: 'records to fix',
      owner: SUPERVISOR,
      why: [[{ text: 'Downtime with no hours makes total downtime and MTTR too low.' }]],
      fix: 'Open the entries',
      doneText: '',
      done: false,
    });
    expect(chips(hours!.state)).toEqual(['VC-1', 'VC-2']);
    expect(say(hours!.state)).toBe('VC-1 VC-2');
    expect(say(gap!.state)).toBe('5 days with no entries');
    expect(observed!.status).toBe('check');
    expect(observed!.statusLabel).toBe('Check');
    expect(observed!.recordsNote).toBe('record to fix');
    const power = model.groups[1]!.checks[1]!;
    expect(chips(power.state)).toEqual(['BS-04', 'DG-1']);
    expect(power.fix).toBe('Open the machine records');
  });

  it('lists every record, oldest first, machine records last with a dash', () => {
    expect(model.records.map((r) => r.id)).toEqual([
      'log_gap|01-11-2026|05-11-2026',
      'bd_hrs|r1',
      'bd_obs|r1',
      'bd_hrs|r2',
      'ww|r3',
      'mc_age|machines|m1',
      'mc_pw|machines|m1',
      'mc_pw|dgMachines|m2',
    ]);
    expect(model.records.map((r) => r.open)).toEqual([
      { shown: '19 days', value: 19 },
      { shown: '10 days', value: 10 },
      { shown: '10 days', value: 10 },
      { shown: '2 days', value: 2 },
      { shown: '1 day', value: 1 },
      { shown: '—', value: -1 },
      { shown: '—', value: -1 },
      { shown: '—', value: -1 },
    ]);
  });

  it('keeps the date of a breakdown record and chips its machine', () => {
    const byId = (id: string) => model.records.find((r) => r.id === id)!;
    expect(byId('bd_hrs|r1')).toEqual({
      id: 'bd_hrs|r1',
      entity: { kind: 'machine', id: 'VC-1', label: 'VC-1' },
      what: '10-Nov-2026 · downtime hours missing',
      area: { key: 'log', label: 'Breakdown log' },
      owner: SUPERVISOR,
      open: { shown: '10 days', value: 10 },
    });
    expect(byId('ww|r3').what).toBe('19-Nov-2026 · 12.0 hrs, Why-Why not done');
    expect(byId('ww|r3').area).toEqual({ key: 'analysis', label: 'Analysis' });
    expect(byId('ww|r3').owner).toEqual(HEAD);
    expect(byId('mc_pw|dgMachines|m2')).toEqual({
      id: 'mc_pw|dgMachines|m2',
      entity: { kind: 'machine', id: 'DG-1', label: 'DG-1' },
      what: 'capacity (kVA) missing',
      area: { key: 'machines', label: 'Machines and utilities' },
      owner: ADMIN,
      open: { shown: '—', value: -1 },
    });
    expect(byId('log_gap|01-11-2026|05-11-2026').entity).toEqual({
      kind: 'decision',
      id: 'log_gap|01-11-2026|05-11-2026',
      label: '01-Nov-2026 to 05-Nov-2026',
    });
    expect(byId('log_gap|01-11-2026|05-11-2026').what).toBe('5 days with no entries');
  });

  it("prints v1's four counts as KPIs, with no change and no trend (no earlier figure)", () => {
    expect(model.kpis.map((k) => [k.id, k.label, k.value])).toEqual([
      ['records', 'Records to fix', '8'],
      ['log', 'Breakdown log', '4'],
      ['machines', 'Machines and utilities', '3'],
      ['analysis', 'Analysis', '1'],
    ]);
    for (const kpi of model.kpis) {
      expect(kpi.delta).toEqual({ text: '', up: false, good: false });
      expect(kpi.period).toBe('');
      expect(kpi.trend).toBeUndefined();
      expect(kpi.meaning).not.toBe('');
    }
  });

  it('says the verdict, the passing checks and the source from the data', () => {
    expect(model.verdict.context).toBe('20-Nov-2026 · whole plant');
    expect(say(model.verdict.headline)).toBe(
      '10 of 16 data checks pass. 5 gaps change figures you see today.',
    );
    expect(model.verdict.why.map(say)).toEqual([
      'Breakdown log has the most to fix: 4 records',
      'The oldest record has been open 19 days: 01-Nov-2026 to 05-Nov-2026',
    ]);
    expect(model.passing.map(say)).toEqual([
      'Every breakdown entry has a valid date',
      'Every breakdown entry names a machine in the register',
      'Every breakdown entry has a maintenance code',
      'Every breakdown entry says who did the work',
      'Every breakdown entry describes the problem',
      'Every breakdown entry has a shift',
      'Every breakdown is typed Electrical or Mechanical',
      'Every machine has its length and width',
      'Every machine has a cell',
      'Every machine has a location',
    ]);
    expect(model.source).toBe(
      'Figures as of 20-Nov-2026 · source: the Breakdown Log and machine records',
    );
  });

  it('brings every word from the catalogue', () => {
    expect(model.words).toEqual({
      why: 'Why?',
      check: { why: 'Why it matters', owner: 'Owner' },
      allClear: 'Every check passes. The figures can be trusted.',
      passingTitle: 'Already trusted',
      passingSub: '10 checks pass',
      ownerIs: 'Owner',
      records: {
        title: 'Records to fix',
        search: 'Search 8 records',
        showing: '{from}–{to} of {total}',
        noResults: 'No record matches this search and filter.',
        open: 'Open',
        columns: { record: 'Record', area: 'Part of the data', owner: 'Owner', open: 'Open for' },
        all: 'All',
      },
    });
  });

  it('never chips a machine the register does not know (bd_mach): a dash, no id, no drill', () => {
    const LOST = 'f3c2a1d0-0000-4000-8000-00000000abcd';
    const lost: ChecklistItem[] = [
      { group: 'bd_mach', key: 'bd_mach|r9', plain: `12-11-2026 · ${LOST} — machine ID "${LOST}" not found` },
      { group: 'bd_hrs', key: 'bd_hrs|r9', plain: `12-11-2026 · ${LOST} — downtime hours missing` },
      { group: 'ww', key: 'ww|r9', plain: `12-11-2026 · ${LOST} — 9.0 hrs, Why-Why not done` },
      { group: 'bd_hrs', key: 'bd_hrs|r1', plain: '10-11-2026 · VC-1 — downtime hours missing' },
    ];
    const m = checklistModel(lost, '2026-11-20', realT);
    for (const id of ['bd_mach|r9', 'bd_hrs|r9', 'ww|r9']) {
      const record = m.records.find((r) => r.id === id)!;
      expect(record.entity).toEqual({ kind: 'decision', id, label: '—' });
      expect(record.open).toEqual({ shown: '8 days', value: 8 });
    }
    const allChips = m.groups.flatMap((g) => g.checks.flatMap((c) => chips(c.state)));
    expect(allChips).toEqual(['VC-1']);
    expect(allChips.join(' ')).not.toContain(LOST);
    expect(m.records.find((r) => r.id === 'bd_hrs|r1')!.entity.kind).toBe('machine');
  });
});
