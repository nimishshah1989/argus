import { readFileSync } from 'node:fs';
import Fastify from 'fastify';
import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { apiError } from '@uptimo/shared';
import { storedReportSchema } from '@uptimo/shared/ticket-reply';
import { REPLY_SCHEMAS } from '@uptimo/shared/replies';
import { buildApp } from '../src/app.js';
import { registerReplyCheck, replyProblem, routeTable } from '../src/kernel/index.js';
import { GOLDEN_FILE } from './fixtures/state-golden.js';

type App = Awaited<ReturnType<typeof buildApp>>;

const pool = { query: async () => ({ rows: [], rowCount: 0 }) } as unknown as Pool;
const STATE = 'GET /api/v1/state';
const golden = () =>
  JSON.parse(readFileSync(GOLDEN_FILE, 'utf8')) as {
    open: Array<Record<string, unknown>>;
    now?: string;
  };

describe('reply contract', () => {
  let app: App;
  beforeAll(async () => {
    app = await buildApp({
      pool,
      logger: false,
      jobBoss: { getQueue: async () => ({}) } as unknown as PgBoss,
    });
    await app.ready();
  });
  afterAll(() => app.close());

  it('has a reply schema for every route', () => {
    const keys = routeTable(app)
      .filter((r) => r.method !== 'HEAD')
      .map((r) => `${r.method} ${r.url}`)
      .sort();
    expect(keys).toEqual(Object.keys(REPLY_SCHEMAS).sort());
    expect(keys).toHaveLength(121);
  });

  it("accepts today's /state reply", () => {
    expect(replyProblem(STATE, 200, golden())).toBeNull();
  });

  it('fails a reply with a missing field', () => {
    const noSla = golden();
    delete noSla.open[0]!.sla;
    expect(replyProblem(STATE, 200, noSla)).toContain('open.0.sla');
    const noAck = golden();
    delete noAck.open[0]!.canAcknowledge;
    expect(replyProblem(STATE, 200, noAck)).toContain('open.0.canAcknowledge');
    const noNow = golden();
    delete noNow.now;
    expect(replyProblem(STATE, 200, noNow)).toContain('now');
  });

  it('fails a reply with an extra field', () => {
    const extra = golden();
    extra.open[0]!.tags = [];
    expect(replyProblem(STATE, 200, extra)).toMatch(/open\.0 .*Unrecognized key/);
    expect(replyProblem(STATE, 200, { ...golden(), version: 1 })).not.toBeNull();
  });

  it('accepts an error body only on an error status', () => {
    const notFound = apiError('not_found', 'Unknown ticket');
    expect(replyProblem(STATE, 404, notFound)).toBeNull();
    expect(replyProblem(STATE, 200, notFound)).not.toBeNull();
    expect(replyProblem(STATE, 422, { message: 'x' })).not.toBeNull();
    expect(replyProblem('GET /api/v1/nope', 200, {})).toContain('has no reply schema');
  });
});

describe('a stored report in a reply', () => {
  const report = {
    id: 'r1',
    machineId: 'm1',
    date: '2026-11-10',
    shiftCode: '1',
    problem: 'Pump',
    ticketId: 't1',
    observedBy: null,
    correctiveAction: null,
    breakdownCategory: null,
    maintCode: null,
    spareUsed: null,
    rootCause: null,
    handoverPersonId: 'p1',
    handoverName: 'Bina',
    submittedByPersonId: null,
    downtimeMin: 0,
    responseMin: null,
    repairMin: null,
    submittedAt: '2026-11-10T05:00:00.000Z',
    people: [],
  };

  it('carries the handover as a display name next to the person it points at', () => {
    expect(storedReportSchema.safeParse(report).success).toBe(true);
    expect(
      storedReportSchema.safeParse({
        ...report,
        handoverPersonId: null,
        handoverName: 'Night crew',
      }).success,
    ).toBe(true);
  });

  it('fails a report that leaves out the display name or the person link', () => {
    const without = (key: string) =>
      Object.fromEntries(Object.entries(report).filter(([k]) => k !== key));
    expect(storedReportSchema.safeParse(without('handoverName')).success).toBe(false);
    expect(storedReportSchema.safeParse(without('handoverPersonId')).success).toBe(false);
  });
});

describe('reply check hook', () => {
  it('turns a broken reply into a 500 and leaves good and binary replies alone', async () => {
    const app = Fastify();
    registerReplyCheck(app);
    let brand: object = { company: 'Fake Co', logo: null, extra: true };
    app.get('/api/v1/brand', async () => brand);
    const pdf = Buffer.from('%PDF-fake');
    app.get('/api/v1/reports/day.pdf', async (_request, reply) =>
      reply.header('content-type', 'application/pdf').send(pdf),
    );
    const bad = await app.inject({ method: 'GET', url: '/api/v1/brand' });
    expect(bad.statusCode).toBe(500);
    expect(bad.json().error.code).toBe('internal');
    expect(bad.json().error.message).toMatch(/^Reply contract:/);
    brand = { company: 'Fake Co', logo: null };
    const good = await app.inject({ method: 'GET', url: '/api/v1/brand' });
    expect(good.statusCode).toBe(200);
    expect(good.json()).toEqual(brand);
    const file = await app.inject({ method: 'GET', url: '/api/v1/reports/day.pdf' });
    expect(file.statusCode).toBe(200);
    expect(file.rawPayload.equals(pdf)).toBe(true);
    await app.close();
  });
});
