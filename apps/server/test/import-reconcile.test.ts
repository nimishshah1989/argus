import { describe, expect, it } from 'vitest';
import type { BhavinEvent, BhavinEditChange } from '../src/modules/imports/event-schema.js';
import { parseTicket, type BhavinState, type BhavinTicket } from '../src/modules/imports/schema.js';
import { reconcileTicket, ReconcileError } from '../src/modules/imports/reconcile.js';
import { makeOrdinaryTicket, makeReconcileReferences, syntheticIds } from './import-fixture.js';

const NOW = new Date('2026-11-01T12:00:00Z');
const t = (value: string) => new Date(value);
const base = () => parseTicket(makeOrdinaryTicket());

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

function edit(at: string, changes: BhavinEditChange[]): BhavinEvent {
  return event('edit', at, { text: 'Correction', payload: { changes } });
}

function reconcile(ticket: BhavinTicket, now = NOW) {
  return reconcileTicket(ticket, makeReconcileReferences(), now);
}

function closeAt(ticket: BhavinTicket, value: string): void {
  const close = ticket.events.find((item) => item.type === 'close');
  if (!close) throw new Error('Fixture requires close');
  close.at = t(value);
  ticket.state.closedAt = t(value);
  ticket.segments.forEach((segment) => {
    segment.endedAt = t(value);
  });
  ticket.reports[0]!.submittedAt = t(value);
}

function pausedTicket(isVendor = true): BhavinTicket {
  const ticket = base();
  const [down, start, join, close] = ticket.events;
  ticket.events = [
    down!,
    start!,
    event('pause', '2026-11-01T10:30:00Z', {
      payload: { reason: 'spare', assignTo: 'Bina', expectedBackAt: null, isVendor },
    }),
    event('resume', '2026-11-01T10:40:00Z'),
    { ...join!, at: t('2026-11-01T10:40:00Z') },
    close!,
  ];
  ticket.crew[1]!.joinedAt = t('2026-11-01T10:40:00Z');
  ticket.segments = [
    {
      person: 'SYNTH-LEAD',
      role: 'lead',
      startedAt: t('2026-11-01T10:05:00Z'),
      endedAt: t('2026-11-01T10:30:00Z'),
      endReason: 'pause',
    },
    {
      person: 'SYNTH-LEAD',
      role: 'lead',
      startedAt: t('2026-11-01T10:40:00Z'),
      endedAt: t('2026-11-01T11:00:00Z'),
      endReason: 'close',
    },
    {
      person: 'Bina',
      role: 'support',
      startedAt: t('2026-11-01T10:40:00Z'),
      endedAt: t('2026-11-01T11:00:00Z'),
      endReason: 'close',
    },
  ];
  Object.assign(ticket.state, {
    segmentStartedAt: t('2026-11-01T10:40:00Z'),
    pausedByPerson: 'SYNTH-LEAD',
    assignedToPerson: 'Bina',
  });
  // repair is his wall clock from the start to the close: the 10-minute pause is inside it
  Object.assign(ticket.storedFigures, { activeMin: 45, repairMin: 55, waitMin: 10, vendorMin: 10 });
  ticket.reports[0]!.repairMin = 55;
  return ticket;
}

function pastTicket(): BhavinTicket {
  const ticket = base();
  const state: BhavinState = {
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
    closedAt: t('2026-11-01T11:00:00Z'),
    closedByPerson: 'SYNTH-LEAD',
    closeKind: 'report',
    closeNote: 'Synthetic repair complete',
    cancelledAt: null,
  };
  ticket.entryType = 'pastBreakdown';
  ticket.events = [ticket.events[0]!, ticket.events[3]!];
  ticket.crew = [];
  ticket.segments = [];
  ticket.state = state;
  Object.assign(ticket.storedFigures, { activeMin: 0, repairMin: 55 });
  return ticket;
}

describe('T26 exact full reconciliation', () => {
  it('maps every state, interval, report, figure, and sequence field exactly', () => {
    const ticket = base();
    const result = reconcile(ticket);
    expect(ticket.events).toHaveLength(4);
    expect(result.reduced.ticket).toBe(ticket);
    expect(result.reduced.state).toEqual(ticket.state);
    expect(result.reduced.state.machineRunningAt).toBeNull();
    expect(result.reduced.state.machineStoppedAt).toBeNull();
    expect(result.reduced.kind).toBe('stopped');
    expect(result.reduced.machineCode).toBe('SYNTH-MACHINE');
    expect(result.reduced.problem).toBe('Synthetic spindle alarm');
    expect(result.reduced.reportedAt).toEqual(t('2026-11-01T10:00:00Z'));
    expect(result.reduced.overrides).toEqual({});
    expect(result.reduced.editedAt).toBeNull();
    expect(result.reduced.lastEventSeq).toBe(3);
    expect(result.reduced.domainEvents.map((item) => item.type)).toEqual([
      'down',
      'start',
      'join',
      'close',
    ]);
    expect(result.reduced.domainEvents.every((item) => !('seq' in item))).toBe(true);
    expect(result.reduced.domainEvents[3]).toMatchObject({
      at: t('2026-11-01T11:00:00Z'),
      reason: 'Synthetic repair complete',
    });

    expect(result.crew).toEqual([
      {
        personId: syntheticIds.asha,
        role: 'primary',
        joinedAt: t('2026-11-01T10:05:00Z'),
        leftAt: null,
        leftReason: null,
      },
      {
        personId: syntheticIds.bina,
        role: 'support',
        joinedAt: t('2026-11-01T10:30:00Z'),
        leftAt: null,
        leftReason: null,
      },
    ]);
    expect(result.segments).toEqual([
      {
        personId: syntheticIds.asha,
        role: 'lead',
        startedAt: t('2026-11-01T10:05:00Z'),
        endedAt: t('2026-11-01T11:00:00Z'),
      },
      {
        personId: syntheticIds.bina,
        role: 'support',
        startedAt: t('2026-11-01T10:30:00Z'),
        endedAt: t('2026-11-01T11:00:00Z'),
      },
    ]);
    expect(result.reports).toEqual([
      {
        machineId: syntheticIds.machine,
        date: '2026-11-01',
        shiftCode: '1',
        problem: 'Synthetic spindle alarm',
        observedBy: 'Engineer',
        correctiveAction: 'Synthetic spindle reset',
        downtimeMin: 60,
        responseMin: 5,
        repairMin: 55,
        breakdownCategory: 'E',
        maintCode: 'M',
        spareUsed: null,
        rootCause: 'Synthetic cause',
        handoverName: null,
        submittedByPersonId: syntheticIds.asha,
        submittedAt: t('2026-11-01T11:00:00Z'),
        doneByPersonIds: [syntheticIds.asha],
        supportedByPersonIds: [syntheticIds.bina],
      },
    ]);
    expect(result.figureResult.asOf).toEqual(t('2026-11-01T11:00:00Z'));
    expect(result.figureResult.overrides).toEqual({});
    expect(result.figureResult.figures).toEqual({
      responseMin: 5,
      activeMin: 55,
      waitMin: 0,
      vendorMin: 0,
      handoverWaitMin: 0,
      downAccMin: 0, // finished stopped stretches only: the machine never ran again
      downtimeMin: 60,
      followMin: null,
      repairMin: 55,
      perPerson: { [syntheticIds.asha]: 55, [syntheticIds.bina]: 30 },
      overridden: [],
    });
    expect(result.figureResult.issues).toEqual([]);
    expect(result.pendingPersons).toEqual([]);
  });

  it('copies explicit pending-person provenance without inferring it', () => {
    const refs = makeReconcileReferences();
    refs.pendingPersons.set('new-person', {
      personId: syntheticIds.vendor,
      name: 'New Synthetic Person',
      createdByImport: true,
    });
    const result = reconcileTicket(base(), refs, NOW);
    expect(result.pendingPersons).toEqual([
      { personId: syntheticIds.vendor, name: 'New Synthetic Person', createdByImport: true },
    ]);
  });
});

describe('T29 interval reconciliation', () => {
  it('unions different-person overlap while retaining per-person minutes', () => {
    const result = reconcile(base());
    expect(result.figureResult.figures.activeMin).toBe(55);
    expect(result.figureResult.figures.repairMin).toBe(55);
    expect(result.figureResult.figures.perPerson).toEqual({
      [syntheticIds.asha]: 55,
      [syntheticIds.bina]: 30,
    });
  });

  const invalid = [
    [
      'inverted',
      (ticket: BhavinTicket) => void (ticket.segments[0]!.endedAt = t('2026-11-01T10:00:00Z')),
    ],
    [
      'zero length',
      (ticket: BhavinTicket) => void (ticket.segments[0]!.endedAt = t('2026-11-01T10:05:00Z')),
    ],
    [
      'same-person overlap',
      (ticket: BhavinTicket) =>
        void ticket.segments.splice(1, 0, {
          person: 'SYNTH-LEAD',
          role: 'lead',
          startedAt: t('2026-11-01T10:30:00Z'),
          endedAt: t('2026-11-01T10:45:00Z'),
          endReason: 'close',
        }),
    ],
    [
      'open outside working',
      (ticket: BhavinTicket) =>
        void Object.assign(ticket.segments[0]!, { endedAt: null, endReason: null }),
    ],
    ['wrong endReason', (ticket: BhavinTicket) => void (ticket.segments[0]!.endReason = 'leave')],
    [
      'crew/event contradiction',
      (ticket: BhavinTicket) => void (ticket.crew[1]!.joinedAt = t('2026-11-01T10:31:00Z')),
    ],
  ] as const;

  it.each(invalid)('rejects %s as a row error', (_name, mutate) => {
    const ticket = base();
    mutate(ticket);
    expect(() => reconcile(ticket)).toThrow(ReconcileError);
  });

  it('rejects multiple open segments in working state', () => {
    const ticket = base();
    ticket.events = ticket.events.slice(0, 3);
    ticket.status = 'working';
    ticket.reports = [];
    Object.assign(ticket.state, {
      closedAt: null,
      closedByPerson: null,
      closeKind: null,
      closeNote: null,
    });
    ticket.segments.forEach((segment) =>
      Object.assign(segment, { endedAt: null, endReason: null }),
    );
    ticket.segments = [ticket.segments[0]!, { ...ticket.segments[0]! }];
    expect(() => reconcile(ticket)).toThrow(/open segment/i);
  });

  it('rejects an open segment that crosses a pause', () => {
    const ticket = pausedTicket();
    ticket.events = ticket.events.slice(0, -1);
    ticket.status = 'working';
    ticket.reports = [];
    Object.assign(ticket.state, {
      closedAt: null,
      closedByPerson: null,
      closeKind: null,
      closeNote: null,
    });
    ticket.segments = [
      {
        person: 'SYNTH-LEAD',
        role: 'lead',
        startedAt: t('2026-11-01T10:05:00Z'),
        endedAt: null,
        endReason: null,
      },
    ];
    expect(() => reconcile(ticket)).toThrow(/segment_outside_working/);
  });

  it('accepts adjacent same-person segments across a pause/resume', () => {
    const ticket = pausedTicket();
    ticket.events[2]!.at = t('2026-11-01T10:30:00Z');
    ticket.events[3]!.at = t('2026-11-01T10:30:00Z');
    ticket.events[4]!.at = t('2026-11-01T10:30:00Z');
    ticket.crew[1]!.joinedAt = t('2026-11-01T10:30:00Z');
    ticket.segments[1]!.startedAt = t('2026-11-01T10:30:00Z');
    ticket.segments[2]!.startedAt = t('2026-11-01T10:30:00Z');
    Object.assign(ticket.state, { segmentStartedAt: t('2026-11-01T10:30:00Z') });
    Object.assign(ticket.storedFigures, { activeMin: 55, repairMin: 55, waitMin: 0, vendorMin: 0 });
    ticket.reports[0]!.repairMin = 55;
    expect(() => reconcile(ticket)).not.toThrow();
  });
});

describe('T30 ordinary edit evidence', () => {
  it('applies chronological old/new values and derives only evidenced overrides', () => {
    const ticket = base();
    const originalProblem = ticket.problem;
    ticket.events.push(
      edit('2026-11-01T11:10:00Z', [
        { field: 'handsOnOverrideMin', from: null, to: 50 },
        { field: 'waitingOverrideMin', from: null, to: 1 },
      ]),
      edit('2026-11-01T11:20:00Z', [
        { field: 'handsOnOverrideMin', from: 50, to: 56 },
        { field: 'waitingOverrideMin', from: 1, to: 2 },
      ]),
      edit('2026-11-01T11:30:00Z', [
        { field: 'closedByPerson', from: 'SYNTH-LEAD', to: 'Bina' },
        { field: 'problem', from: originalProblem, to: 'Corrected problem' },
        { field: 'machineCode', from: 'SYNTH-MACHINE', to: 'M-1' },
      ]),
    );
    ticket.state.closedByPerson = 'Bina';
    ticket.problem = 'Corrected problem';
    ticket.machineCode = 'M-1';
    ticket.storedFigures.activeMin = 56;
    ticket.storedFigures.waitMin = 2;
    const result = reconcile(ticket);
    expect(result.reduced.state.closedByPerson).toBe('Bina');
    expect(result.reduced.problem).toBe('Corrected problem');
    expect(result.reduced.machineCode).toBe('M-1');
    expect(result.reduced.overrides).toEqual({ handsOnOverrideMin: 56, waitingOverrideMin: 2 });
    expect(result.reduced.editedAt).toEqual(t('2026-11-01T11:30:00Z'));
    expect(result.figureResult.figures.activeMin).toBe(56);
    expect(result.figureResult.figures.waitMin).toBe(2);
    expect(result.figureResult.issues.filter((issue) => issue.severity === 'info')).toHaveLength(2);
  });

  it('rejects a stale edit from value with its event seq', () => {
    const ticket = base();
    ticket.events.push(
      edit('2026-11-01T11:10:00Z', [
        { field: 'problem', from: 'Synthetic spindle alarm', to: 'Intermediate problem' },
      ]),
      edit('2026-11-01T11:20:00Z', [
        { field: 'problem', from: 'Stale problem', to: 'Corrected problem' },
      ]),
    );
    ticket.problem = 'Corrected problem';
    expect(() => reconcile(ticket)).toThrow(/seq 5/);
  });

  it.each(['responseMin', 'repairMin', 'downtimeMin', 'activeMin', 'waitMin', 'overrides'])(
    'rejects lookalike %s edit evidence instead of creating an override',
    (field) => {
      const raw = makeOrdinaryTicket({
        events: [
          ...makeOrdinaryTicket().events,
          {
            at: '2026-11-01T11:10:00Z',
            by: 'SYNTH-LEAD',
            text: 'Correction',
            type: 'edit',
            payload: { changes: [{ field, from: null, to: 5 }] },
          },
        ],
      });
      expect(() => parseTicket(raw)).toThrow();
    },
  );
});

describe('T32 past breakdown mapping and constraints', () => {
  it('uses only report response/repair/downtime overrides with zero-based events', () => {
    const ticket = pastTicket();
    const result = reconcile(ticket);
    expect(result.reduced.ticket.entryType).toBe('pastBreakdown');
    expect(result.reduced.domainEvents).toHaveLength(2);
    expect(result.reduced.domainEvents.every((item) => !('seq' in item))).toBe(true);
    expect(result.reduced.lastEventSeq).toBe(1);
    expect(result.figureResult.overrides).toEqual({
      responseMin: 5,
      repairMin: 55,
      downtimeMin: 60,
    });
    expect(result.figureResult.figures).toMatchObject({
      responseMin: 5,
      activeMin: 0,
      waitMin: 0,
      vendorMin: 0,
      handoverWaitMin: 0,
      downAccMin: 0, // finished stopped stretches only: the machine never ran again
      downtimeMin: 60,
      followMin: null,
      repairMin: 55,
      perPerson: {},
    });
    expect(result.figureResult.issues.filter((issue) => issue.severity === 'info')).toHaveLength(3);
    expect(result.reports[0]!.doneByPersonIds).toEqual([syntheticIds.asha]);
    expect(result.reports[0]!.supportedByPersonIds).toEqual([syntheticIds.bina]);
  });

  it.each(['crew', 'segments', 'edit'])('rejects past breakdown with %s', (kind) => {
    const ticket = pastTicket();
    if (kind === 'crew') ticket.crew = base().crew;
    if (kind === 'segments') ticket.segments = base().segments;
    if (kind === 'edit') {
      ticket.events.push(
        edit('2026-11-01T11:10:00Z', [{ field: 'handsOnOverrideMin', from: null, to: 5 }]),
      );
    }
    expect(() => reconcile(ticket)).toThrow(ReconcileError);
  });
});

describe('T34 report-local fields and code references', () => {
  it.each(['2026-11-01T16:30:00+05:30', '2026-11-01T07:00:00-04:00'])(
    'retains the represented UTC production date for offset %s',
    (value) => {
      const ticket = base();
      closeAt(ticket, value);
      const result = reconcile(ticket);
      expect(result.reports[0]).toMatchObject({ date: '2026-11-01', shiftCode: '1' });
    },
  );

  it('validates a crosses-midnight shift against its original production date', () => {
    const ticket = base();
    closeAt(ticket, '2026-11-02T02:00:00Z');
    ticket.reports[0]!.date = '2026-11-01';
    ticket.reports[0]!.shiftCode = '2';
    Object.assign(ticket.storedFigures, {
      activeMin: 955,
      repairMin: 955,
      downAccMin: 0,
      downtimeMin: 960,
    });
    Object.assign(ticket.reports[0]!, { repairMin: 955, downtimeMin: 960 });
    const result = reconcile(ticket, t('2026-11-03T00:00:00Z'));
    expect(result.reports[0]).toMatchObject({ date: '2026-11-01', shiftCode: '2' });
  });

  it('rejects a supplied shift/date that does not contain the original close', () => {
    const ticket = base();
    closeAt(ticket, '2026-11-02T02:00:00Z');
    ticket.reports[0]!.shiftCode = '1';
    ticket.reports[0]!.date = '2026-11-02';
    expect(() => reconcile(ticket, t('2026-11-03T00:00:00Z'))).toThrow(ReconcileError);
  });

  it('projects canonical report codes and retains wait flags without changing M1 figures', () => {
    const refs = makeReconcileReferences();
    expect(refs.workTypes.get('BREAKDOWN')).toEqual({ code: 'breakdown' });
    expect(refs.locations.get('CELL-1')).toEqual({ code: 'Cell-1' });
    expect(refs.waitReasons.get('SPARE')).toEqual({
      code: 'spare',
      isVendor: true,
      pausesSla: true,
    });
    const first = reconcileTicket(pausedTicket(), refs, NOW);
    expect(first.reports[0]).toMatchObject({
      breakdownCategory: 'E',
      maintCode: 'M',
      observedBy: 'Engineer',
    });
    refs.waitReasons.set('SPARE', { code: 'spare', isVendor: true, pausesSla: false });
    const second = reconcileTicket(pausedTicket(), refs, NOW);
    expect(second.figureResult.figures).toEqual(first.figureResult.figures);
  });

  it('rejects a pause isVendor disagreement with the wait reference', () => {
    expect(() => reconcile(pausedTicket(false))).toThrow(/isVendor/);
  });

  const unknown = [
    ['workType', (ticket: BhavinTicket) => void (ticket.workType = 'unknown')],
    ['location', (ticket: BhavinTicket) => void (ticket.location = 'unknown')],
    [
      'breakdownCategory',
      (ticket: BhavinTicket) => void (ticket.reports[0]!.breakdownCategory = 'unknown'),
    ],
    ['observedBy', (ticket: BhavinTicket) => void (ticket.reports[0]!.observedBy = 'unknown')],
    ['maintCode', (ticket: BhavinTicket) => void (ticket.reports[0]!.maintCode = 'unknown')],
    ['shiftCode', (ticket: BhavinTicket) => void (ticket.reports[0]!.shiftCode = 'unknown')],
  ] as const;
  it.each(unknown)(
    'rejects unknown or inactive %s without dropping the report',
    (_field, mutate) => {
      const ticket = base();
      mutate(ticket);
      expect(() => reconcile(ticket)).toThrow(ReconcileError);
    },
  );
});

describe('T35 ordinary report people and report-state constraints', () => {
  it('requires report people to equal segment roles', () => {
    const ticket = base();
    ticket.reports[0]!.doneBy = ['Bina'];
    ticket.reports[0]!.supportedBy = ['SYNTH-LEAD'];
    expect(() => reconcile(ticket)).toThrow(/report people|doneBy|supportedBy/i);
  });

  it('rejects duplicate and cross-listed report people at the parsed boundary', () => {
    const duplicate = makeOrdinaryTicket();
    duplicate.reports[0]!.doneBy = ['SYNTH-LEAD', ' synth-lead '];
    expect(() => parseTicket(duplicate)).toThrow(/Duplicate/);
    const crossed = makeOrdinaryTicket();
    crossed.reports[0]!.supportedBy = ['SYNTH-LEAD'];
    expect(() => parseTicket(crossed)).toThrow(/disjoint/);
  });

  it('rejects a missing report on report close and reports on active/done tickets', () => {
    const missing = base();
    missing.reports = [];
    expect(() => reconcile(missing)).toThrow(ReconcileError);

    const active = base();
    active.events = active.events.slice(0, 3);
    active.status = 'working';
    Object.assign(active.state, {
      closedAt: null,
      closedByPerson: null,
      closeKind: null,
      closeNote: null,
    });
    active.segments.forEach((segment) =>
      Object.assign(segment, { endedAt: null, endReason: null }),
    );
    expect(() => reconcile(active)).toThrow(ReconcileError);

    const done = base();
    const close = done.events.find((item) => item.type === 'close');
    if (close?.type === 'close') close.payload.kind = 'done';
    done.state.closeKind = 'done';
    expect(() => reconcile(done)).toThrow(ReconcileError);
  });
});
