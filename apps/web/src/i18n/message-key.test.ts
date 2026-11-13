import { describe, expect, it } from 'vitest';
import type { StatusDef } from '../ui/status/index.js';
import { ticket } from '../ui/status/ticket.js';

describe('MessageKey', () => {
  it('rejects an English status label', () => {
    // @ts-expect-error an English literal is not a MessageKey
    const english: Pick<StatusDef, 'label'> = { label: 'Stopped' };
    const keyed: Pick<StatusDef, 'label'> = { label: 'status.ticket.stopped' };
    expect(english.label).toBe('Stopped');
    expect(keyed.label).toBe(ticket.stopped.label);
  });
});
