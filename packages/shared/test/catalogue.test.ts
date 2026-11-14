import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { en, gu, NAMESPACES } from '../src/i18n/index.js';

const folder = new URL('../src/i18n/', import.meta.url);
const before = JSON.parse(
  readFileSync(new URL('./fixtures/en-before-05.json', import.meta.url), 'utf8'),
) as Record<string, string>;

/**
 * Keys added to a namespace that already holds frozen copy (ticket 05). A namespace made after the fixture
 * (report-floor, desk-lists, ...) holds only new keys and needs no entry here, so builders working in
 * parallel never edit this list.
 */
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

type Catalogue = Record<string, string>;

/** What breaks the freeze: a changed or missing frozen string, or a new key inside a namespace that holds frozen copy. */
function freezeBreaks(
  now: Catalogue,
  namespaces: Record<string, Catalogue>,
  frozen: Catalogue,
  allowed: string[],
): string[] {
  const owner = (key: string) => Object.keys(namespaces).find((ns) => key in namespaces[ns]!);
  const frozenNamespaces = new Set(Object.keys(frozen).map(owner));
  const breaks: string[] = [];
  for (const [key, value] of Object.entries(frozen))
    if (now[key] !== value) breaks.push(`changed or removed: ${key}`);
  for (const key of Object.keys(now))
    if (!(key in frozen) && frozenNamespaces.has(owner(key)) && !allowed.includes(key))
      breaks.push(`new key in a namespace with frozen copy: ${key}`);
  return breaks;
}

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
    expect(freezeBreaks(en as Catalogue, NAMESPACES, before, NEW_KEYS)).toEqual([]);
    for (const key of NEW_KEYS) expect(en, key).toHaveProperty([key]);
    expect(Object.keys(before).filter((key) => key.startsWith('status.')).length).toBe(36);
  });

  it('still fails when frozen copy changes, goes, or grows a key in its own namespace', () => {
    const key = Object.keys(before)[0]!;
    const ns = Object.keys(NAMESPACES).find((name) => key in NAMESPACES[name]!)!;
    const changed = { ...en, [key]: `${before[key]} (edited)` } as Catalogue;
    expect(freezeBreaks(changed, NAMESPACES, before, NEW_KEYS)).toEqual([
      `changed or removed: ${key}`,
    ]);
    const removed = Object.fromEntries(Object.entries(en).filter(([k]) => k !== key));
    expect(freezeBreaks(removed, NAMESPACES, before, NEW_KEYS)).toEqual([
      `changed or removed: ${key}`,
    ]);
    const grown = { ...NAMESPACES, [ns]: { ...NAMESPACES[ns], 'sneaky.key': 'x' } };
    expect(
      freezeBreaks({ ...en, 'sneaky.key': 'x' } as Catalogue, grown, before, NEW_KEYS),
    ).toEqual(['new key in a namespace with frozen copy: sneaky.key']);
  });

  it('lets a new per-area namespace add keys without touching this file', () => {
    const area = { 'reportFloor.title': 'Report a problem' };
    const withArea = { ...NAMESPACES, 'report-floor': area };
    expect(freezeBreaks({ ...en, ...area } as Catalogue, withArea, before, NEW_KEYS)).toEqual([]);
  });

  it('keeps gu key-identical with empty values', () => {
    expect(Object.keys(gu).sort()).toEqual(Object.keys(en).sort());
    expect(Object.values(gu).every((value) => value === '')).toBe(true);
  });
});
