import { describe, expect, it } from 'vitest';
import { en, gu } from '@uptimo/shared/i18n';
import {
  REGISTER_TABS,
  cellLogCsv,
  cellMoves,
  correctionBody,
  correctionError,
  displayDay,
  registerPages,
  toCsv,
  type CellLogLabels,
} from './machine-values.js';
import { MACHINE_FIELD_LABELS, ageOf, areaFrom, machineRecord } from './machine-record.js';

/**
 * The 39b page config and value readers (D05 style): the five register pages, the move list, one machine's
 * record and the controlled-document export. Every case fails if a reader starts inventing a value: a missing
 * length, width or purchase date must stay unavailable, and the register order must be the platform's.
 */

const LABELS: CellLogLabels = {
  docNo: 'DOC. NO. CE-MTN-F-01',
  title: 'Cell / Location Change Log',
  date: 'Date',
  machine: 'Machine',
  fromCell: 'From cell',
  toCell: 'To cell',
  fromLocation: 'From location',
  toLocation: 'To location',
};

describe('the register pages', () => {
  it('orders the platform pages CNC, Conventional, Process, Utilities, DG, Robots', () => {
    const pages = registerPages({
      pages: [
        { page: 'dg', title: 'DG Sets', kpis: [], tables: [] },
        { page: 'machines', title: 'CNC Machines', kpis: [], tables: [] },
        { page: 'conv', title: 'Conventional Machines', kpis: [], tables: [] },
        { page: 'proc', title: 'Process Machines', kpis: [], tables: [] },
        { page: 'util', title: 'Utilities', kpis: [], tables: [] },
        { page: 'robots', title: 'Robots', kpis: [], tables: [] },
      ],
    });
    expect(pages.map((page) => page.id)).toEqual([
      'machines',
      'conv',
      'proc',
      'util',
      'dg',
      'robots',
    ]);
  });

  it("keeps the engine's KPI label, value and sub, and drops a row with no value", () => {
    const [page] = registerPages({
      pages: [
        {
          page: 'machines',
          title: 'CNC Machines',
          kpis: [
            { label: 'CNC Machines', value: '126', sub: '15 categories' },
            { label: 'Connected Load', value: 2812, sub: null },
            { label: 'Broken', sub: 'no value' },
          ],
          tables: [
            {
              title: 'By Category',
              header: ['Category', 'Machines'],
              rows: [['Turning Center', '38'], []],
            },
          ],
        },
      ],
    });
    expect(page?.kpis).toEqual([
      { label: 'CNC Machines', value: '126', sub: '15 categories' },
      { label: 'Connected Load', value: '2812', sub: null },
    ]);
    expect(page?.tables[0]).toEqual({
      title: 'By Category',
      header: ['Category', 'Machines'],
      rows: [['Turning Center', '38']],
    });
  });

  it('reads nothing from a not-computed or unknown value', () => {
    expect(registerPages(null)).toEqual([]);
    expect(registerPages({})).toEqual([]);
    expect(registerPages({ pages: [{ page: 1 }] })).toEqual([]);
  });

  it('names the five registers the ticket requires, in both catalogues', () => {
    const required = ['machines', 'conv', 'proc', 'util', 'dg'];
    for (const id of required) {
      const tab = REGISTER_TABS.find((candidate) => candidate.id === id);
      expect(tab, id).toBeTruthy();
      expect(en[tab!.labelKey], id).toBeTruthy();
      expect(Object.hasOwn(gu, tab!.labelKey), id).toBe(true);
    }
  });
});

describe('the cell change log', () => {
  const move = (over: Record<string, unknown>) => ({
    id: 'm1',
    machineId: '10000000-0000-4000-8000-000000000001',
    date: '2026-08-03',
    fromCell: '4',
    toCell: '2',
    fromLocation: '434',
    toLocation: '841-B',
    ...over,
  });

  it('keeps the locations and shows the latest move first', () => {
    const moves = cellMoves({
      moves: [
        move({ id: 'old', date: '01-08-2026' }),
        move({ id: 'new', date: '2026-10-03', fromLocation: '445', toLocation: '445' }),
      ],
    });
    expect(moves.map((candidate) => candidate.id)).toEqual(['new', 'old']);
    expect(moves[0]).toMatchObject({
      fromCell: '4',
      toCell: '2',
      fromLocation: '445',
      toLocation: '445',
    });
  });

  it('shows an already-recorded day as the platform writes it', () => {
    expect(displayDay('2026-08-03')).toBe('03-08-2026');
    expect(displayDay('03-08-2026')).toBe('03-08-2026');
  });

  it('drops a move with no id, machine or date instead of inventing one', () => {
    expect(
      cellMoves({ moves: [move({ id: '' }), move({ machineId: null }), { date: '2026-01-01' }] }),
    ).toEqual([]);
    expect(cellMoves(null)).toEqual([]);
  });

  it('exports the controlled document number above the table, then one row per move', () => {
    const csv = cellLogCsv(
      cellMoves({ moves: [move({})] }),
      (id) => (id.endsWith('1') ? 'VC-1' : null),
      LABELS,
    );
    const lines = csv.trimEnd().split('\n');
    expect(lines[0]).toBe('DOC. NO. CE-MTN-F-01');
    expect(lines[1]).toBe('Cell / Location Change Log');
    expect(lines[3]).toBe('Date,Machine,From cell,To cell,From location,To location');
    expect(lines[4]).toBe('03-08-2026,VC-1,4,2,434,841-B');
  });

  it('quotes a field only when it holds a comma or a quote', () => {
    expect(toCsv([['plain', 'a,b', 'say "hi"']])).toBe('plain,"a,b","say ""hi"""');
  });
});

describe("correcting one move's date", () => {
  it("puts the server's 422 field message under the date field", () => {
    const message = 'Use a date after the previous move';
    expect(correctionError({ field: 'effectiveFrom', message })).toEqual({
      date: message,
      message,
    });
  });

  it("shows a refusal with no field as the sheet's own line", () => {
    expect(correctionError({ message: 'forbidden' })).toEqual({ message: 'forbidden' });
  });

  it('sends the chosen date as the PATCH body', () => {
    expect(correctionBody('2026-08-03')).toEqual({ effectiveFrom: '2026-08-03' });
  });
});

describe('one machine page', () => {
  const ID = '10000000-0000-4000-8000-000000000001';
  const ready = {
    byMachine: {
      [ID]: {
        machine: {
          code: 'VC-1',
          segment: 'CNC',
          category: 'Vertical Machining Center',
          make: 'Cosmos',
          model: 'CVM-800',
          serial: '08 3877',
          controller: 'Mitsubishi M80',
          controllerModel: 'FCA80H-4AV',
          controllerSerial: 'M8015X3222N',
          year: 2022,
          purchasedOn: '2022-09-01',
          powerKva: 21,
          location: '486',
          cell: '6',
          assetCode: '13000081',
          lengthMm: 4000,
          widthMm: 2500,
          conveyor: 'L',
        },
        efficiencyPct: 20,
        breakdowns: {
          count: 27,
          hours: 151.32,
          mttr: 5.6,
          lastOn: '2026-11-07',
          topProblem: { problem: 'Tool declamp', count: 3 },
        },
        pm: { visits: 0, hours: 0 },
        completeness: { recorded: 10, of: 10, missing: [] },
        moves: [{ id: 'm1', machineId: ID, date: '2026-08-03', fromCell: '4', toCell: '6' }],
      },
    },
  };

  it('reads the nameplate, load, breakdowns, PM, completeness and moves', () => {
    const record = machineRecord(ready, ID);
    expect(record).not.toBeNull();
    expect(record?.machine).toMatchObject({
      code: 'VC-1',
      make: 'Cosmos',
      controllerModel: 'FCA80H-4AV',
      purchasedOn: '2022-09-01',
      lengthMm: 4000,
      widthMm: 2500,
    });
    expect(record?.connectedKva).toBe(21);
    expect(record?.runningKva).toBe(4.2);
    expect(record?.floorAreaM2).toBe(10);
    expect(record?.breakdowns).toMatchObject({ count: 27, hours: 151.32, mttr: 5.6 });
    expect(record?.breakdowns?.topProblem).toEqual({ problem: 'Tool declamp', count: 3 });
    expect(record?.pm).toEqual({ visits: 0, hours: 0 });
    expect(record?.completeness).toEqual({ recorded: 10, of: 10, missing: [] });
    expect(record?.moves).toHaveLength(1);
    expect(record?.drills.moves).toEqual(['m1']);
  });

  const withBreakdowns = (breakdowns: unknown) =>
    machineRecord({ byMachine: { [ID]: { machine: { code: 'VC-1' }, breakdowns } } }, ID);

  it('leaves the top problem null when the engine says null, so the card says Not available', () => {
    expect(withBreakdowns({ count: 27, topProblem: null })?.breakdowns?.topProblem).toBeNull();
  });

  it('leaves the top problem null when the engine omits it, so the card says Not available', () => {
    expect(withBreakdowns({ count: 27 })?.breakdowns?.topProblem).toBeNull();
  });

  it('ignores a top problem that is not a record with a problem name', () => {
    expect(
      withBreakdowns({ count: 27, topProblem: 'Tool declamp' })?.breakdowns?.topProblem,
    ).toBeNull();
    expect(
      withBreakdowns({ count: 27, topProblem: { count: 3 } })?.breakdowns?.topProblem,
    ).toBeNull();
  });

  it('returns null for an id the value does not hold', () => {
    expect(machineRecord(ready, '10000000-0000-4000-8000-000000000099')).toBeNull();
    expect(machineRecord(null, ID)).toBeNull();
    expect(machineRecord({}, ID)).toBeNull();
    expect(machineRecord({ pages: [] }, ID)).toBeNull();
  });

  it('accepts the answer key aliases and one bare record', () => {
    const record = machineRecord(
      {
        extra: {
          machine: {
            id: 'VC-28',
            datePurchase: '2022-09-01',
            power: 21,
            length: 4000,
            width: 2500,
            ctrlModel: 'FCA80H-4AV',
          },
          efficiencyPct: 20,
          breakdowns: 27,
        },
      },
      'some-uuid',
    );
    expect(record?.machine.code).toBe('VC-28');
    expect(record?.machine.lengthMm).toBe(4000);
    expect(record?.machine.controllerModel).toBe('FCA80H-4AV');
    expect(record?.floorAreaM2).toBe(10);
    expect(record?.runningKva).toBe(4.2);
    expect(record?.breakdowns?.count).toBe(27);
  });

  it('says the age from the purchase date, from the year (estimated), or not at all', () => {
    const facts = (over: Record<string, unknown>) => {
      const record = machineRecord({ byMachine: { [ID]: { machine: over } } }, ID);
      if (!record) throw new Error('no record');
      return record;
    };
    const dated = facts({ code: 'VC-1', purchasedOn: '2022-09-01' });
    expect(ageOf(dated.machine, '2026-11-11', null, false)).toEqual({ years: 4, estimated: false });
    const yearly = facts({ code: 'VC-2', year: 2001 });
    expect(ageOf(yearly.machine, '2026-11-11', null, false)).toEqual({
      years: 25,
      estimated: true,
    });
    const dateBeforeAnniversary = facts({ code: 'VC-3', purchasedOn: '2022-12-01' });
    expect(ageOf(dateBeforeAnniversary.machine, '2026-11-11', null, false)).toEqual({
      years: 3,
      estimated: false,
    });
    const unknown = facts({ code: 'VC-4' });
    expect(ageOf(unknown.machine, '2026-11-11', null, false)).toBeNull();
  });

  it('never makes a floor area or a running load from half the data', () => {
    const facts = (over: Record<string, unknown>) => {
      const record = machineRecord({ byMachine: { [ID]: { machine: over } } }, ID);
      if (!record) throw new Error('no record');
      return record;
    };
    const noWidth = facts({ code: 'VC-1', lengthMm: 4000 });
    expect(noWidth.floorAreaM2).toBeNull();
    expect(areaFrom(noWidth.machine)).toBeNull();
    const zero = facts({ code: 'VC-2', lengthMm: 0, widthMm: 2500 });
    expect(zero.floorAreaM2).toBeNull();
    const noPower = facts({ code: 'VC-3' });
    expect(noPower.connectedKva).toBeNull();
    expect(noPower.runningKva).toBeNull();
    const noEfficiency = facts({ code: 'VC-4', powerKva: 21 });
    expect(noEfficiency.connectedKva).toBe(21);
    expect(noEfficiency.runningKva).toBeNull();
  });

  it('maps every completeness field code to a catalogue label in both languages', () => {
    for (const [code, key] of Object.entries(MACHINE_FIELD_LABELS)) {
      expect(en[key], code).toBeTruthy();
      expect(Object.hasOwn(gu, key), code).toBe(true);
    }
  });
});
