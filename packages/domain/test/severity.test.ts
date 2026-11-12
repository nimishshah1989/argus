import { describe, it, expect } from 'vitest';
import { computeSeverity, defaultSeverityMatrix, type SeverityMatrix } from '../src/severity.js';

describe('severity calculation', () => {
  it('uses default matrix for stopped tickets', () => {
    expect(computeSeverity(defaultSeverityMatrix, 'A', 'stopped', false)).toBe('S1');
    expect(computeSeverity(defaultSeverityMatrix, 'B', 'stopped', false)).toBe('S2');
    expect(computeSeverity(defaultSeverityMatrix, 'C', 'stopped', false)).toBe('S3');
  });

  it('uses default matrix for support tickets', () => {
    expect(computeSeverity(defaultSeverityMatrix, 'A', 'support', false)).toBe('S2');
    expect(computeSeverity(defaultSeverityMatrix, 'B', 'support', false)).toBe('S3');
    expect(computeSeverity(defaultSeverityMatrix, 'C', 'support', false)).toBe('S4');
  });

  it('handles general work requests', () => {
    expect(computeSeverity(defaultSeverityMatrix, null, 'general', false)).toBe('S4');
    expect(computeSeverity(defaultSeverityMatrix, null, 'general', true)).toBe('S3');
  });

  it('handles machine-less stopped/support tickets defensively', () => {
    // Edge case: stopped/support ticket without a machine criticality
    expect(computeSeverity(defaultSeverityMatrix, null, 'stopped', false)).toBe('S3'); // C.stopped
    expect(computeSeverity(defaultSeverityMatrix, null, 'support', false)).toBe('S4'); // C.support
  });

  it('respects custom matrix', () => {
    const customMatrix: SeverityMatrix = {
      default: {
        A: { stopped: 'S2', support: 'S2' },
        B: { stopped: 'S3', support: 'S3' },
        C: { stopped: 'S4', support: 'S4' },
      },
      workRequest: 'S1',
      urgentWorkRequest: 'S1',
    };

    expect(computeSeverity(customMatrix, 'A', 'stopped', false)).toBe('S2');
    expect(computeSeverity(customMatrix, 'B', 'support', false)).toBe('S3');
    expect(computeSeverity(customMatrix, null, 'general', false)).toBe('S1');
    expect(computeSeverity(customMatrix, null, 'general', true)).toBe('S1');
  });
});
