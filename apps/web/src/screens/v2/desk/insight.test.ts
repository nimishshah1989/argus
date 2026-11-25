// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { realT } from '../printed-page/test-support.js';
import { openModel } from './adapter.js';
import { deskFixture } from './fixture.js';
import { mayOpen, plantToday, showsSettings } from './model.js';

/**
 * S28-A (ADR 0045 T3): the Open screen's pure rules, lists and the two computed lines over the frozen plant.
 * ADR 0034: permissions and figures only; sentences are checked by the numbers in them.
 */
const model = () => openModel(deskFixture, realT);
const refs = (cards: { ticket: { ref: string } }[]) => cards.map((card) => card.ticket.ref);

describe('desk roles (moved from v1 Shell.tsx)', () => {
  it('opens every list for technician, supervisor, head and admin', () => {
    for (const role of ['technician', 'supervisor', 'head', 'admin'])
      for (const view of ['open', 'mine', 'team'] as const)
        expect(mayOpen(view, role), `${role} ${view}`).toBe(true);
  });

  it('gives the plant head Open and Team but not Mine', () => {
    expect(mayOpen('open', 'plant_head')).toBe(true);
    expect(mayOpen('team', 'plant_head')).toBe(true);
    expect(mayOpen('mine', 'plant_head')).toBe(false);
  });

  it('shows Plant settings and Settings to admin and head only', () => {
    expect(showsSettings('admin')).toBe(true);
    expect(showsSettings('head')).toBe(true);
    for (const role of ['plant_head', 'supervisor', 'technician', undefined])
      expect(showsSettings(role)).toBe(false);
  });

  it('judges today where the plant is', () => {
    expect(plantToday('Asia/Kolkata', new Date('2026-11-25T06:00:00Z'))).toBe('2026-11-25');
  });
});

describe('the Open screen over the frozen plant', () => {
  it('counts machines down, waiting, on support and running, none pressed', () => {
    const m = model();
    expect(m.counts.map(({ id, value, pressed }) => [id, value, pressed])).toEqual([
      ['down', 4, false],
      ['waiting', 1, false],
      ['support', 1, false],
      ['running', 1, false],
    ]);
    expect(m.showing).toBeNull();
    expect(m.badge).toBe(5);
  });

  it('counts the leads on a job and each segment, Breakdowns chosen', () => {
    const m = model();
    expect(m.teamNow).toContain('2');
    expect(m.segments.map(({ id, pressed }) => [id, pressed])).toEqual([
      ['breakdowns', true],
      ['tasks', false],
      ['work', false],
    ]);
    expect(m.segments.map(({ label }) => /\((\d+)\)/.exec(label)?.[1])).toEqual(['5', '2', '2']);
  });

  it('lists breakdowns nobody started: stopped first, longest wait first; then the paused one', () => {
    const m = model();
    expect(refs(m.breakdowns.cards)).toEqual(['TKT-0401', 'TKT-0409', 'TKT-0413', 'TKT-0398']);
    expect(m.breakdowns.cards.map((card) => card.machine)).toEqual([
      'LT-08',
      'VC-03',
      'VC-17',
      'CNC-02',
    ]);
    expect(m.breakdowns.paused?.heading).toContain('1');
    expect(refs(m.breakdowns.paused?.cards ?? [])).toEqual(['TKT-0390']);
  });

  it('gives each card the quick button the role may press', () => {
    const m = model();
    expect(m.breakdowns.cards.map((card) => card.quick?.action)).toEqual([
      'start',
      'start',
      'start',
      'start',
    ]);
    expect(m.breakdowns.paused?.cards[0]?.quick?.action).toBe('resume');
  });

  it('lists follow-up tasks earliest expected date first, with the raw date and who left them', () => {
    const m = model();
    expect(
      m.tasks.cards.map(({ ticket, machine, state, overdue }) => [
        ticket.ref,
        machine,
        state,
        overdue,
      ]),
    ).toEqual([
      ['TKT-0388', 'VC-17', 'pending', false],
      ['TKT-0386', 'LT-08', 'pending', false],
    ]);
    expect(m.tasks.cards[0]?.line).toContain('2026-11-27');
    expect(m.tasks.cards[0]?.meta).toContain('Tech A');
    expect(m.tasks.cards[1]?.meta).toContain('Tech B');
  });

  it('lists work requests urgent first, then oldest', () => {
    expect(refs(model().work.cards)).toEqual(['TKT-0411', 'TKT-0410']);
  });

  it('keeps the reports still owed, with who closed the job', () => {
    const m = model();
    expect(m.needsReport?.heading).toContain('1');
    expect(refs(m.needsReport?.cards ?? [])).toEqual(['TKT-0380']);
    expect(m.needsReport?.cards[0]?.meta).toContain('Tech B');
  });
});

describe('the Open screen insight lines (UX rule 60, scope "More intelligent")', () => {
  it('names the machine down longest against the average of the stopped machines nobody started', () => {
    // LT-08 159 min, VC-03 19 min, VC-17 2 min: average 60 min, 159 / 60 rounds to 3.
    const m = model();
    const line = m.takeaways['desk.breakdowns'];
    expect(line?.text).toContain('LT-08');
    expect(line?.text).toContain('2 h 39 min');
    expect(line?.text).toContain('3');
    expect(line?.text).toContain('1 h 0 min');
    expect(line?.outlier).toBe('TKT-0401');
    expect(m.breakdowns.cards.map((card) => card.longest)).toEqual([true, false, false, false]);
  });

  it('names the earliest task and how far its date is from the plant’s today', () => {
    const line = model().takeaways['desk.tasks'];
    expect(line?.text).toContain('VC-17');
    expect(line?.text).toContain('27 Nov');
    expect(line?.text).toContain('2');
    expect(line?.outlier).toBe('TKT-0388');
  });
});
