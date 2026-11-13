import { describe, expect, it } from 'vitest';
import type { BhavinEvent } from '../src/modules/imports/event-schema.js';
import { parseTicket, type BhavinState, type BhavinTicket } from '../src/modules/imports/schema.js';
import { reduceTicketState } from '../src/modules/imports/state.js';
import { makeOrdinaryTicket } from './import-fixture.js';

const NOW = new Date('2026-11-01T12:00:00Z');
const t = (value: string) => new Date(value);

function event(
  type: BhavinEvent['type'],
  at: string,
  over: { by?: string | null; text?: string | null; payload?: Record<string, unknown> } = {},
): BhavinEvent {
  const payload = { ...(over.payload ?? {}) };
  if (typeof payload.expectedBackAt === 'string')
    payload.expectedBackAt = t(payload.expectedBackAt);
  return {
    type,
    at: t(at),
    by: over.by === undefined ? 'SYNTH-LEAD' : over.by,
    text: over.text ?? null,
    payload,
  } as BhavinEvent;
}

function emptyState(): BhavinState {
  return {
    selfStarted: false,
    startedAt: null,
    segmentStartedAt: null,
    leadPerson: null,
    handedOver: false,
    handoverSince: null,
    transferToPerson: null,
    transferToShift: null,
    transfers: 0,
    waitReason: null,
    waitSince: null,
    pausedByPerson: null,
    assignedToPerson: null,
    expectedBackAt: null,
    waitingSpare: null,
    machineRunningAt: null,
    machineStoppedAt: null,
    kindUpgradedAt: null,
    closedAt: null,
    closedByPerson: null,
    closeKind: null,
    closeNote: null,
    cancelledAt: null,
  };
}

function timeline(
  events: BhavinEvent[],
  state: Partial<BhavinState>,
  over: Partial<BhavinTicket> = {},
): BhavinTicket {
  const ticket = parseTicket(makeOrdinaryTicket());
  Object.assign(ticket, {
    status: 'open',
    reportedAt: t('2026-11-01T10:00:00Z'),
    events,
    crew: [],
    segments: [],
    reports: [],
    storedFigures: {
      responseMin: null,
      activeMin: 0,
      waitMin: 0,
      vendorMin: 0,
      handoverWaitMin: 0,
      downAccMin: 0,
      downtimeMin: null,
      followMin: null,
      repairMin: 0,
    },
    state: { ...emptyState(), ...state },
    ...over,
  });
  return ticket;
}

const down = () => event('down', '2026-11-01T10:00:00Z');
const start = () => event('start', '2026-11-01T10:05:00Z');
const started = {
  startedAt: t('2026-11-01T10:05:00Z'),
  segmentStartedAt: t('2026-11-01T10:05:00Z'),
  leadPerson: 'SYNTH-LEAD',
};

function closedFields(kind: 'report' | 'no_report' | 'done'): Partial<BhavinState> {
  return {
    ...started,
    closedAt: t('2026-11-01T11:00:00Z'),
    closedByPerson: 'SYNTH-LEAD',
    closeKind: kind,
    closeNote: 'Synthetic repair complete',
  };
}

describe('T26b imported status reduction', () => {
  it('reduces an open unstarted timeline without inventing a stopped timestamp', () => {
    const ticket = timeline([down()], {});
    const result = reduceTicketState(ticket, NOW);
    expect(result.state).toEqual(ticket.state);
    expect(result.state.machineStoppedAt).toBeNull();
    expect(result.lastEventSeq).toBe(0);
    expect(result.domainEvents).toEqual([{ type: 'down', at: t('2026-11-01T10:00:00Z') }]);
    expect(result.domainEvents[0]).not.toHaveProperty('seq');
  });

  const cases: Array<[string, BhavinTicket, Partial<BhavinState>]> = [
    ['working', timeline([down(), start()], started, { status: 'working' }), started],
    [
      'waiting',
      timeline(
        [
          down(),
          start(),
          event('pause', '2026-11-01T10:10:00Z', {
            payload: {
              reason: 'spare',
              assignTo: 'Bina',
              expectedBackAt: '2026-11-01T12:30:00Z',
              isVendor: true,
            },
          }),
        ],
        {
          ...started,
          waitReason: 'spare',
          waitSince: t('2026-11-01T10:10:00Z'),
          pausedByPerson: 'SYNTH-LEAD',
          assignedToPerson: 'Bina',
          expectedBackAt: t('2026-11-01T12:30:00Z'),
        },
        { status: 'waiting' },
      ),
      {
        waitReason: 'spare',
        pausedByPerson: 'SYNTH-LEAD',
        assignedToPerson: 'Bina',
      },
    ],
    ...(['report', 'no_report', 'done'] as const).map(
      (kind): [string, BhavinTicket, Partial<BhavinState>] => [
        `closed ${kind}`,
        timeline(
          [
            down(),
            start(),
            event('close', '2026-11-01T11:00:00Z', {
              text: 'Synthetic repair complete',
              payload: { kind },
            }),
          ],
          closedFields(kind),
          {
            status: 'closed',
            reports: kind === 'report' ? parseTicket(makeOrdinaryTicket()).reports : [],
          },
        ),
        { closeKind: kind, closedByPerson: 'SYNTH-LEAD' },
      ],
    ),
    [
      'cancelled',
      timeline(
        [
          down(),
          start(),
          event('cancel', '2026-11-01T10:20:00Z', {
            text: 'Mistake',
            payload: { previousStatus: 'working' },
          }),
        ],
        { ...started, cancelledAt: t('2026-11-01T10:20:00Z') },
        { status: 'cancelled' },
      ),
      { cancelledAt: t('2026-11-01T10:20:00Z') },
    ],
    [
      'restored',
      timeline(
        [
          down(),
          start(),
          event('cancel', '2026-11-01T10:20:00Z', {
            text: 'Mistake',
            payload: { previousStatus: 'working' },
          }),
          event('restore', '2026-11-01T10:30:00Z', { text: 'Undo mistake' }),
        ],
        { ...started, segmentStartedAt: t('2026-11-01T10:30:00Z') },
        {
          status: 'working',
          segments: [
            {
              person: 'SYNTH-LEAD',
              role: 'lead',
              startedAt: t('2026-11-01T10:30:00Z'),
              endedAt: null,
              endReason: null,
            },
          ],
        },
      ),
      { cancelledAt: null, segmentStartedAt: t('2026-11-01T10:30:00Z') },
    ],
    [
      'support upgraded',
      timeline(
        [
          down(),
          start(),
          event('upgrade_kind', '2026-11-01T10:10:00Z'),
          event('close', '2026-11-01T11:00:00Z', {
            text: 'Synthetic repair complete',
            payload: { kind: 'no_report' },
          }),
        ],
        {
          ...closedFields('no_report'),
          kindUpgradedAt: t('2026-11-01T10:10:00Z'),
        },
        { status: 'closed' },
      ),
      { kindUpgradedAt: t('2026-11-01T10:10:00Z') },
    ],
  ];

  it.each(cases)('reduces every supplied scalar for %s', (_name, ticket, expected) => {
    const result = reduceTicketState(ticket, NOW);
    expect(result.state).toEqual(ticket.state);
    expect(result.state).toMatchObject(expected);
    expect(result.ticket.status).toBe(ticket.status);
    expect(result.lastEventSeq).toBe(ticket.events.length - 1);
  });

  it('rejects any supplied scalar that disagrees with the fold', () => {
    const ticket = timeline(
      [down(), start()],
      { ...started, leadPerson: 'Bina' },
      { status: 'working' },
    );
    expect(() => reduceTicketState(ticket, NOW)).toThrow(/leadPerson/);
  });
});

describe('T27 handover, waiting, machine, cancellation, and close state', () => {
  it('keeps exact historical handover and current scalar state', () => {
    const events = [
      down(),
      start(),
      event('upgrade_kind', '2026-11-01T10:06:00Z'),
      event('transfer', '2026-11-01T10:10:00Z', {
        text: 'To Bina',
        payload: { to: 'Bina', toShift: null },
      }),
      event('pickup', '2026-11-01T10:15:00Z', { by: 'Bina' }),
      event('transfer', '2026-11-01T10:20:00Z', {
        by: 'Bina',
        text: 'To next shift',
        payload: { to: null, toShift: '2' },
      }),
      event('pickup', '2026-11-01T10:25:00Z'),
      event('pause', '2026-11-01T10:30:00Z', {
        text: 'Vendor wait',
        payload: {
          reason: 'spare',
          assignTo: 'Bina',
          expectedBackAt: '2026-11-01T12:30:00Z',
          isVendor: true,
        },
      }),
      event('update', '2026-11-01T10:35:00Z', {
        text: 'Seal ordered',
        payload: { spare: 'Synthetic seal', expectedBackAt: '2026-11-01T12:45:00Z' },
      }),
      event('resume', '2026-11-01T10:40:00Z'),
      event('running', '2026-11-01T10:41:00Z'),
      event('stopped', '2026-11-01T10:42:00Z'),
      event('cancel', '2026-11-01T10:43:00Z', {
        text: 'Mistake',
        payload: { previousStatus: 'working' },
      }),
      event('restore', '2026-11-01T10:44:00Z', { text: 'Undo mistake' }),
      event('close', '2026-11-01T11:00:00Z', {
        by: 'Bina',
        text: 'Closed by support',
        payload: { kind: 'no_report' },
      }),
    ];
    const expected: BhavinState = {
      ...emptyState(),
      startedAt: t('2026-11-01T10:25:00Z'),
      segmentStartedAt: t('2026-11-01T10:44:00Z'),
      leadPerson: 'SYNTH-LEAD',
      handedOver: false,
      handoverSince: t('2026-11-01T10:20:00Z'),
      transferToPerson: null,
      transferToShift: '2',
      transfers: 2,
      pausedByPerson: 'SYNTH-LEAD',
      assignedToPerson: 'Bina',
      expectedBackAt: t('2026-11-01T12:45:00Z'),
      waitingSpare: 'Synthetic seal',
      machineRunningAt: t('2026-11-01T10:41:00Z'),
      machineStoppedAt: t('2026-11-01T10:42:00Z'),
      kindUpgradedAt: t('2026-11-01T10:06:00Z'),
      closedAt: t('2026-11-01T11:00:00Z'),
      closedByPerson: 'Bina',
      closeKind: 'no_report',
      closeNote: 'Closed by support',
    };
    const ticket = timeline(events, expected, {
      status: 'closed',
      segments: [
        {
          person: 'SYNTH-LEAD',
          role: 'lead',
          startedAt: t('2026-11-01T10:44:00Z'),
          endedAt: t('2026-11-01T11:00:00Z'),
          endReason: 'close',
        },
      ],
    });
    const result = reduceTicketState(ticket, NOW);
    expect(result.state).toEqual(expected);
    expect(result.kind).toBe('stopped');
    expect(result.lastEventSeq).toBe(14);
    expect(result.domainEvents.map((item) => item.type)).toEqual(events.map((item) => item.type));
    expect(result.domainEvents[7]).toMatchObject({ type: 'pause', isVendor: true });
    expect(result.domainEvents[12]).toMatchObject({ type: 'cancel', status: 'working' });
  });
});

describe('T28 illegal timelines', () => {
  const invalid: Array<[string, BhavinTicket, number]> = [
    [
      'reversed event times',
      timeline(
        [event('down', '2026-11-01T10:05:00Z'), event('start', '2026-11-01T10:00:00Z')],
        {
          ...started,
          startedAt: t('2026-11-01T10:00:00Z'),
          segmentStartedAt: t('2026-11-01T10:00:00Z'),
        },
        { status: 'working' },
      ),
      1,
    ],
    [
      'pause without working',
      timeline(
        [
          down(),
          event('pause', '2026-11-01T10:10:00Z', {
            payload: { reason: 'spare', assignTo: null, expectedBackAt: null, isVendor: true },
          }),
        ],
        { waitReason: 'spare', waitSince: t('2026-11-01T10:10:00Z'), pausedByPerson: 'SYNTH-LEAD' },
        { status: 'waiting' },
      ),
      1,
    ],
    [
      'resume without pause',
      timeline(
        [down(), start(), event('resume', '2026-11-01T10:10:00Z')],
        {
          ...started,
          segmentStartedAt: t('2026-11-01T10:10:00Z'),
        },
        { status: 'working' },
      ),
      2,
    ],
    [
      'stopped without running',
      timeline(
        [down(), start(), event('stopped', '2026-11-01T10:10:00Z')],
        {
          ...started,
          machineStoppedAt: t('2026-11-01T10:10:00Z'),
        },
        { status: 'working' },
      ),
      2,
    ],
    [
      'repeated running',
      timeline(
        [
          down(),
          start(),
          event('running', '2026-11-01T10:10:00Z'),
          event('running', '2026-11-01T10:20:00Z'),
        ],
        {
          ...started,
          machineRunningAt: t('2026-11-01T10:20:00Z'),
        },
        { status: 'working' },
      ),
      3,
    ],
    [
      'close from waiting',
      timeline(
        [
          down(),
          start(),
          event('pause', '2026-11-01T10:10:00Z', {
            payload: { reason: 'spare', assignTo: null, expectedBackAt: null, isVendor: true },
          }),
          event('close', '2026-11-01T11:00:00Z', { payload: { kind: 'no_report' } }),
        ],
        closedFields('no_report'),
        { status: 'closed' },
      ),
      3,
    ],
    [
      'bad cancel previousStatus',
      timeline(
        [
          down(),
          start(),
          event('cancel', '2026-11-01T10:20:00Z', {
            text: 'Mistake',
            payload: { previousStatus: 'open' },
          }),
        ],
        { ...started, cancelledAt: t('2026-11-01T10:20:00Z') },
        { status: 'cancelled' },
      ),
      2,
    ],
    [
      'late report after report close',
      timeline(
        [
          down(),
          start(),
          event('close', '2026-11-01T11:00:00Z', {
            text: 'Synthetic repair complete',
            payload: { kind: 'report' },
          }),
          event('report', '2026-11-01T11:10:00Z'),
        ],
        closedFields('report'),
        {
          status: 'closed',
          reports: parseTicket(makeOrdinaryTicket()).reports,
        },
      ),
      3,
    ],
    [
      'edit on cancelled',
      timeline(
        [
          down(),
          start(),
          event('cancel', '2026-11-01T10:20:00Z', {
            text: 'Mistake',
            payload: { previousStatus: 'working' },
          }),
          event('edit', '2026-11-01T10:30:00Z', {
            text: 'Correction',
            payload: {
              changes: [{ field: 'problem', from: 'Synthetic spindle alarm', to: 'Corrected' }],
            },
          }),
        ],
        { ...started, cancelledAt: t('2026-11-01T10:20:00Z') },
        { status: 'cancelled', problem: 'Corrected' },
      ),
      3,
    ],
  ];

  it.each(invalid)('rejects %s with its event seq', (_name, ticket, seq) => {
    expect(() => reduceTicketState(ticket, NOW)).toThrow(new RegExp(`seq ${seq}`));
  });

  it('uses only explicit now for future events and permits future expectedBackAt', () => {
    const future = timeline(
      [down(), event('start', '2026-11-01T12:00:00.001Z')],
      {
        startedAt: t('2026-11-01T12:00:00.001Z'),
        segmentStartedAt: t('2026-11-01T12:00:00.001Z'),
        leadPerson: 'SYNTH-LEAD',
      },
      { status: 'working' },
    );
    expect(() => reduceTicketState(future, NOW)).toThrow(/future_event.*seq 1|seq 1.*future_event/);
    expect(() => reduceTicketState(future, new Date('2026-11-01T12:00:01Z'))).not.toThrow();

    const waiting = timeline(
      [
        down(),
        start(),
        event('pause', '2026-11-01T10:10:00Z', {
          payload: {
            reason: 'spare',
            assignTo: null,
            expectedBackAt: '2027-01-01T00:00:00Z',
            isVendor: true,
          },
        }),
      ],
      {
        ...started,
        waitReason: 'spare',
        waitSince: t('2026-11-01T10:10:00Z'),
        pausedByPerson: 'SYNTH-LEAD',
        expectedBackAt: t('2027-01-01T00:00:00Z'),
      },
      { status: 'waiting' },
    );
    expect(() => reduceTicketState(waiting, NOW)).not.toThrow();
  });
});
