// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { jobsTakeaway, settingsAccess } from '../settings/model.js';

const job = (id: string, createdAt: string, failedAt: string | null) => ({
  id,
  queue: `queue-${id}`,
  error: 'boom',
  attempts: 1,
  createdAt,
  failedAt,
});

describe('S26-1 Settings: edges', () => {
  it('reads a job with no failedAt by its createdAt', () => {
    const items = [
      job('late', '2026-11-10T00:00:00.000Z', '2026-11-24T00:00:00.000Z'),
      job('nofail', '2026-11-12T00:00:00.000Z', null),
    ];
    expect(jobsTakeaway(items)).toMatchObject({
      failed: 2,
      kind: 'queue-nofail',
      failedAt: '2026-11-12T00:00:00.000Z',
    });
  });

  it('refuses the plant head, supervisor and operator', () => {
    for (const role of ['plant_head', 'supervisor', 'operator']) {
      expect(settingsAccess(role)).toBe('refused');
    }
  });
});
