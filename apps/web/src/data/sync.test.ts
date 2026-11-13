import { describe, expect, it } from 'vitest';
import { syncId } from './sync.js';

describe('syncId', () => {
  it('shows offline, sending, draft and online in that order of precedence', () => {
    expect(syncId({ online: false, queued: 1, drafts: 1 })).toBe('offline');
    expect(syncId({ online: true, queued: 1, drafts: 0 })).toBe('sending');
    expect(syncId({ online: true, queued: 1, drafts: 1 })).toBe('sending');
    expect(syncId({ online: true, queued: 0, drafts: 2 })).toBe('draft');
    expect(syncId({ online: true, queued: 0, drafts: 0 })).toBe('online');
  });
});
