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

/** Every namespace that held English copy when ticket 24 translated it. A namespace added later starts blank. */
const SHIPPED = [
  'common',
  'desk',
  'desk-lists',
  'floor',
  'ticket',
  'detail',
  'sla',
  'actions',
  'report',
  'status-ticket',
  'admin',
  'board',
  'live-board',
  'settings',
  'status-signal',
  'status-flow',
  'status-floor',
  'status-task',
  'report-floor',
  'closes',
  'signin',
];

/** Strings other builders are adding in parallel; absent from en or still blank until they land. */
const PENDING = [
  'outbox.queuedForSomeoneElse',
  'live.today.response',
  'live.today.repair',
  'live.today.average',
];

/** Latin words that stay Latin in Gujarati (docs/design/gujarati-glossary.md): codes, criticality letters, product names. */
const LATIN_TOKENS = ['SLA', 'S1', 'S2', 'S3', 'S4', 'WhatsApp', 'Uptimo', 'VC', 'A', 'C'];

/** Keys of shipped namespaces whose Gujarati is blank, except those a builder is still adding. */
function untranslated(
  namespaces: Record<string, Catalogue>,
  guValues: Catalogue,
  shipped: string[],
  pending: string[],
): string[] {
  return Object.entries(namespaces)
    .filter(([name]) => shipped.includes(name))
    .flatMap(([, keys]) => Object.keys(keys))
    .filter((key) => !pending.includes(key) && !guValues[key])
    .sort();
}

/** PENDING keys that are no longer blank in Gujarati: the entry is stale and would hide a blank key. */
function stalePending(pending: string[], guValues: Catalogue): string[] {
  return pending.filter((key) => guValues[key]);
}

const placeholders = (text: string): string[] =>
  [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]!).sort();

/** Keys whose Gujarati drops, adds or renames a {{placeholder}} of the English. */
function placeholderBreaks(english: Catalogue, guValues: Catalogue): string[] {
  return Object.keys(english).filter(
    (key) =>
      guValues[key] && placeholders(english[key]!).join() !== placeholders(guValues[key]!).join(),
  );
}

/** `key: word` for each Latin word in a Gujarati value that is neither a placeholder nor an allowed token. */
function latinLeaks(guValues: Catalogue): string[] {
  return Object.entries(guValues).flatMap(([key, value]) =>
    (value.replace(/\{\{[^}]*\}\}/g, ' ').match(/[A-Za-z][A-Za-z0-9]*/g) ?? [])
      .filter((word) => !LATIN_TOKENS.includes(word))
      .map((word) => `${key}: ${word}`),
  );
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

  it('keeps gu key-identical with en', () => {
    expect(Object.keys(gu).sort()).toEqual(Object.keys(en).sort());
  });

  it('translates every key of every shipped namespace', () => {
    expect(SHIPPED.filter((ns) => !(ns in NAMESPACES))).toEqual([]);
    expect(untranslated(NAMESPACES, gu as Catalogue, SHIPPED, PENDING)).toEqual([]);
  });

  it('keeps every pending entry honest: the key is still blank in Gujarati', () => {
    expect(stalePending(PENDING, gu as Catalogue)).toEqual([]);
  });

  it('flags a stale pending entry so it cannot mask a blank Gujarati value', () => {
    expect(stalePending(['a.b', 'c.d'], { 'a.b': 'સાચવો', 'c.d': '' })).toEqual(['a.b']);
  });

  it('flags a blank key in a shipped namespace and lets a new namespace stay blank', () => {
    const ns = { common: { 'a.b': 'Save' }, fresh: { 'c.d': 'New' } };
    expect(untranslated(ns, { 'a.b': '', 'c.d': '' }, ['common'], [])).toEqual(['a.b']);
    expect(untranslated(ns, { 'a.b': 'સાચવો', 'c.d': '' }, ['common'], [])).toEqual([]);
    expect(untranslated(ns, { 'a.b': '' }, ['common'], ['a.b'])).toEqual([]);
  });

  it('keeps every {{placeholder}} of the English in the Gujarati', () => {
    expect(placeholderBreaks(en as Catalogue, gu as Catalogue)).toEqual([]);
  });

  it('catches a dropped or renamed placeholder', () => {
    const english = { k: 'Hello {{name}}, {{count}} left' };
    expect(placeholderBreaks(english, { k: 'નમસ્તે {{name}}, {{count}}' })).toEqual([]);
    expect(placeholderBreaks(english, { k: 'નમસ્તે {{name}}' })).toEqual(['k']);
    expect(placeholderBreaks(english, { k: 'નમસ્તે {{nam}}, {{count}}' })).toEqual(['k']);
    expect(placeholderBreaks(english, { k: '' })).toEqual([]);
  });

  it('leaves no half-translated Gujarati with stray Latin letters', () => {
    expect(latinLeaks(gu as Catalogue)).toEqual([]);
  });

  it('catches Latin letters outside placeholders and allowed tokens', () => {
    expect(latinLeaks({ a: 'મશીન Stopped' })).toEqual(['a: Stopped']);
    expect(latinLeaks({ a: 'WhatsApp પર {{count}} SLA' })).toEqual([]);
    expect(latinLeaks({ a: '5 min' })).toEqual(['a: min']);
    expect(latinLeaks({ a: 'વધારે SLA2' })).toEqual(['a: SLA2']);
  });
});
