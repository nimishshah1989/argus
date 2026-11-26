import { describe, expect, it } from 'vitest';
import { minuteTileColumns } from './detail-kit.js';

describe('minute tiles', () => {
  it('draws two figures as halves and three as thirds, as the mockup does', () => {
    expect(minuteTileColumns(2)).toBe(2);
    expect(minuteTileColumns(3)).toBe(3);
  });
});
