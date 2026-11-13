import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { en, gu, NAMESPACES } from '../src/i18n/index.js';

const folder = new URL('../src/i18n/', import.meta.url);
const before = JSON.parse(
  readFileSync(new URL('./fixtures/en-before-05.json', import.meta.url), 'utf8'),
) as Record<string, string>;

const NEW_KEYS = [
  'action.label.start',
  'action.label.pickUp',
  'action.label.resume',
  'action.label.update',
  'action.label.pause',
  'action.label.transfer',
  'action.label.machineRunning',
  'action.label.machineStopped',
  'action.label.join',
  'action.label.leave',
  'action.label.close',
  'board.other',
];

describe('message catalogues', () => {
  it('keeps every catalogue file under 250 lines', () => {
    const files = readdirSync(folder).filter((name) => /\.(en|gu)\.ts$/.test(name));
    expect(files.length).toBe(Object.keys(NAMESPACES).length * 2);
    for (const name of files) {
      const lines = readFileSync(new URL(name, folder), 'utf8').split('\n').length;
      expect(lines, name).toBeLessThan(250);
    }
  });

  it('has no key in two namespaces', () => {
    const total = Object.values(NAMESPACES).reduce((sum, ns) => sum + Object.keys(ns).length, 0);
    expect(total).toBe(Object.keys(en).length);
  });

  it('changes no existing copy', () => {
    const current = en as Record<string, string>;
    for (const [key, value] of Object.entries(before)) expect(current[key], key).toBe(value);
    expect(Object.keys(current).sort()).toEqual([...Object.keys(before), ...NEW_KEYS].sort());
    expect(Object.keys(before).filter((key) => key.startsWith('status.')).length).toBe(36);
  });

  it('keeps gu key-identical with empty values', () => {
    expect(Object.keys(gu).sort()).toEqual(Object.keys(en).sort());
    expect(Object.values(gu).every((value) => value === '')).toBe(true);
  });
});
