import { describe, expect, it } from 'vitest';
import type { TicketDetail } from '../api.js';
import { earliestFinish, finishFigures, stepFinish } from './closeFinish.js';

const at = (time: string) => new Date(`2026-11-14T${time}:00.000Z`);
const floor = at('10:10');
const now = at('11:14');

describe('stepFinish', () => {
  it('moves the time by five minutes', () => {
    expect(stepFinish(now, -5, floor, now)).toEqual(at('11:09'));
    expect(stepFinish(at('11:09'), 5, floor, now)).toEqual(now);
  });

  it('never goes later than now', () => {
    expect(stepFinish(now, 5, floor, now)).toEqual(now);
  });

  it('never goes before the last event, and lands exactly on it', () => {
    expect(stepFinish(at('10:12'), -5, floor, now)).toEqual(floor);
    expect(stepFinish(floor, -5, floor, now)).toEqual(floor);
  });
});

function detail(): TicketDetail {
  const event = (type: string, time: string) => ({
    seq: 1,
    type,
    at: at(time).toISOString(),
    text: null,
    reason: null,
    actingPersonId: null,
    loginId: null,
    isVendor: false,
    changes: null,
  });
  return {
    ticket: {
      kind: 'stopped',
      reportedAt: at('09:58').toISOString(),
      kindUpgradedAt: null,
      selfStarted: false,
    },
    events: [event('start', '10:10'), event('pause', '10:20'), event('resume', '10:38')],
    intervals: [
      { personId: 'p1', role: 'lead', startedAt: at('10:10').toISOString(), endedAt: null },
    ],
    people: [],
    report: null,
  } as unknown as TicketDetail;
}

describe('finishFigures', () => {
  it('counts the repair and downtime up to the chosen finish', () => {
    const result = finishFigures(detail(), at('11:14'));
    expect(result.responseMin).toBe(12);
    expect(result.repairMin).toBe(64);
    expect(result.downtimeMin).toBe(76);
  });

  it('shortens them when the finish moves earlier', () => {
    const result = finishFigures(detail(), at('11:09'));
    expect(result.repairMin).toBe(59);
    expect(result.downtimeMin).toBe(71);
  });
});

describe('earliestFinish', () => {
  it('is the latest event, or the report time when the log is empty', () => {
    expect(earliestFinish(detail())).toEqual(at('10:38'));
    const empty = { ...detail(), events: [] } as TicketDetail;
    expect(earliestFinish(empty)).toEqual(at('09:58'));
  });
});
