import { describe, expect, it } from 'vitest';
import { controlRoom } from './direction-control-room.js';
import { directionProps } from './direction-props.js';
import { instrument } from './direction-instrument.js';
import { ledger } from './direction-ledger.js';

describe('the properties a direction sets on the page', () => {
  it('are the same names in light and dark, so a switch never leaves a stale colour', () => {
    for (const direction of [instrument, controlRoom, ledger]) {
      expect(Object.keys(directionProps(direction, 'dark')).sort()).toEqual(
        Object.keys(directionProps(direction, 'light')).sort(),
      );
    }
  });

  it('give each direction its own accent and keep series 3 to 8 and both ramps out of the kit tokens', () => {
    const accents = [instrument, controlRoom, ledger].map(
      (d) => directionProps(d, 'light')['--color-accent'],
    );
    expect(new Set(accents).size).toBe(3);
    const props = directionProps(ledger, 'light');
    expect(props['--proto-series-8']).toBe(ledger.light.series[7]);
    expect(props['--proto-seq-5']).toBe(ledger.light.seq[4]);
    expect(props['--proto-div-3']).toBe(ledger.light.div[2]);
  });
});
