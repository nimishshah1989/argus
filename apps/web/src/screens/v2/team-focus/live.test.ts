import { beforeAll, describe, expect, it } from 'vitest';
import type { FocusNote } from '@uptimo/shared/team-focus-notes';
import { focusActions } from '../../analytics/team-focus-actions.js';
import { NotComputed } from '../figures/live-error.js';
import { keyReply } from '../printed-page/key-reply.js';
import type { FiguresPart } from '../printed-page/printed.js';
import { realT } from '../printed-page/test-support.js';
import { STATUS_OF, STORED_OF, teamFocusModel, withNotes } from './adapter.js';
import { focusPeriod, KEY, liveTeamFocus } from './live.js';
import type { TeamFocusModel } from './model.js';

/** A small month shaped exactly as the engine's `team-focus` figure (ADR 0020: with its `period`), run on 20-Nov-2026. */
const EXTRA = [
  {
    key: 'fc|m1|2026-12',
    lane: 'A',
    machine: 'm1',
    machineCode: 'VC-1',
    title: 'VC-1 (VMC): inspect before December 2026',
    stake: 6.09,
  },
  {
    key: 'fixm|m2|Coolant',
    lane: 'B',
    machine: 'm2',
    machineCode: 'TC-2',
    title: 'TC-2: coolant leak has come back 4 times',
    stake: 3.5,
  },
  {
    key: 'fixg|Spindle',
    lane: 'B',
    machine: 'm1',
    machineCode: 'VC-1',
    title: 'Spindle: one of the biggest losses',
    stake: 10,
  },
  {
    key: 'ovh|m3',
    lane: 'C',
    machine: 'm3',
    machineCode: 'BS-4',
    title: 'BS-4 (Saw): decide on overhaul or replacement',
    stake: 2.25,
  },
  {
    key: 'long|r9',
    lane: 'F',
    machine: 'm2',
    machineCode: 'TC-2',
    title: 'TC-2: 12.0 hrs breakdown on 10-11-2026 — Why-Why not done',
    stake: 1.5,
  },
  {
    key: 'data|multi',
    lane: 'E',
    title: '3 machine and problem pairs are logged four or more times',
    stake: 0,
  },
].map((action) => ({ ...action, status: 'open', owner: '', note: '' }));
const VALUE = { screen: KEY, asOf: '2026-11-20', period: '2026-12', pages: [], extra: EXTRA };
const REPLY: FiguresPart = keyReply(KEY, 1, VALUE, 'machine');

const AT = '2026-11-21T10:00:00.000Z';
const note = (status: FocusNote['status'], owner = '', text = ''): FocusNote => ({
  status,
  owner,
  note: text,
  at: AT,
});
const NOTES: Record<string, FocusNote> = {
  'fixg|Spindle': note('prog', 'Meera K', 'Ordered bearings'),
  'ovh|m3': note('done', 'Meera K'),
  'long|r9': note('open', 'Neel S'),
  'data|multi': note('skip', '', 'Known'),
  // A note on an action this month's figure no longer prints: kept on the server, never shown (ADR 0018 §6).
  'gone|x': note('done', 'Arjun V'),
};

const machine = (code: string) => ({ kind: 'machine', id: code, label: code });
const owner = (name: string) => ({ kind: 'person', id: `owner:${name}`, label: name });
const NO_DELTA = { text: '', up: false, good: false };
let model: TeamFocusModel;

describe('Team Focus live adapter (TF-2, ADR 0020)', () => {
  beforeAll(() => {
    model = liveTeamFocus(REPLY, NOTES, realT);
  });

  it('reads the engine actions through focusActions, lays the notes over them and builds the model', () => {
    const actions = withNotes(focusActions(VALUE), NOTES);
    expect(model).toEqual(teamFocusModel(actions, '2026-11-20', realT));
    expect(actions.map((a) => a.key)).toEqual(EXTRA.map((a) => a.key));
    expect(actions[2]).toMatchObject({
      status: 'prog',
      owner: 'Meera K',
      note: 'Ordered bearings',
    });
    expect(actions[0]).toMatchObject({ status: 'open', owner: '', note: '' });
  });

  it('maps the stored status words one to one, both ways', () => {
    expect(STATUS_OF).toEqual({ open: 'todo', prog: 'doing', done: 'done', skip: 'skip' });
    expect(STORED_OF).toEqual({ todo: 'open', doing: 'prog', done: 'done', skip: 'skip' });
  });

  it('reads the month the plan is for from the figure, and nothing when it has none', () => {
    expect(focusPeriod(REPLY)).toBe('2026-12');
    const { period: _period, ...noPeriod } = VALUE;
    expect(focusPeriod(keyReply(KEY, 1, noPeriod))).toBeNull();
    expect(
      focusPeriod(keyReply(KEY, 1, { ...VALUE, period: '2026-13' } as typeof VALUE)),
    ).toBeNull();
    expect(focusPeriod({ ...REPLY, figures: [] })).toBeNull();
  });

  it('says "not computed yet" for a missing, not-ready or empty figure, never an empty plan', () => {
    const held: FiguresPart = {
      ...REPLY,
      figures: [{ ...REPLY.figures[0]!, status: 'not_computed' as const }],
    };
    expect(() => liveTeamFocus(held, {}, realT)).toThrow(NotComputed);
    expect(() => liveTeamFocus({ ...REPLY, figures: [] }, {}, realT)).toThrow(NotComputed);
    const empty = keyReply(KEY, 1, { ...VALUE, extra: [] } as typeof VALUE, 'machine');
    expect(() => liveTeamFocus(empty, {}, realT)).toThrow(NotComputed);
  });

  it('lists every action in the engine order with its lane, machine, owner, status, hours and note', () => {
    expect(model.actions.map((a) => a.id)).toEqual(EXTRA.map((a) => a.key));
    expect(model.actions[0]).toEqual({
      id: 'fc|m1|2026-12',
      kind: 'inspect',
      kindLabel: 'Before next month',
      title: 'VC-1 (VMC): inspect before December 2026',
      chips: [machine('VC-1')],
      owner: null,
      status: 'todo',
      statusLabel: 'Not started',
      hours: { shown: '6.09 h', value: 6.09 },
      note: '',
    });
    expect(model.actions[2]).toMatchObject({
      kind: 'fix',
      kindLabel: 'Fix for good',
      owner: owner('Meera K'),
      status: 'doing',
      statusLabel: 'In progress',
      note: 'Ordered bearings',
    });
    expect(model.actions[3]).toMatchObject({ kind: 'decide', status: 'done', statusLabel: 'Done' });
    expect(model.actions[4]).toMatchObject({ kind: 'plan', kindLabel: 'Why-Why due' });
    expect(model.actions[5]).toMatchObject({
      kind: 'plan',
      kindLabel: 'Fix the record',
      chips: [],
      owner: null,
      status: 'skip',
      statusLabel: 'Not needed',
      note: 'Known',
    });
  });

  it('puts the open actions nobody owns first, biggest first, each with its lane hint and no invented owner or money', () => {
    expect(model.start.map((d) => d.id)).toEqual(['fc|m1|2026-12', 'fixm|m2|Coolant']);
    const hintA = realT('analytics.teamFocus.hint.A');
    expect(model.start[0]).toEqual({
      id: 'fc|m1|2026-12',
      kind: 'inspect',
      kindLabel: 'Before next month',
      codes: [machine('VC-1')],
      title: 'VC-1 (VMC): inspect before December 2026',
      keys: [{ text: 'No owner', tone: 'risk' }],
      why: [[{ text: hintA }]],
      detail: [[{ text: hintA }]],
      hours: '6.09 h',
      money: '',
      days: [],
      stripLabel: '',
      action: 'I’ll take it',
      doneText: 'Taken by you',
      owner: [{ text: 'Nobody owns it yet' }],
      decided: false,
    });
  });

  it('lists the owners the notes name, most open first, with no role and no invented load', () => {
    expect(model.people).toEqual([
      {
        chip: owner('Meera K'),
        role: '',
        open: 1,
        hours: { shown: '10.0 h', value: 10 },
        done: 1,
        load: null,
        loadLabel: '',
      },
      {
        chip: owner('Neel S'),
        role: '',
        open: 1,
        hours: { shown: '1.5 h', value: 1.5 },
        done: 0,
        load: null,
        loadLabel: '',
      },
    ]);
    expect(model.rebalance).toBeNull();
  });

  it('prints four key figures added up from the same actions, with no change and no trend it cannot know', () => {
    expect(model.kpis.map((k) => [k.id, k.icon, k.label, k.value, k.more])).toEqual([
      ['open', 'list', 'Open actions', '4', '1 in progress, 3 not started'],
      ['stake', 'clock', 'At stake a month', '21.09 h', realT('v2tf.kpi.stake.more')],
      [
        'unowned',
        'person',
        'No owner yet',
        '2',
        'The biggest: VC-1 (VMC): inspect before December 2026',
      ],
      ['progress', 'check', 'Done', '33%', '1 done, 1 marked not needed'],
    ]);
    for (const k of model.kpis) {
      expect(k.delta).toEqual(NO_DELTA);
      expect(k.period).toBe('');
      expect(k.trend).toBeUndefined();
      expect(k.meaning).toBe(realT(`v2tf.kpi.${k.id}.meaning`));
    }
  });

  it('counts an action with a status it does not know as open, never as closed', () => {
    const actions = withNotes(focusActions(VALUE), {}).map((a, i) =>
      i === 0 ? { ...a, status: 'x' } : a,
    );
    const odd = teamFocusModel(actions, '2026-11-20', realT);
    const kpi = (id: string) => odd.kpis.find((k) => k.id === id)?.value;
    expect(kpi('open')).toBe(String(actions.length));
    expect(kpi('progress')).toBe('0%');
    expect(odd.actions[0]).toMatchObject({ status: 'todo' });
  });

  it('answers first: what is open and at stake, who owns nothing, how much is closed, the biggest still open', () => {
    expect(model.verdict).toEqual({
      context: 'Figures as of 20-Nov-2026 · the month’s plan · whole plant',
      headline: [{ text: 'Open actions: 4, 21.09 h a month at stake. No owner yet: 2.' }],
      why: [
        [{ text: '2 of 4 open actions have no owner: 9.59 h a month waits for a name' }],
        [{ text: '2 of 6 actions are done or not needed (33%)' }],
        [{ text: 'The biggest still open: Spindle: one of the biggest losses, 10.0 h a month' }],
      ],
    });
    expect(model.source).toBe(
      'Figures as of 20-Nov-2026 · source: the engine’s Team Focus plan and the notes your team saved',
    );
  });

  it('takes every word from the catalogue, counts filled', () => {
    expect(model.words.why).toBe('Why?');
    expect(model.words.allOwned).toBe('Every open action has an owner.');
    expect(model.words.decisions).toEqual({
      why: 'Why?',
      title: 'Needs an owner',
      waiting: '{n} waiting · biggest first',
      done: '{n} of {total} taken',
      perMonth: 'a month',
      stripCaption: 'Breakdowns, last 90 days',
    });
    expect(model.words.decisionDetail).toEqual({
      worth: 'What it wins back',
      perMonth: 'a month',
      perYear: 'a year',
      last90: 'Last 90 days',
      stripCaption: 'Breakdowns, last 90 days',
      why: 'Why?',
    });
    expect(model.words.peopleTitle).toBe('Who is carrying what');
    expect(model.words.people).toEqual({
      title: 'Who is carrying what',
      search: 'Search 2 people',
      showing: '{from}–{to} of {total}',
      noResults: 'No one matches this filter.',
      open: 'Open',
      columns: {
        person: 'Person',
        open: 'Open actions',
        hours: 'Hours a month',
        done: 'Closed',
        load: 'Load',
      },
      filters: { all: 'All', over: 'Overloaded', room: 'Has room' },
    });
    expect(model.words.actions).toEqual({
      title: 'Every action this month',
      search: 'Search 6 actions',
      showing: '{from}–{to} of {total}',
      noResults: 'No action matches this filter.',
      open: 'Open',
      columns: { action: 'Action', owner: 'Owner', status: 'Status', hours: 'Hours a month' },
      filters: { all: 'All', noOwner: 'No owner', doing: 'In progress', done: 'Done' },
      noOwner: 'Nobody yet',
    });
  });
});
