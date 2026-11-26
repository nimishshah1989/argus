// @vitest-environment node
import i18next, { type TFunction } from 'i18next';
import { gu } from '@uptimo/shared/i18n';
import { describe, expect, it } from 'vitest';
import { realT } from '../printed-page/test-support.js';
import { machineRow, otherWorkModel, reportModel, tabsModel } from '../floor/adapter.js';
import {
  FLOOR_OPERATOR,
  FLOOR_TECH,
  PM_JOB,
  SUPPORT,
  floorTicket,
  reportInput,
} from '../floor/fixture.js';
import {
  EMPTY_OTHER_WORK,
  currentTab,
  floorTabKeys,
  floorWaiting,
  otherWorkLocation,
  otherWorkReady,
  reporterName,
  rowOpens,
  sendReady,
  startStep,
  ticketPlace,
} from '../floor/model.js';

/** ADR 0045 T1 (S27-A) edges: what a builder satisfying only the visible tests would get wrong. */
const machine = (code: string) => FLOOR_OPERATOR.config.machines.find((m) => m.code === code)!;
const browse = (query: string) => {
  const step = reportModel(FLOOR_OPERATOR, reportInput({ query }), realT).machine;
  if (step.kind !== 'browse') throw new Error('expected browse');
  return step;
};

describe('S27 floor report: permissions', () => {
  it('no PM jobs tab while the login still loads (no role yet)', () => {
    expect(floorTabKeys(undefined)).toEqual(['report', 'mine']);
    expect(tabsModel(undefined, '/floor', realT).tabs.map((t) => t.key)).toEqual([
      'report',
      'mine',
    ]);
  });

  it('the path lights its tab; anything else lights Report', () => {
    expect(currentTab('/floor/mine')).toBe('mine');
    expect(currentTab('/floor/pm')).toBe('pm');
    expect(currentTab('/floor')).toBe('report');
    expect(currentTab('/floor/other')).toBe('report');
  });

  it('an operator never gets the start-now box on Other work either, even with it set', () => {
    const op = otherWorkModel(
      FLOOR_OPERATOR,
      { form: EMPTY_OTHER_WORK, startNow: true, sent: null },
      realT,
    );
    expect(op.who).toEqual({ kind: 'reportingAs', text: 'Reporting as Omi (Operator)' });
    const tech = otherWorkModel(
      FLOOR_TECH,
      { form: EMPTY_OTHER_WORK, startNow: false, sent: null },
      realT,
    );
    expect(tech.who).toMatchObject({ kind: 'startNow', checked: false });
  });
});

describe('S27 floor report: data rules', () => {
  it('a PM job on a machine is never "already reported": the row runs and goes on to Step 2', () => {
    const row = machineRow(FLOOR_OPERATOR, machine('CMP-01'), realT);
    expect(PM_JOB.machineId).toBe(machine('CMP-01').id);
    expect(row).toMatchObject({
      status: 'running',
      opens: 'situation',
      detail: 'Compressors · Utility',
    });
  });

  it('a row opens the sheet only for an open breakdown that is not a support ticket', () => {
    expect(rowOpens(undefined)).toBe('situation');
    expect(rowOpens(SUPPORT)).toBe('situation');
    expect(rowOpens(floorTicket({ id: 'x', status: 'working' }))).toBe('sheet');
  });

  it('a deep link that found a machine opens Step 2; none opens Step 1', () => {
    expect(startStep(null)).toBe(0);
    expect(startStep(machine('CNC-01'))).toBe(1);
    expect(reportModel(FLOOR_OPERATOR, reportInput(), realT).start).toBe(0);
  });

  it('search ignores spaces, dashes and case; the no-match line only for a non-blank query', () => {
    expect(browse(' cnc 0-1 ').rows.map((r) => r.code)).toEqual(['CNC-01']);
    expect(browse('zz').noMatch).toBe(
      'No machine matches “zz”. Check the number, or pick the group below.',
    );
    expect(browse('zz').rows).toEqual([]);
    expect(browse('').noMatch).toBeNull();
    expect(browse('').rows).toEqual([]);
  });

  it('hidden groups and segments with no machines are dropped', () => {
    const codes = browse('').segments.flatMap((s) => s.groups.map((g) => g.code));
    expect(codes).not.toContain('OLD');
    expect(codes).not.toContain('NONE');
  });

  it('inside a group the number alone finds the machine; the example is the middle machine', () => {
    const group = FLOOR_OPERATOR.config.groups.find((g) => g.code === 'CNC')!;
    const step = reportModel(FLOOR_OPERATOR, reportInput({ group, query: '3' }), realT).machine;
    if (step.kind !== 'group') throw new Error('expected group');
    expect(step.title).toBe('CNC CNC lathes');
    expect(step.back).toBe('Groups');
    expect(step.rows.map((r) => r.code)).toEqual(['CNC-03']);
    expect(step.placeholder).toBe('e.g. CNC-02');
  });

  it('a blank-once-trimmed problem never enables Send', () => {
    expect(sendReady(false, '   \n ')).toBe(false);
    const step = reportModel(
      FLOOR_OPERATOR,
      reportInput({ machine: machine('CNC-01'), problem: '   ' }),
      realT,
    ).problem;
    expect(step.ready).toBe(false);
    expect(step.upgradeText).toBeNull();
  });

  it('the typed place wins once trimmed; a blank typed place falls back to the picked cell', () => {
    const form = { ...EMPTY_OTHER_WORK, place: 'Cell 2', workType: 'Preventive', needed: 'Fan' };
    expect(otherWorkLocation({ ...form, typed: '  Bay 3 ' })).toBe('Bay 3');
    expect(otherWorkLocation({ ...form, typed: '   ' })).toBe('Cell 2');
    expect(otherWorkReady({ ...form, place: '', typed: '   ' })).toBe(false);
    expect(otherWorkReady({ ...form, needed: '   ' })).toBe(false);
    expect(otherWorkReady({ ...form, place: '', typed: 'Bay 3' })).toBe(true);
  });

  it('a support report is not on the live board as stopped', () => {
    const sent = floorTicket({ id: 's5', kind: 'support', machineId: machine('CNC-03').id });
    expect(reportModel(FLOOR_OPERATOR, reportInput({ sent }), realT).sent?.onLive).toBeNull();
  });

  it('who reported it: "Name (Title)", the name alone without a title, nothing when unlisted', () => {
    const ticket = floorTicket({ id: 'r1' });
    expect(reporterName(FLOOR_OPERATOR, ticket)).toBe('Omi (Operator)');
    expect(reporterName(FLOOR_OPERATOR, { ...ticket, reportedByPersonId: 'nobody' })).toBe('');
    const untitled = {
      ...FLOOR_OPERATOR,
      config: {
        ...FLOOR_OPERATOR.config,
        people: [{ id: 'p1', name: 'Omi', team: 'Production', title: null, active: true }],
      },
    } as unknown as typeof FLOOR_OPERATOR;
    expect(reporterName(untitled, ticket)).toBe('Omi');
  });

  it('the place: the machine code, else the work request place, else nothing', () => {
    expect(ticketPlace(FLOOR_OPERATOR, floorTicket({ id: 'p', machineId: 'm4' }))).toBe('DRL-04');
    expect(ticketPlace(FLOOR_OPERATOR, floorTicket({ id: 'q', location: 'Bay 3' }))).toBe('Bay 3');
    expect(ticketPlace(FLOOR_OPERATOR, floorTicket({ id: 'r' }))).toBe('');
  });

  it('the sheet says when work started', () => {
    const started = floorTicket({
      id: 'w',
      machineId: 'm4',
      startedAt: '2026-11-25T04:00:00.000Z',
    });
    expect(
      reportModel(FLOOR_OPERATOR, reportInput({ sheet: started }), realT).sheet?.started,
    ).toMatch(/^Work started \S+/);
  });
});

describe('S27 floor report: loading and offline', () => {
  it('still loading until there is an error, even offline; a failed load reads offline when the phone is', () => {
    expect(floorWaiting(null, true)).toBe('loading');
    expect(floorWaiting(null, false)).toBe('loading');
    expect(floorWaiting(new Error('down'), true)).toBe('error');
    expect(floorWaiting(new Error('down'), false)).toBe('offline');
  });
});

describe('S27 floor report: Gujarati', () => {
  const guT = (() => {
    const inst = i18next.createInstance();
    void inst.init({
      lng: 'gu',
      resources: { gu: { translation: { ...gu } } },
      interpolation: { escapeValue: false },
    });
    return inst.t.bind(inst) as unknown as TFunction;
  })();

  it('every word comes through t: the Gujarati catalogue, not English', () => {
    const model = reportModel(FLOOR_OPERATOR, reportInput(), guT);
    expect(model.title).toBe(gu['floor.title']);
    expect(model.machine.title).toBe(gu['floor.whichMachine']);
    expect(model.title).not.toBe('Report a problem');
  });
});
