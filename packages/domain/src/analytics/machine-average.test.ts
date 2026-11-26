import { describe, expect, it } from 'vitest';
import { machineAverageDowntime } from './machine-average.js';

const row = (downtimeMin: number, maintCode: string | null = 'M', recordedHours?: number) => ({
  downtimeMin,
  maintCode,
  recordedHours,
});

describe('machineAverageDowntime', () => {
  it('is the MTTR in minutes: breakdown minutes over breakdowns, PM left out', () => {
    expect(machineAverageDowntime([row(30), row(50), row(600, 'PM')])).toEqual({
      downtimeMin: 40,
      breakdowns: 2,
    });
  });

  it('counts a NO DT entry as a breakdown worth zero, and reads recorded hours where they exist', () => {
    expect(machineAverageDowntime([row(90, 'NO DT'), row(10, 'E', 1)])).toEqual({
      downtimeMin: 30,
      breakdowns: 2,
    });
  });

  it('is null with no breakdown to average', () => {
    expect(machineAverageDowntime([])).toBeNull();
    expect(machineAverageDowntime([row(45, 'PM')])).toBeNull();
  });
});
