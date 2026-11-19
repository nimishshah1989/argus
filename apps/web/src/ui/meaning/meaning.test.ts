import { FIGURE_KEYS } from '@uptimo/domain';
import { NUDGE_SEVERITIES, NUDGE_STATUSES } from '@uptimo/shared';
import type { TicketStatus } from '../../api.js';
import { describe, expect, it } from 'vitest';
import { STATUS, type StatusGroup } from '../status/index.js';
import type { StatusRef } from '../meaning.js';
import {
  FIGURE_MEANING,
  JUDGEMENT_KEYS,
  NUDGE_SEVERITY,
  NUDGE_STATUS,
  WORK_STATUS,
  describeChange,
  figureMeasure,
  formatFigure,
  statusMeaningOf,
  workStatusMeaning,
} from './index.js';

const TONES = ['good', 'watch', 'bad', 'neutral'];

describe('the meaning map is complete', () => {
  it('has a unit and a good direction for every registry figure, and nothing else', () => {
    const missing = FIGURE_KEYS.filter((key) => !FIGURE_MEANING[key]);
    expect(missing, `add these figure keys to figures.ts: ${missing.join(', ')}`).toEqual([]);
    expect(Object.keys(FIGURE_MEANING).sort()).toEqual([...FIGURE_KEYS].sort());
    for (const path of JUDGEMENT_KEYS) {
      const [key = '', part] = path.split('#');
      expect(figureMeasure(key, part).better, path).toBe('neither');
    }
    for (const [key, figure] of Object.entries(FIGURE_MEANING))
      for (const part of Object.keys(figure.parts ?? {}))
        expect(figureMeasure(key, part).unit, `${key}#${part}`).toBeDefined();
  });

  it('gives every status and severity a tone, an icon and a word', () => {
    let seen = 0;
    for (const group of Object.keys(STATUS) as StatusGroup[])
      for (const id of Object.keys(STATUS[group])) {
        const m = statusMeaningOf({ group, id } as StatusRef);
        expect(TONES, `${group}.${id}`).toContain(m.tone);
        expect(m.icon, `${group}.${id}`).toBeDefined();
        expect('key' in m && m.key, `${group}.${id}`).toBeTruthy();
        seen += 1;
      }
    expect(seen).toBeGreaterThanOrEqual(30);
  });

  it('covers every ticket status and every nudge severity and status', () => {
    for (const status of Object.keys(WORK_STATUS) as TicketStatus[])
      expect(TONES).toContain(workStatusMeaning(status).tone);
    for (const s of NUDGE_SEVERITIES) expect(NUDGE_SEVERITY[s].icon).toBeDefined();
    for (const s of NUDGE_STATUSES) expect(NUDGE_STATUS[s].icon).toBeDefined();
  });

  it('reads the domain: breakdowns and repair time down, availability and time between failures up', () => {
    expect(figureMeasure('dashboard.total-breakdowns').better).toBe('down');
    expect(figureMeasure('dashboard.total-downtime-hours').better).toBe('down');
    expect(figureMeasure('a3-mttr-mtbf', 'mttr').better).toBe('down');
    expect(figureMeasure('a3-mttr-mtbf', 'mtbf').better).toBe('up');
    expect(figureMeasure('dashboard.fleet-availability').better).toBe('up');
    expect(figureMeasure('pm-compliance').better).toBe('up');
    expect(figureMeasure('dashboard.total-machines').better).toBe('neither');
  });
});

describe('printing a figure and its change', () => {
  it('prints a percentage with %, money with the rupee sign and hours with their unit', () => {
    expect(formatFigure(figureMeasure('dashboard.fleet-availability'), 82.5)).toBe('82.5%');
    expect(formatFigure(figureMeasure('money-matters'), 120000)).toBe('₹1,20,000');
    expect(formatFigure(figureMeasure('dashboard.pm-hours'), 12.5)).toBe('12.5 hrs');
    expect(formatFigure(figureMeasure('dashboard.total-machines'), 7)).toBe('7');
  });

  it('colours a change by whether it helps, not by its arrow', () => {
    const down = figureMeasure('dashboard.total-breakdowns');
    expect(describeChange(down, -3)).toMatchObject({ tone: 'good', text: '-3', word: 'Better' });
    expect(describeChange(down, 2)).toMatchObject({ tone: 'bad', text: '+2', word: 'Worse' });
    const up = figureMeasure('dashboard.fleet-availability');
    expect(describeChange(up, 1.5)).toMatchObject({ tone: 'good', text: '+1.5%' });
    expect(describeChange(up, -1.5)).toMatchObject({ tone: 'bad', text: '-1.5%' });
  });

  it('keeps a figure with no good direction, or no change, neutral', () => {
    const none = figureMeasure('dashboard.total-machines');
    expect(describeChange(none, 4)).toMatchObject({ tone: 'neutral', word: 'Changed' });
    expect(describeChange(figureMeasure('dashboard.plant-bd-pct'), 0)).toMatchObject({
      tone: 'neutral',
      word: 'No change',
      text: '0%',
    });
  });

  it('fails loudly for a figure or a measure it has no entry for', () => {
    expect(() => figureMeasure('not.a.figure')).toThrow(/no entry/);
    expect(() => figureMeasure('a3-mttr-mtbf', 'mttf')).toThrow(/no measure/);
  });
});

describe('status tones follow the owner rulings', () => {
  it('shows Running grey, Waiting amber and a handed-over open ticket as Transferred', () => {
    expect(statusMeaningOf({ group: 'ticket', id: 'running' }).tone).toBe('neutral');
    expect(workStatusMeaning('waiting').tone).toBe('watch');
    expect(workStatusMeaning('open')).toMatchObject({ key: 'status.floor.booked' });
    expect(workStatusMeaning('open', true)).toMatchObject({ key: 'status.ticket.transferred' });
    expect(workStatusMeaning('working', true)).toMatchObject({ key: 'status.ticket.inProgress' });
  });

  it("keeps the Action Center's meaning: info is good news, with its own words", () => {
    expect(NUDGE_SEVERITY.info).toMatchObject({
      tone: 'good',
      key: 'analytics.actionCenter.tile.info',
    });
    expect(NUDGE_STATUS.ack).toMatchObject({ key: 'analytics.actionCenter.status.ack' });
  });
});
