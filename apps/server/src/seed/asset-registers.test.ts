import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { amcKind, legalKind, mapAssetRegisters, type RegisterWorkbook } from './asset-registers.js';

/**
 * The workbook's register lines (ticket 51a): the mapper is pure, so the fixture and the synthetic lines prove the
 * classification, the stored dates and the notes convention without a database. R4/R12 carry the type, the legal
 * name/form and the not-renewing flag in `notes`; R3 stores dates and never tenure.
 */

const fixture = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../../../fixtures/answer-key/input.json', import.meta.url)),
    'utf8',
  ),
) as { settings: RegisterWorkbook['settings'] };

const map = (settings: RegisterWorkbook['settings'] = fixture.settings) =>
  mapAssetRegisters({ settings }, { defaultLeadDays: 15 });

const one = (settings: RegisterWorkbook['settings']) => map(settings).items[0]!;

describe('the 11 November workbook’s register lines', () => {
  it('maps 3 drafts: 2 amc and 1 legal, in source order', () => {
    const mapping = map();
    expect(mapping.items).toHaveLength(3);
    expect(mapping.items.map((draft) => [draft.machineCode, draft.kind, draft.notes])).toEqual([
      ['TC-11', 'amc', 'AMC (Comprehensive)'],
      ['A/TANK-1', 'amc', 'AMC'],
      ['A/TANK-1', 'legal', 'Test Of Pressure Vessel · Form No 11'],
    ]);
    expect(mapping.counts).toEqual({ amc: 2, warranty: 0, legal: 1, calibration: 0 });
    expect(mapping.conflicts).toEqual([]);
  });

  it('invents no date, no owner and no vendor: the workbook has none, and lead is 15', () => {
    for (const draft of map().items) {
      expect(draft.startsOn).toBeNull();
      expect(draft.endsOn).toBeNull();
      expect(draft.dueOn).toBeNull();
      expect(draft.vendor).toBeNull();
      expect(draft.reference).toBeNull();
      expect(draft.leadDays).toBe(15);
    }
  });

  it('keeps the legal certificate in reference and the AMC vendor in vendor', () => {
    const legal = one({
      machLegal: [
        {
          machineId: 'A/TANK-1',
          name: 'Test Of Pressure Vessel',
          form: 'Form No 11',
          last: '',
          months: 24,
          cert: 'CERT-9',
        },
      ],
    });
    expect(legal.reference).toBe('CERT-9');
    expect(legal.vendor).toBeNull();
    const amc = one({
      machAmc: [{ machineId: 'TC-11', type: 'AMC', start: '', months: 12, vendor: 'V-4' }],
    });
    expect(amc.vendor).toBe('V-4');
    expect(amc.reference).toBeNull();
  });

  it('carries the not-renewing flag inside the note, per R4', () => {
    const amc = one({
      machAmc: [
        { machineId: 'TC-11', type: 'AMC (Comprehensive)', start: '', months: 12, noRenew: true },
      ],
    });
    expect(amc.notes).toBe('AMC (Comprehensive) · not renewing');
    expect(one({ machAmc: [{ machineId: 'TC-11', type: 'AMC', months: 12 }] }).notes).toBe('AMC');
  });
});

describe('the derived dates (R3)', () => {
  it('ends a 12-month AMC the day before the anniversary, month-end clamped', () => {
    const ends = (start: string) =>
      one({ machAmc: [{ machineId: 'M-1', type: 'AMC', start, months: 12 }] }).endsOn;
    expect(ends('2026-01-31')).toBe('2027-01-30');
    expect(ends('2026-01-01')).toBe('2026-12-31');
    expect(
      one({ machAmc: [{ machineId: 'M-1', type: 'AMC', start: '2026-01-31', months: 1 }] }).endsOn,
    ).toBe('2026-02-27');
  });

  it('dues a legal test on the anniversary of its last date', () => {
    const draft = one({
      machLegal: [
        {
          machineId: 'M-1',
          name: 'Test Of Pressure Vessel',
          form: 'Form No 11',
          last: '2026-03-05',
          months: 24,
        },
      ],
    });
    expect(draft.startsOn).toBe('2026-03-05');
    expect(draft.dueOn).toBe('2028-03-05');
    expect(draft.endsOn).toBeNull();
  });

  it('fills a legal line’s name, form and months from its type when the line has none', () => {
    const draft = one({
      machLegal: [{ machineId: 'M-1', tid: 'lgt_1', name: '', form: '', last: '', months: 0 }],
      legalTypes: [{ id: 'lgt_1', name: 'Boiler test', form: 'Form A', months: 11 }],
    });
    expect(draft.notes).toBe('Boiler test · Form A');
    expect(draft.kind).toBe('legal');
  });

  it('keeps a line’s own months over its type’s', () => {
    const draft = one({
      machLegal: [
        {
          machineId: 'M-1',
          tid: 'lgt_1',
          name: 'Boiler test',
          form: 'Form A',
          last: '2026-03-05',
          months: 24,
        },
      ],
      legalTypes: [{ id: 'lgt_1', name: 'Boiler test', form: 'Form A', months: 11 }],
    });
    expect(draft.dueOn).toBe('2028-03-05');
  });
});

describe('the classifier (R1)', () => {
  it('reads a warranty token as warranty, everything else as amc', () => {
    expect(amcKind('Mitsubishi EWC')).toBe('warranty');
    expect(amcKind('Fanuc FOC')).toBe('warranty');
    expect(amcKind('Extended warranty')).toBe('warranty');
    expect(amcKind('Service Contract')).toBe('amc');
    expect(amcKind('AMC (Comprehensive)')).toBe('amc');
  });

  it('reads a calibration word as calibration, everything else on the legal sheet as legal', () => {
    expect(legalKind('Pressure gauge calibration', 'Form B')).toBe('calibration');
    expect(legalKind('Test Of Pressure Vessel', 'Form No 11')).toBe('legal');
  });

  it('puts a warranty and a calibration line in their own kinds', () => {
    const mapping = map({
      machAmc: [{ machineId: 'M-1', type: 'Mitsubishi EWC', months: 12 }],
      machLegal: [
        {
          machineId: 'M-1',
          name: 'Pressure gauge calibration',
          form: 'Form B',
          last: '',
          months: 12,
        },
      ],
    });
    expect(mapping.counts).toEqual({ amc: 0, warranty: 1, legal: 0, calibration: 1 });
  });
});

describe('bad lines never fail the seed', () => {
  it('skips a line with no machine code and names it in a conflict', () => {
    const mapping = map({ machAmc: [{ machineId: '', type: 'AMC', months: 12 }] });
    expect(mapping.items).toEqual([]);
    expect(mapping.conflicts).toEqual(['register line 1 has no machine']);
  });

  it('maps an empty source to nothing, with zero counts and no conflict', () => {
    const mapping = map({});
    expect(mapping.items).toEqual([]);
    expect(mapping.counts).toEqual({ amc: 0, warranty: 0, legal: 0, calibration: 0 });
    expect(mapping.conflicts).toEqual([]);
  });
});
