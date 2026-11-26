// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { realT } from '../printed-page/test-support.js';
import { machineRow, otherWorkModel, reportModel, tabsModel } from './adapter.js';
import {
  FLOOR_OPERATOR,
  FLOOR_TECH,
  SENT,
  STOPPED,
  SUPPORT,
  WORK,
  reportInput,
} from './fixture.js';
import { EMPTY_OTHER_WORK, floorTabKeys, otherWorkReady, sendReady } from './model.js';

/** ADR 0045 T1 (S27-A): the report flow's data, permissions and rules, as v1 had them (decision 6). */
const machine = (code: string) => FLOOR_OPERATOR.config.machines.find((m) => m.code === code)!;

describe('S27 floor tabs: PM jobs is maintenance only', () => {
  it('an operator gets Report and My complaints; maintenance also gets PM jobs', () => {
    expect(floorTabKeys(false)).toEqual(['report', 'mine']);
    expect(floorTabKeys(true)).toEqual(['report', 'mine', 'pm']);
  });

  it('the tab bar is named "Floor" and Other work lights Report', () => {
    const tabs = tabsModel(true, '/floor/other', realT);
    expect(tabs.label).toBe('Floor');
    expect(tabs.current).toBe('report');
    expect(tabs.tabs.map((tab) => [tab.key, tab.to, tab.label])).toEqual([
      ['report', '/floor', 'Report'],
      ['mine', '/floor/mine', 'My complaints'],
      ['pm', '/floor/pm', 'PM jobs'],
    ]);
  });
});

describe('S27 Step 1: which machine', () => {
  it('an open breakdown opens its ticket sheet; a support ticket goes on to Step 2', () => {
    const stopped = machineRow(FLOOR_OPERATOR, machine('DRL-04'), realT);
    expect(stopped).toMatchObject({ code: 'DRL-04', status: 'stopped', opens: 'sheet' });
    expect(stopped.detail).toBe('Already reported. Tap to view the ticket.');
    const support = machineRow(FLOOR_OPERATOR, machine('CNC-02'), realT);
    expect(support).toMatchObject({ status: 'support', opens: 'situation' });
    expect(support.detail).toBe('Needs support. Tap to say it has stopped.');
  });

  it('browse: the last 3 recent machines, newest first; segments in order with machine counts', () => {
    const step = reportModel(FLOOR_OPERATOR, reportInput(), realT).machine;
    if (step.kind !== 'browse') throw new Error('expected browse');
    expect(step.recent.map((m) => m.code)).toEqual(['DRL-04', 'CNC-01', 'CNC-02']);
    expect(step.other?.title).toBe('Other work (not a machine)');
    expect(step.segments.map((s) => [s.title, s.count])).toEqual([
      ['Turning', 4],
      ['Utilities', 1],
    ]);
    expect(step.segments[0]!.groups.map((g) => [g.code, g.name, g.count])).toEqual([
      ['CNC', 'CNC lathes', '3 machines'],
      ['DRL', 'Drills', '1 machine'],
    ]);
  });

  it('a search: exact first, then ends-with, natural order; no recent, groups or Other work card', () => {
    const step = reportModel(FLOOR_OPERATOR, reportInput({ query: '01' }), realT).machine;
    if (step.kind !== 'browse') throw new Error('expected browse');
    expect(step.rows.map((r) => r.code)).toEqual(['CMP-01', 'CNC-01']);
    expect(step.recent).toEqual([]);
    expect(step.segments).toEqual([]);
    expect(step.other).toBeNull();
    expect(step.noMatch).toBeNull();
  });
});

describe('S27 Step 2: the situation', () => {
  it('on a support ticket: the banner, the upgrade wording, and "still running" opens the sheet', () => {
    const model = reportModel(FLOOR_OPERATOR, reportInput({ machine: machine('CNC-02') }), realT);
    const step = model.situation!;
    expect(step.title).toBe('What is the situation now?');
    expect(step.machine).toMatchObject({ code: 'CNC-02', detail: 'CNC lathes · Cell 6' });
    expect(step.support?.text).toBe(`This machine already has a support ticket, ${SUPPORT.ref}.`);
    expect(step.stopped.detail).toBe(
      `Changes ${SUPPORT.ref} to stopped. Downtime starts when you send.`,
    );
    expect(step.running.title).toBe('Still running, needs support');
    expect(step.runningOpensSheet).toBe(true);
    expect(model.start).toBe(1);
  });

  it('a pending follow-up task is listed with its reason and expected date', () => {
    const step = reportModel(
      FLOOR_OPERATOR,
      reportInput({ machine: machine('CNC-01') }),
      realT,
    ).situation!;
    expect(step.tasks).toEqual({
      title: 'This machine has a follow-up task',
      lines: ['WR-7 · Waiting for a part · expected 2999-01-01'],
    });
    expect(step.support).toBeNull();
    expect(step.runningOpensSheet).toBe(false);
  });
});

describe('S27 Step 3: what is wrong, who sends it', () => {
  it('Send waits for text; an upgrade sends with nothing typed', () => {
    expect(sendReady(false, '')).toBe(false);
    expect(sendReady(false, 'Spindle alarm')).toBe(true);
    expect(sendReady(true, '')).toBe(true);
    const upgrade = reportModel(
      FLOOR_OPERATOR,
      reportInput({ machine: machine('CNC-02'), kind: 'stopped' }),
      realT,
    ).problem;
    expect(upgrade).toMatchObject({ upgradeText: SUPPORT.problem, ready: true });
    expect(upgrade.action).toBe('Send: machine has stopped');
  });

  it('only active quick problems are chips; the typed one is pressed', () => {
    const step = reportModel(
      FLOOR_OPERATOR,
      reportInput({ machine: machine('CNC-01'), kind: 'support', problem: 'Coolant leak' }),
      realT,
    ).problem;
    expect(step.chips.map((c) => [c.label, c.pressed])).toEqual([
      ['Spindle alarm', false],
      ['Coolant leak', true],
      ['Hydraulic pressure low', false],
    ]);
    expect(step.action).toBe('Send: needs support');
  });

  it('only maintenance gets "I am starting work on it now"; an operator reads who is reporting', () => {
    const input = reportInput({ machine: machine('CNC-01'), startNow: true });
    expect(reportModel(FLOOR_OPERATOR, input, realT).problem.who).toEqual({
      kind: 'reportingAs',
      text: 'Reporting as Omi (Operator)',
    });
    expect(reportModel(FLOOR_TECH, input, realT).problem.who).toEqual({
      kind: 'startNow',
      label: 'I am starting work on it now',
      checked: true,
    });
  });
});

describe('S27 Sent and the ticket sheet', () => {
  it('Sent: the live-board line for a stopped report, the ticket number and the reporter', () => {
    const sent = reportModel(FLOOR_OPERATOR, reportInput({ sent: SENT }), realT).sent!;
    expect(sent.title).toBe('Sent to maintenance');
    expect(sent.onLive).toBe('CNC-01 now shows on the live board as stopped.');
    expect(sent.facts).toMatchObject({
      place: 'CNC-01',
      status: 'stopped',
      number: 'Ticket number BD-0042',
      problem: 'Spindle alarm',
    });
    expect(sent.facts.reported).toMatch(/^Reported .+ by Omi \(Operator\)$/);
  });

  it('the sheet for an already-reported machine is named by its code and says work has not started', () => {
    const sheet = reportModel(FLOOR_OPERATOR, reportInput({ sheet: STOPPED }), realT).sheet!;
    expect(sheet.title).toBe('DRL-04');
    expect(sheet.facts.number).toBe(`Ticket number ${STOPPED.ref}`);
    expect(sheet.started).toBe('Work not started yet');
  });
});

describe('S27 Other work', () => {
  it('the plant cells and the active work types; Send waits for place, type and need', () => {
    const model = otherWorkModel(
      FLOOR_OPERATOR,
      { form: EMPTY_OTHER_WORK, startNow: false, sent: null },
      realT,
    );
    expect(model.stepTitle).toBe('Other work (not a machine)');
    expect(model.where.places).toEqual(['Cell 6', 'Cell 2', 'Utility']);
    expect(model.workType.types).toEqual(['Preventive', 'Electrical']);
    expect(model.ready).toBe(false);
    const full = {
      ...EMPTY_OTHER_WORK,
      place: 'Cell 2',
      workType: 'Preventive',
      needed: 'Wall fan',
    };
    expect(otherWorkReady(full)).toBe(true);
    expect(otherWorkReady({ ...full, workType: '' })).toBe(false);
  });

  it('a sent work request shows its place and no live-board line', () => {
    const model = otherWorkModel(
      FLOOR_OPERATOR,
      { form: EMPTY_OTHER_WORK, startNow: false, sent: WORK },
      realT,
    );
    expect(model.sent?.facts.place).toBe('Cell 6');
    expect(model.sent?.onLive).toBeNull();
  });
});
