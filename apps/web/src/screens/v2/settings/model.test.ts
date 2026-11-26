// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { jobsTakeaway, settingsAccess } from './model.js';

const job = (id: string, createdAt: string, failedAt: string | null, attempts = 3) => ({
  id,
  queue: `queue-${id}`,
  error: 'boom',
  attempts,
  createdAt,
  failedAt,
});

describe('S26-1 Settings model', () => {
  it('lets the admin and the head in, refuses the rest, waits while loading', () => {
    expect(settingsAccess('admin')).toBe('allowed');
    expect(settingsAccess('head')).toBe('allowed');
    expect(settingsAccess('technician')).toBe('refused');
    expect(settingsAccess(undefined)).toBe('waiting');
  });

  it('names the oldest failure and counts every failed job', () => {
    const items = [
      job('b', '2026-11-20T08:00:00.000Z', '2026-11-22T08:00:00.000Z', 5),
      job('a', '2026-11-19T08:00:00.000Z', '2026-11-21T08:00:00.000Z', 4),
    ];
    expect(jobsTakeaway(items)).toEqual({
      failed: 2,
      kind: 'queue-a',
      attempts: 4,
      failedAt: '2026-11-21T08:00:00.000Z',
    });
  });

  it('has no takeaway when nothing failed', () => {
    expect(jobsTakeaway([])).toBeNull();
  });
});
