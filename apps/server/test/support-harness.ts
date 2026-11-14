import { createHash, randomBytes } from 'node:crypto';
import { expect } from 'vitest';
import { loggerOptions } from '../src/kernel/index.js';
import { startPeopleApp, type PeopleApp, type Res } from './people-harness.js';

export const HOST_A = 'cosmos.localhost';
export const HOST_B = 'plant-two.localhost';
export const NO_SUCH = '10000000-0000-4000-8000-00000000dead';
export const DAY_MS = 86_400_000;

/** A support key as it is issued: 32 random bytes. Made at run time, so no key and no hash is ever in a file. */
export const newKey = (): string => randomBytes(32).toString('base64url');
export const keyHash = (key: string): string => createHash('sha256').update(key).digest('hex');

export interface Send {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  host?: string;
  /** A session token, or a support key. */
  token?: string;
  /** The grant a support call names. */
  grant?: string;
  payload?: object;
  ip?: string;
}

export interface Grant {
  id: string;
  platformUser: string;
  reason: string;
  createdAt: string;
  expiresAt: string;
  approvedBy: string | null;
  status?: 'active' | 'ended';
}

export interface SupportApp extends PeopleApp {
  /** The keys of our two invented staff, `dev-one` and `dev-two`. */
  keys: { one: string; two: string };
  /** Every line the server logged. */
  logged: string[];
  send: (call: Send) => Promise<Res>;
  /** A customer admin approves access for `dev-one` (3 days unless the body says otherwise). */
  approve: (adminToken: string, body?: object, host?: string) => Promise<Grant>;
  /** One call by a support person under a grant. */
  support: (key: string, grant: string, call: Omit<Send, 'token' | 'grant'>) => Promise<Res>;
  /** The customer's own view of its grants. */
  grants: (adminToken: string, host?: string) => Promise<Grant[]>;
}

export const GRANT = { platformUser: 'dev-one', reason: 'Look at a wrong day report', days: 3 };

export async function startSupportApp(): Promise<SupportApp> {
  const keys = { one: newKey(), two: newKey() };
  const logged: string[] = [];
  const t = await startPeopleApp({
    supportKeys: new Map([
      ['dev-one', keyHash(keys.one)],
      ['dev-two', keyHash(keys.two)],
    ]),
    logger: loggerOptions({ write: (line) => logged.push(line) }),
  });
  const send: SupportApp['send'] = ({ method, url, host, token, grant, payload, ip }) =>
    t.app.inject({
      method,
      url,
      ...(ip ? { remoteAddress: ip } : {}),
      headers: {
        host: host ?? HOST_A,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(grant ? { 'x-support-grant': grant } : {}),
      },
      ...(payload ? { payload } : {}),
    });
  const approve: SupportApp['approve'] = async (adminToken, body = {}, host) => {
    const payload = { ...GRANT, ...body };
    const url = '/api/v1/support-access';
    const res = await send({ method: 'POST', url, host, payload, token: adminToken });
    expect(res.statusCode, res.body).toBe(201);
    return res.json();
  };
  const grants: SupportApp['grants'] = async (adminToken, host) => {
    const res = await send({
      method: 'GET',
      url: '/api/v1/support-access',
      host,
      token: adminToken,
    });
    expect(res.statusCode, res.body).toBe(200);
    return res.json().items;
  };
  const support: SupportApp['support'] = (key, grant, call) => send({ ...call, token: key, grant });
  return { ...t, keys, logged, send, approve, support, grants };
}
