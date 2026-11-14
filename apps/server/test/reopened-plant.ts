import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { expect } from 'vitest';
import type { buildApp } from '../src/app.js';

export const PASSWORD = 'correct-horse-battery';
type App = Awaited<ReturnType<typeof buildApp>>;

/** One plant for the reopened-twice tests: a reporter, a technician lead, a head, a plant head and spare machines. */
export interface Plant {
  id: string;
  people: { rina: string; lal: string; hema: string; pravin: string };
  machines: string[];
  /** A request as the named person's session (empty `as` is signed out). */
  as(
    who: string,
    method: 'GET' | 'POST' | 'PUT',
    url: string,
    body?: { payload?: object; key?: string },
  ): Promise<LightMyRequestResponse>;
}

const ROLES = { rina: 'operator', lal: 'technician', hema: 'head', pravin: 'plant_head' } as const;

async function seedRows(admin: Pool, id: string, options: { policies: boolean }) {
  const people = {
    rina: randomUUID(),
    lal: randomUUID(),
    hema: randomUUID(),
    pravin: randomUUID(),
  };
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  for (const [name, personId] of Object.entries(people)) {
    const production = name === 'rina';
    await admin.query(
      'INSERT INTO person (id, tenant_id, name, team, kind) VALUES ($1, $2, $3, $4, $5)',
      [
        personId,
        id,
        name,
        production ? 'production' : 'maintenance',
        production ? 'production' : 'staff',
      ],
    );
    await admin.query(
      `INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared)
       VALUES ($1, $2, $3, $4, $5, false)`,
      [id, personId, name, passwordHash, ROLES[name as keyof typeof ROLES]],
    );
  }
  await admin.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 1)",
    [id],
  );
  if (options.policies)
    await admin.query(
      `INSERT INTO sla_policy (tenant_id, severity, ack_minutes, restore_minutes, handback_minutes) VALUES
        ($1, 'S1', 600, 2400, 600), ($1, 'S2', 900, 3600, 600), ($1, 'S3', 1200, 4800, 600), ($1, 'S4', 1800, 7200, 600)`,
      [id],
    );
  const machines: string[] = [];
  for (let i = 0; i < 12; i += 1) {
    machines.push(randomUUID());
    await admin.query(
      "INSERT INTO machine (id, tenant_id, code, criticality, cell) VALUES ($1, $2, $3, 'A', 'C1')",
      [machines[i], id, `VC-${i}`],
    );
  }
  return { people, machines };
}

export async function seedPlant(
  ctx: { app: App; admin: Pool },
  slug: string,
  options: { policies: boolean },
): Promise<Plant> {
  const { app, admin } = ctx;
  const id = randomUUID();
  await admin.query('INSERT INTO tenant (id, slug, name) VALUES ($1, $2, $2)', [id, slug]);
  const { people, machines } = await seedRows(admin, id, options);
  const tokens: Record<string, string> = {};
  let keys = 0;
  const as: Plant['as'] = (who, method, url, body = {}) => {
    keys += 1;
    return app.inject({
      method,
      url,
      headers: {
        host: `${slug}.localhost`,
        'content-type': 'application/json',
        ...(who ? { authorization: `Bearer ${tokens[who]}` } : {}),
        'idempotency-key': body.key ?? `${slug}-${keys}`,
      },
      ...(body.payload ? { payload: body.payload } : {}),
    });
  };
  for (const name of Object.keys(people)) {
    const res = await as('', 'POST', '/api/v1/auth/login', {
      payload: { username: name, password: PASSWORD },
    });
    expect(res.statusCode, `${slug} login ${name}`).toBe(200);
    tokens[name] = res.json().token as string;
  }
  return { id, people, machines, as };
}
