import { describe, expect, it } from 'vitest';
import { makeOrdinaryTicket, makeSyntheticExport, syntheticSource } from './import-fixture.js';
import { startTestDb } from './harness.js';

const loadSchema = () => import('../src/import/schema.js');

function captureError(run: () => unknown): unknown {
  try {
    run();
    return undefined;
  } catch (error) {
    return error;
  }
}

function expectFailureAt(run: () => unknown, path: string): void {
  const error = captureError(run);
  expect(error, `expected validation failure at ${path}`).toBeDefined();
  const issues = (error as { issues?: unknown }).issues;
  expect(JSON.stringify(issues ?? String(error))).toContain(path);
}

function omit(value: object, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([name]) => name !== key));
}

function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, child]) => [key, reverseKeys(child)]),
  );
}

function dateOrNull(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

function minimalEvent() {
  return {
    at: '2026-11-01T10:05:00Z',
    by: 'A',
    payload: {},
    text: null,
    type: 'start',
  };
}

function updateEvent(text: string) {
  return {
    at: '2026-11-01T11:00:00Z',
    by: 'Asha',
    payload: { expectedBackAt: null, spare: null },
    text,
    type: 'update',
  };
}

function editEvent(payload: unknown) {
  return {
    at: '2026-11-01T11:01:00Z',
    by: 'Asha',
    payload,
    text: 'Synthetic correction',
    type: 'edit',
  };
}

function ticketWithEdit(payload: unknown, problem = 'Synthetic spindle alarm') {
  const raw = makeOrdinaryTicket({ problem });
  return { ...raw, events: [...raw.events, editEvent(payload)] };
}

function allEditChanges() {
  return [
    { field: 'reportedAt', from: '2026-11-01T10:00:00Z', to: '2026-11-01T10:01:00Z' },
    { field: 'startedAt', from: null, to: '2026-11-01T10:05:00Z' },
    { field: 'closedAt', from: null, to: '2026-11-01T11:00:00Z' },
    { field: 'problem', from: 'old', to: 'new' },
    { field: 'machineCode', from: null, to: 'M-1' },
    { field: 'kind', from: 'support', to: 'stopped' },
    { field: 'leadPerson', from: null, to: 'Asha' },
    { field: 'closedByPerson', from: null, to: 'Asha' },
    { field: 'handsOnOverrideMin', from: null, to: 55 },
    { field: 'waitingOverrideMin', from: null, to: 0 },
  ];
}

function rawTicketAtBytes(target: number) {
  const base = makeOrdinaryTicket();
  const working = makeOrdinaryTicket({
    crew: base.crew.map((member) => ({ ...member, leftAt: null, leftReason: null })),
    events: base.events.slice(0, 3),
    reports: [],
    segments: base.segments.map((segment) => ({ ...segment, endedAt: null, endReason: null })),
    state: {
      ...base.state,
      closeKind: null,
      closeNote: null,
      closedAt: null,
      closedByPerson: null,
    },
    status: 'working',
  });
  const updates: ReturnType<typeof updateEvent>[] = [];
  const size = (rows: unknown[]) =>
    Buffer.byteLength(JSON.stringify({ ...working, events: [...working.events, ...rows] }));
  while (size([...updates, updateEvent('u'.repeat(4_096))]) <= target) {
    updates.push(updateEvent('u'.repeat(4_096)));
  }
  const final = updateEvent('u'.repeat(2_000));
  const rows = [...updates, final];
  const difference = target - size(rows);
  if (difference > 0) final.text = `${final.text}${'u'.repeat(difference)}`;
  if (difference < 0) {
    const previous = updates.at(-1)!;
    previous.text = 'u'.repeat(previous.text.length + difference);
  }
  for (const event of rows) expect(event.text.length).toBeGreaterThan(0);
  for (const event of rows) expect(event.text.length).toBeLessThanOrEqual(4_096);
  const raw = { ...working, events: [...working.events, ...rows] };
  expect(Buffer.byteLength(JSON.stringify(raw))).toBe(target);
  return raw;
}

function nestedAtDepth(depth: number): unknown {
  let value: unknown = 'leaf';
  for (let level = 1; level < depth; level += 1) value = { child: value };
  return value;
}

describe('synthetic import schema', () => {
  it('T01 parses the complete happy path without defaults and canonicalizes key order', async () => {
    const schema = await loadSchema();
    const raw = makeOrdinaryTicket();
    const aliases = makeSyntheticExport().aliases;
    const exported = schema.parseSyntheticExport(makeSyntheticExport([raw], aliases));
    expect(exported).toEqual({ aliases, source: syntheticSource, tickets: [raw] });

    const parsed = schema.parseTicket(exported.tickets[0]);
    expect(parsed).toEqual({
      ...raw,
      reportedAt: new Date(raw.reportedAt),
      state: {
        ...raw.state,
        startedAt: dateOrNull(raw.state.startedAt),
        segmentStartedAt: dateOrNull(raw.state.segmentStartedAt),
        handoverSince: dateOrNull(raw.state.handoverSince),
        expectedBackAt: dateOrNull(raw.state.expectedBackAt),
        waitSince: dateOrNull(raw.state.waitSince),
        machineRunningAt: dateOrNull(raw.state.machineRunningAt),
        machineStoppedAt: dateOrNull(raw.state.machineStoppedAt),
        kindUpgradedAt: dateOrNull(raw.state.kindUpgradedAt),
        closedAt: dateOrNull(raw.state.closedAt),
        cancelledAt: dateOrNull(raw.state.cancelledAt),
      },
      events: raw.events.map((event) => ({ ...event, at: new Date(event.at) })),
      crew: raw.crew.map((member) => ({
        ...member,
        joinedAt: new Date(member.joinedAt),
        leftAt: dateOrNull(member.leftAt),
      })),
      segments: raw.segments.map((segment) => ({
        ...segment,
        startedAt: new Date(segment.startedAt),
        endedAt: dateOrNull(segment.endedAt),
      })),
      reports: raw.reports.map((report) => ({
        ...report,
        submittedAt: new Date(report.submittedAt),
      })),
    });

    const first = schema.makeRawEnvelope(raw, aliases);
    const second = schema.makeRawEnvelope(reverseKeys(raw), reverseKeys(aliases) as typeof aliases);
    expect(second).toEqual(first);
    const reordered = schema.makeRawEnvelope(
      { ...raw, events: [...raw.events].reverse() },
      aliases,
    );
    expect(reordered.rawSha256).not.toBe(first.rawSha256);
  });

  it('T02 accepts only the synthetic source and checks it before other fields', async () => {
    const schema = await loadSchema();
    for (const source of ['bhavin-v3', 'argus.synthetic-bhavin/v2', null]) {
      expectFailureAt(
        () => schema.parseSyntheticExport({ aliases: null, source, tickets: 'invalid' }),
        'source',
      );
    }
    expectFailureAt(
      () => schema.parseSyntheticExport({ aliases: null, tickets: 'invalid' }),
      'source',
    );
    expect(schema.parseSyntheticExport(makeSyntheticExport()).source).toBe(syntheticSource);
  });

  it('T03 rejects null and NUL recursively without unsafe property access', async () => {
    const schema = await loadSchema();
    const raw = makeOrdinaryTicket();
    const aliases = makeSyntheticExport().aliases;
    expect(() => schema.parseTicket(null)).toThrow();
    expectFailureAt(
      () => schema.parseTicket({ ...raw, events: [{ ...raw.events[0], text: 'bad\0text' }] }),
      'text',
    );
    expect(() => schema.makeRawEnvelope(null, aliases)).toThrow();
    expect(() => schema.assertSafeJson('top-level\0string')).toThrow(/NUL/);
    expect(() =>
      schema.parseSyntheticExport(
        makeSyntheticExport([], { ...aliases, machines: { 'bad\0key': 'M-1' } }),
      ),
    ).toThrow(/NUL/);
    expect(() => schema.assertSafeJson({ nested: { 'bad\0key': true } })).toThrow(/NUL/);
  });

  it('T04 enforces strict calendar and offset timestamps', async () => {
    const schema = await loadSchema();
    const invalid = [
      '2026-02-30T10:00:00Z',
      '2025-02-29T10:00:00Z',
      '2026-11-01T24:00:00Z',
      '2026-11-01T23:59:60Z',
      '2026-11-01T10:00:00',
      '2026-11-01T10:00:00 UTC',
      '2026-11-01T10:00:00+15:00',
      '2026-11-01T10:00:00+14:30',
      '2026-11-01T10:00:00+5:30',
    ];
    for (const value of invalid) {
      expect(() => schema.strictIsoTimestamp(value)).toThrow();
      expectFailureAt(
        () => schema.parseTicket(makeOrdinaryTicket({ reportedAt: value })),
        'reportedAt',
      );
    }
    const valid = new Map([
      ['2026-11-01T10:00:00Z', '2026-11-01T10:00:00.000Z'],
      ['2026-11-01T10:00:00.1Z', '2026-11-01T10:00:00.100Z'],
      ['2026-11-01T10:00:00.12Z', '2026-11-01T10:00:00.120Z'],
      ['2026-11-01T10:00:00.123+05:30', '2026-11-01T04:30:00.123Z'],
      ['2026-11-01T10:00:00-04:00', '2026-11-01T14:00:00.000Z'],
    ]);
    for (const [value, instant] of valid) {
      expect(schema.strictIsoTimestamp(value).toISOString()).toBe(instant);
      expect(
        schema.parseTicket(makeOrdinaryTicket({ reportedAt: value })).reportedAt.toISOString(),
      ).toBe(instant);
    }
    expect(schema.strictCalendarDate('2024-02-29')).toBe('2024-02-29');
    for (const date of ['2026-02-30', '2025-02-29', '2026-11-01T00:00:00Z']) {
      expect(() => schema.strictCalendarDate(date)).toThrow();
      const report = { ...makeOrdinaryTicket().reports[0], date };
      expectFailureAt(() => schema.parseTicket(makeOrdinaryTicket({ reports: [report] })), 'date');
    }
  });

  it('T05 requires every collection/cache and strict object while allowing explicit nulls', async () => {
    const schema = await loadSchema();
    const raw = makeOrdinaryTicket();
    for (const key of ['events', 'crew', 'segments', 'reports', 'state', 'storedFigures']) {
      expectFailureAt(() => schema.parseTicket(omit(raw, key)), key);
    }
    expectFailureAt(
      () => schema.parseTicket({ ...raw, state: omit(raw.state, 'selfStarted') }),
      'selfStarted',
    );

    const edit = {
      at: '2026-11-01T11:00:00Z',
      by: 'Asha',
      payload: { changes: [{ field: 'problem', from: 'old', to: 'new' }] },
      text: 'reason',
      type: 'edit',
    };
    const unknownCases: Array<[unknown, string]> = [
      [{ ...makeSyntheticExport(), unknown: true }, 'unknown'],
      [{ ...raw, unknown: true }, 'unknown'],
      [{ ...raw, state: { ...raw.state, unknown: true } }, 'unknown'],
      [{ ...raw, events: [{ ...raw.events[0], unknown: true }] }, 'unknown'],
      [{ ...raw, events: [{ ...raw.events[1], payload: { unknown: true } }] }, 'unknown'],
      [{ ...raw, crew: [{ ...raw.crew[0], unknown: true }] }, 'unknown'],
      [{ ...raw, segments: [{ ...raw.segments[0], unknown: true }] }, 'unknown'],
      [{ ...raw, reports: [{ ...raw.reports[0], unknown: true }] }, 'unknown'],
      [{ ...raw, storedFigures: { ...raw.storedFigures, unknown: true } }, 'unknown'],
      [
        {
          ...raw,
          events: [
            { ...edit, payload: { changes: [{ ...edit.payload.changes[0], unknown: true }] } },
          ],
        },
        'unknown',
      ],
    ];
    for (const [value, path] of unknownCases) {
      if (value && typeof value === 'object' && 'source' in value) {
        expectFailureAt(() => schema.parseSyntheticExport(value), path);
      } else {
        expectFailureAt(() => schema.parseTicket(value), path);
      }
    }

    const nullable = makeOrdinaryTicket({
      reportedByPerson: null,
      state: { ...raw.state, closeNote: null },
      reports: [
        {
          ...raw.reports[0],
          correctiveAction: null,
          observedBy: null,
          repairMin: null,
          responseMin: null,
          rootCause: null,
        },
      ],
    });
    const parsed = schema.parseTicket(nullable);
    expect(parsed.reportedByPerson).toBeNull();
    expect(parsed.state.closeNote).toBeNull();
    expect(parsed.reports[0]?.responseMin).toBeNull();
    expect(parsed.reports[0]?.repairMin).toBeNull();
  });

  it('T06 rejects invalid enums and mismatched typed event payloads', async () => {
    const schema = await loadSchema();
    const raw = makeOrdinaryTicket();
    const cases: Array<[unknown, string]> = [
      [{ ...raw, events: [{ ...raw.events[0], type: 'invented' }] }, 'type'],
      [{ ...raw, segments: [{ ...raw.segments[0], endReason: 'done' }] }, 'endReason'],
      [{ ...raw, events: [{ ...raw.events[3], payload: { kind: 'closed' } }] }, 'kind'],
      [{ ...raw, crew: [{ ...raw.crew[0], role: 'manager' }] }, 'role'],
      [{ ...raw, segments: [{ ...raw.segments[0], role: 'manager' }] }, 'role'],
      [{ ...raw, events: [{ ...raw.events[1], payload: { role: 'primary' } }] }, 'payload'],
      [
        {
          ...raw,
          events: [
            {
              at: '2026-11-01T11:00:00Z',
              by: 'Asha',
              text: 'reason',
              type: 'edit',
              payload: { changes: [{ field: 'activeMin', from: 0, to: 1 }] },
            },
          ],
        },
        'field',
      ],
    ];
    for (const [value, path] of cases) expectFailureAt(() => schema.parseTicket(value), path);
  });

  it('T07 enforces exact canonical raw-ticket and event-payload byte caps', async () => {
    const schema = await loadSchema();
    const exactPayload = {
      changes: [{ field: 'problem', from: 'f'.repeat(4_070), to: 't'.repeat(4_071) }],
    };
    const overPayload = {
      changes: [{ field: 'problem', from: 'f'.repeat(4_070), to: 't'.repeat(4_072) }],
    };
    expect(exactPayload.changes[0]?.from.length).toBe(4_070);
    expect(exactPayload.changes[0]?.to.length).toBe(4_071);
    expect(overPayload.changes[0]?.to.length).toBe(4_072);
    expect(Buffer.byteLength(schema.canonicalJson(exactPayload))).toBe(8_192);
    expect(Buffer.byteLength(schema.canonicalJson(overPayload))).toBe(8_193);
    expect(schema.parseTicket(ticketWithEdit(exactPayload, 't'.repeat(4_071)))).toBeDefined();
    const payloadError = captureError(() =>
      schema.parseTicket(ticketWithEdit(overPayload, 't'.repeat(4_072))),
    );
    const payloadIssues = JSON.stringify((payloadError as { issues?: unknown }).issues);
    expect(payloadIssues).toContain('payload_bytes');
    expect(payloadIssues).toContain('"events",4,"payload"');
    expect(payloadIssues).not.toContain('string_length');

    expect(schema.parseTicket(rawTicketAtBytes(262_144))).toBeDefined();
    expectFailureAt(() => schema.parseTicket(rawTicketAtBytes(262_145)), 'raw_ticket_bytes');
  });

  it('T08 enforces exact collection and alias caps with collection paths', async () => {
    const schema = await loadSchema();
    const raw = makeOrdinaryTicket();
    const events = Array.from({ length: 2_000 }, minimalEvent);
    expect(schema.parseTicket({ ...raw, events })).toBeDefined();
    expectFailureAt(
      () => schema.parseTicket({ ...raw, events: [...events, minimalEvent()] }),
      'events',
    );

    expect(
      schema.parseSyntheticExport(makeSyntheticExport(Array(2_000).fill(null))).tickets,
    ).toHaveLength(2_000);
    expectFailureAt(
      () => schema.parseSyntheticExport(makeSyntheticExport(Array(2_001).fill(null))),
      'tickets',
    );

    const crew = Array.from({ length: 128 }, (_, index) => ({
      joinedAt: '2026-11-01T10:05:00Z',
      leftAt: null,
      leftReason: null,
      person: `P${index}`,
      role: 'support',
    }));
    expect(schema.parseTicket({ ...raw, crew })).toBeDefined();
    expectFailureAt(() => schema.parseTicket({ ...raw, crew: [...crew, crew[0]] }), 'crew');

    const segments = Array.from({ length: 2_000 }, () => ({
      endReason: null,
      endedAt: null,
      person: 'P',
      role: 'support',
      startedAt: '2026-11-01T10:05:00Z',
    }));
    expect(
      schema.parseTicket({ ...raw, crew: [], events: [], reports: [], segments }),
    ).toBeDefined();
    expectFailureAt(
      () =>
        schema.parseTicket({
          ...raw,
          crew: [],
          events: [],
          reports: [],
          segments: [...segments, segments[0]],
        }),
      'segments',
    );

    expect(schema.parseTicket(raw)).toBeDefined();
    expectFailureAt(
      () => schema.parseTicket({ ...raw, reports: [raw.reports[0], raw.reports[0]] }),
      'reports',
    );

    for (const field of ['doneBy', 'supportedBy'] as const) {
      const people = Array.from({ length: 128 }, (_, index) => `Person ${index}`);
      const report = { ...raw.reports[0], doneBy: [], supportedBy: [], [field]: people };
      expect(schema.parseTicket({ ...raw, reports: [report] })).toBeDefined();
      expectFailureAt(
        () =>
          schema.parseTicket({ ...raw, reports: [{ ...report, [field]: [...people, 'extra'] }] }),
        field,
      );
    }

    const combinedReport = {
      ...raw.reports[0],
      doneBy: Array.from({ length: 128 }, (_, index) => `Done ${index}`),
      supportedBy: Array.from({ length: 128 }, (_, index) => `Supported ${index}`),
    };
    expect(schema.parseTicket({ ...raw, reports: [combinedReport] })).toBeDefined();

    const changes = allEditChanges();
    expect(changes).toHaveLength(10);
    expect(schema.parseTicket(ticketWithEdit({ changes }))).toBeDefined();
    const capError = captureError(() =>
      schema.parseTicket(ticketWithEdit({ changes: [...changes, changes[0]] })),
    );
    const capIssues = JSON.stringify((capError as { issues?: unknown }).issues);
    expect(capIssues).toContain('array_cap');
    expect(capIssues).not.toContain('duplicate_field');
    expectFailureAt(
      () => schema.parseTicket(ticketWithEdit({ changes: [changes[0], changes[0]] })),
      'duplicate_field',
    );

    for (const kind of ['machines', 'people', 'maintenanceCodes'] as const) {
      const entries = Array.from({ length: 512 }, (_, index) => [
        `Key ${index}`,
        `Target ${index}`,
      ]);
      const exact = {
        machines: {},
        people: {},
        maintenanceCodes: {},
        [kind]: Object.fromEntries(entries),
      };
      expect(schema.parseSyntheticExport(makeSyntheticExport([], exact))).toBeDefined();
      const tooMany = { ...exact, [kind]: Object.fromEntries([...entries, ['extra', 'target']]) };
      expectFailureAt(() => schema.parseSyntheticExport(makeSyntheticExport([], tooMany)), kind);
    }
  });

  it('T09 enforces exact JSON depth and UTF-16 string bounds', async () => {
    const schema = await loadSchema();
    expect(schema.parseTicket(makeOrdinaryTicket({ machineCode: 'm'.repeat(256) }))).toBeDefined();
    expectFailureAt(
      () => schema.parseTicket(makeOrdinaryTicket({ machineCode: 'm'.repeat(257) })),
      'machineCode',
    );
    expect(schema.parseTicket(makeOrdinaryTicket({ problem: 'x'.repeat(4_096) }))).toBeDefined();
    expectFailureAt(
      () => schema.parseTicket(makeOrdinaryTicket({ problem: 'x'.repeat(4_097) })),
      'problem',
    );
    expect(schema.parseTicket(makeOrdinaryTicket({ legacyId: 'l'.repeat(128) }))).toBeDefined();
    expectFailureAt(
      () => schema.parseTicket(makeOrdinaryTicket({ legacyId: 'l'.repeat(129) })),
      'legacyId',
    );

    expect(() => schema.assertSafeJson(nestedAtDepth(16))).not.toThrow();
    expect(() => schema.assertSafeJson(nestedAtDepth(17))).toThrow(/depth|16/i);
    const depthEight = captureError(() =>
      schema.parseTicket({
        ...makeOrdinaryTicket(),
        events: [{ ...updateEvent('note'), payload: nestedAtDepth(8) }],
      }),
    );
    expect(JSON.stringify((depthEight as { issues?: unknown }).issues)).not.toContain(
      'payload_depth',
    );
    expect(JSON.stringify((depthEight as { issues?: unknown }).issues)).toContain('child');
    expectFailureAt(
      () =>
        schema.parseTicket({
          ...makeOrdinaryTicket(),
          events: [{ ...updateEvent('note'), payload: nestedAtDepth(9) }],
        }),
      'payload_depth',
    );
  });

  it('T10 enforces ref boundaries, kind prefixes, past breakdowns, and parent refs', async () => {
    const schema = await loadSchema();
    for (const ref of ['BD-1', 'BD-0001', 'BD-2147483646']) {
      expect(schema.parseTicket(makeOrdinaryTicket({ ref }))).toBeDefined();
      expect(schema.parseTicket(makeOrdinaryTicket({ kind: 'support', ref }))).toBeDefined();
    }
    const general = (ref: string, parentRef: string | null = null) =>
      makeOrdinaryTicket({
        kind: 'general',
        ref,
        parentRef,
        machineCode: null,
        location: 'Cell-1',
        workType: 'breakdown',
        reports: [],
      });
    for (const ref of ['WR-1', 'WR-2147483646'])
      expect(schema.parseTicket(general(ref))).toBeDefined();
    for (const ref of [
      'BD-0',
      'BD-2147483647',
      'BD--1',
      'BD-',
      'BD-1.0',
      'BD-+1',
      'bd-1',
      'XX-1',
    ]) {
      expectFailureAt(() => schema.parseTicket(makeOrdinaryTicket({ ref })), 'ref');
    }
    for (const ref of ['WR-0', 'WR-2147483647', 'WR--1']) {
      expectFailureAt(() => schema.parseTicket(general(ref)), 'ref');
    }
    expectFailureAt(() => schema.parseTicket(makeOrdinaryTicket({ ref: 'WR-1' })), 'ref');
    expectFailureAt(() => schema.parseTicket(general('BD-1')), 'ref');
    expect(schema.parseTicket(makeOrdinaryTicket({ entryType: 'pastBreakdown' }))).toBeDefined();
    expectFailureAt(
      () => schema.parseTicket(makeOrdinaryTicket({ entryType: 'pastBreakdown', kind: 'support' })),
      'entryType',
    );
    expectFailureAt(
      () => schema.parseTicket({ ...general('WR-1'), entryType: 'pastBreakdown' }),
      'entryType',
    );
    expect(schema.parseTicket(general('WR-1', 'WR-2'))).toBeDefined();
    expectFailureAt(
      () => schema.parseTicket(makeOrdinaryTicket({ parentRef: 'BD-2' })),
      'parentRef',
    );
    expectFailureAt(() => schema.parseTicket(general('WR-1', 'WR-1')), 'parentRef');
  });

  it('T11 requires every report fact and never defaults report values', async () => {
    const schema = await loadSchema();
    const raw = makeOrdinaryTicket();
    for (const key of ['submittedAt', 'submittedBy', 'date', 'shiftCode', 'downtimeMin']) {
      expectFailureAt(
        () => schema.parseTicket({ ...raw, reports: [omit(raw.reports[0]!, key)] }),
        key,
      );
    }
    for (const key of ['responseMin', 'repairMin']) {
      const past = { ...raw, entryType: 'pastBreakdown' };
      expectFailureAt(
        () => schema.parseTicket({ ...past, reports: [omit(raw.reports[0]!, key)] }),
        key,
      );
      expectFailureAt(
        () => schema.parseTicket({ ...past, reports: [{ ...raw.reports[0], [key]: null }] }),
        key,
      );
    }
    const ordinary = { ...raw.reports[0], responseMin: null, repairMin: null };
    const parsed = schema.parseTicket({ ...raw, reports: [ordinary] });
    expect(parsed.reports[0]).toMatchObject({
      date: '2026-11-01',
      shiftCode: '1',
      downtimeMin: 60,
      responseMin: null,
      repairMin: null,
      submittedBy: 'SYNTH-LEAD',
    });
    expect(parsed.reports[0]?.submittedAt.toISOString()).toBe('2026-11-01T11:00:00.000Z');
  });

  it('T12 binds raw and identity hashes to canonical JSON and array order', async () => {
    const schema = await loadSchema();
    const raw = makeOrdinaryTicket();
    const aliases = makeSyntheticExport().aliases;
    const baseline = schema.makeRawEnvelope(raw, aliases);
    expect(baseline).toEqual({
      format: 'argus.import-raw/v1',
      raw,
      canonicalJson: schema.canonicalJson(raw),
      rawSha256: schema.canonicalSha256(raw),
      identitySha256: baseline.identitySha256,
    });
    expect(baseline.rawSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(
      schema.makeRawEnvelope(reverseKeys(raw), reverseKeys(aliases) as typeof aliases),
    ).toEqual(baseline);

    const ticketChange = schema.makeRawEnvelope(
      { ...raw, problem: 'Changed synthetic problem' },
      aliases,
    );
    expect(ticketChange.rawSha256).not.toBe(baseline.rawSha256);
    expect(ticketChange.identitySha256).not.toBe(baseline.identitySha256);
    const aliasChange = schema.makeRawEnvelope(raw, {
      ...aliases,
      machines: { 'SYNTH-MACHINE': 'M-2' },
    });
    expect(aliasChange.rawSha256).toBe(baseline.rawSha256);
    expect(aliasChange.identitySha256).not.toBe(baseline.identitySha256);
    const arrayChange = schema.makeRawEnvelope(
      { ...raw, events: [...raw.events].reverse() },
      aliases,
    );
    expect(arrayChange.rawSha256).not.toBe(baseline.rawSha256);
    expect(arrayChange.identitySha256).not.toBe(baseline.identitySha256);
    expect(schema.canonicalJson({ b: 1, a: { d: 2, c: 3 }, arr: [{ z: 1, a: 2 }] })).toBe(
      '{"a":{"c":3,"d":2},"arr":[{"a":2,"z":1}],"b":1}',
    );
  });

  it('fixture base preserves join provenance and leaves crew without leave events', () => {
    const raw = makeOrdinaryTicket();
    expect(raw.events.map((event) => event.type)).toEqual(['down', 'start', 'join', 'close']);
    expect(raw.crew.map((member) => [member.leftAt, member.leftReason])).toEqual([
      [null, null],
      [null, null],
    ]);
    expect(raw.segments.map((segment) => [segment.endedAt, segment.endReason])).toEqual([
      ['2026-11-01T11:00:00Z', 'close'],
      ['2026-11-01T11:00:00Z', 'close'],
    ]);
    expect(raw.state.machineRunningAt).toBeNull();
    expect(raw.state.machineStoppedAt).toBeNull();
    expect(raw.location).toBe('Cell-1');
    expect(raw.workType).toBe('breakdown');
    expect(raw.reports[0]).toMatchObject({ breakdownCategory: 'E', observedBy: 'Engineer' });
  });

  it('fixture builds every complete reconciliation reference map', async () => {
    const fixture = await import('./import-fixture.js');
    expect(fixture.makeReconcileReferences).toBeTypeOf('function');
    const refs = fixture.makeReconcileReferences();
    expect(refs.timeZone).toBe('UTC');
    expect(refs.machine).toEqual({
      id: fixture.syntheticIds.machine,
      code: 'M-1',
      category: 'CNC',
      cell: 'Cell-1',
      criticality: null,
    });
    expect(refs.workTypes.get('BREAKDOWN')).toEqual({ code: 'breakdown' });
    expect(refs.locations.get('CELL-1')).toEqual({ code: 'Cell-1' });
    expect(refs.waitReasons.get('SPARE')).toEqual({
      code: 'spare',
      isVendor: true,
      pausesSla: true,
    });
    expect(refs.breakdownCategories.get('E')).toEqual({ code: 'E' });
    expect(refs.observedBy.get('ENGINEER')).toEqual({ code: 'Engineer' });
    expect(refs.maintenanceCodes.get('M')).toEqual({ code: 'M' });
    expect(refs.maintenanceAliases.get('SYNTH-MAINT')).toBe('M');
    expect(refs.shifts.get('1')).toEqual({
      code: '1',
      startsAt: '08:00',
      endsAt: '18:30',
      crossesMidnight: false,
    });
    expect(refs.shifts.get('2')).toEqual({
      code: '2',
      startsAt: '18:30',
      endsAt: '08:00',
      crossesMidnight: true,
    });
    expect(refs.people.get('synth-lead')).toBe(fixture.syntheticIds.asha);
    expect(refs.people.get('asha')).toBe(fixture.syntheticIds.asha);
    expect(refs.people.get('bina')).toBe(fixture.syntheticIds.bina);
    expect(refs.pendingPersons.size).toBe(0);
  });

  it('fixture seeder succeeds against disposable Postgres', async () => {
    const db = await startTestDb();
    try {
      const fixture = await import('./import-fixture.js');
      await fixture.seedSyntheticTenant(db.admin);
      const counts = (
        await db.admin.query(
          `SELECT
             (SELECT count(*) FROM tenant WHERE id = $1)::int AS tenants,
             (SELECT count(*) FROM machine WHERE tenant_id = $1)::int AS machines,
             (SELECT count(*) FROM person WHERE tenant_id = $1)::int AS people,
             (SELECT count(*) FROM list_item WHERE tenant_id = $1)::int AS "listItems",
             (SELECT count(*) FROM shift WHERE tenant_id = $1)::int AS shifts`,
          [fixture.syntheticIds.tenant],
        )
      ).rows[0];
      expect(counts).toMatchObject({ tenants: 1, machines: 1, people: 3, listItems: 6, shifts: 2 });
      const wait = (
        await db.admin.query(
          "SELECT code, is_vendor, pauses_sla FROM list_item WHERE tenant_id = $1 AND list = 'wait_reason'",
          [fixture.syntheticIds.tenant],
        )
      ).rows[0];
      expect(wait).toEqual({ code: 'spare', is_vendor: true, pauses_sla: true });
    } finally {
      await db.stop();
    }
  }, 120_000);
});
