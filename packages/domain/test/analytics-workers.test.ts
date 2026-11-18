import { describe, expect, it } from 'vitest';
import type { ReportRow, WhyWhyRow } from '../src/index.js';
import { PROBLEM_GROUPS } from '../src/analytics/problem-groups.js';
import { A4, A5, A6, A10, ENGINE_DATA } from './answer-key/fixture.js';

/**
 * The shared seam ticket 41's four figures stand on (the plan's §41h): the plant's team list, the platform's
 * problem groups with their families, the four answer keys, and the R8 mention repair. No figure is computed
 * here; this file proves the seam itself, before 41a-41d read it.
 */

/** The Settings team list the platform prints: 14 members, the vendor and the inactive ones kept for history. */
const TEAM_CODES: readonly string[] = [
  'person-79',
  'person-49',
  'person-68',
  'person-21',
  'person-11',
  'person-46',
  'person-02',
  'imptex-team',
  'person-41',
  'person-53',
  'person-88',
  'person-26',
  'person-55',
  'person-51',
];

/** The plant's Settings category list, in its own order: all 15, Robot included (the figures drop Robot). */
const SETTINGS_CATEGORIES: readonly string[] = [
  'Turning Center',
  'Vertical Machining Center',
  'Vertical Double Column Machining Center',
  'Cnc Sliding Head  Automatic Lathe',
  'Horizontal Machining Center',
  'CAM Profile Machine',
  'Vertical Turning Lathe',
  'Turnmill',
  'Cylinderical rotary Grinding',
  'CNC Surface Grinding',
  'CNC Angular Grinding',
  'CNC Internal Grinding',
  'Centerless Grinding Machine',
  'WaterJet CNC',
  'Robot',
];

/** The plant's Settings cells and locations, in their own order: A5 buckets by these, not by first appearance. */
const SETTINGS_CELLS: readonly string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const SETTINGS_LOCATIONS: readonly string[] = [
  '434',
  '435/4',
  '445',
  '486',
  '841-A',
  '841-B',
  '381',
];

/** The platform's own problem groups in the order it tests them, with the family the plan gives each. */
const PLATFORM_GROUPS: ReadonlyArray<readonly [string, string]> = [
  ['Machine accident / crash', 'Crashes and setup'],
  ['PM logged as a breakdown', 'Other'],
  ['Tool-change arm stuck (ATC)', 'Tool changing'],
  ['Magazine / tool pot', 'Tool changing'],
  ['Tool clamp / unclamp / drawbar', 'Tool changing'],
  ['Tool-change error (general)', 'Tool changing'],
  ['4th axis / rotary / angular head', 'Rotary and 4th axis'],
  ['Axis motor / drive / encoder / servo', 'Axis, drive and geometry'],
  ['Home position / geometry / backlash', 'Axis, drive and geometry'],
  ['Coolant leakage', 'Fluids and chips'],
  ['Coolant pressure / flow', 'Fluids and chips'],
  ['Air leakage / low air pressure', 'Fluids and chips'],
  ['Conveyor / chip jam', 'Fluids and chips'],
  ['Spindle motor / overload / noise', 'Spindle, turret and chuck'],
  ['Turret clamp / indexing', 'Spindle, turret and chuck'],
  ['Chuck / jaw / collet', 'Spindle, turret and chuck'],
  ['Lubrication / low oil', 'Fluids and chips'],
  ['Hydraulic pressure', 'Fluids and chips'],
  ['Door / guard / limit switch / sensor', 'Electrical and controls'],
  ['Push button / switch / cable / panel', 'Electrical and controls'],
  ['Fan / filter / overheating', 'Electrical and controls'],
  ['Alarm / PLC / parameter / reset', 'Electrical and controls'],
  ['Installation / relocation / trial', 'Other'],
  ['Belt / bearing / coupling / wear', 'Mechanical wear'],
];

/** The plan's nine family names, in the order the group list first meets them. */
const NINE_FAMILIES: readonly string[] = [
  'Crashes and setup',
  'Other',
  'Tool changing',
  'Rotary and 4th axis',
  'Axis, drive and geometry',
  'Fluids and chips',
  'Spindle, turret and chuck',
  'Electrical and controls',
  'Mechanical wear',
];

/** One R8 mention: the report and field, its own code, and the whole field as it must read after the repair. */
interface Mention {
  readonly reportId: string;
  readonly field: 'doneBy' | 'supportedBy';
  readonly code: string;
  readonly codes: readonly string[];
}

const MENTIONS: readonly Mention[] = [
  {
    reportId: 'bd_muxluadanmqar',
    field: 'doneBy',
    code: 'person-26-mention',
    codes: ['person-26-mention'],
  },
  {
    reportId: 'bd_muxluadbqozpr',
    field: 'doneBy',
    code: 'person-26-mention',
    codes: ['person-26-mention'],
  },
  {
    reportId: 'bd_muxluadbag3ia',
    field: 'doneBy',
    code: 'person-55-mention',
    codes: ['person-55-mention'],
  },
  {
    reportId: 'bd_live_mw300wjpi9l77',
    field: 'doneBy',
    code: 'person-79-mention',
    codes: ['person-79-mention'],
  },
  {
    reportId: 'bd_live_mw5w6eqlouq32',
    field: 'doneBy',
    code: 'person-79-mention',
    codes: ['person-79-mention'],
  },
  {
    reportId: 'bd_muxluada1zas4',
    field: 'supportedBy',
    code: 'person-26-mention',
    codes: ['person-26-mention'],
  },
  {
    reportId: 'bd_muxluadalbfgk',
    field: 'supportedBy',
    code: 'person-26-mention',
    codes: ['person-21', 'person-26-mention'],
  },
  {
    reportId: 'bd_muxluadbtrxho',
    field: 'supportedBy',
    code: 'person-26-mention',
    codes: ['person-26-mention'],
  },
  {
    reportId: 'bd_muxluadb1zmxt',
    field: 'supportedBy',
    code: 'person-55-mention',
    codes: ['person-39', 'person-55-mention'],
  },
];

/** The printed name each mention keeps: the log still says the same thing, only the attribution changed. */
const MENTION_NAMES: ReadonlyArray<readonly [string, string]> = [
  ['person-26-mention', 'Person 26'],
  ['person-55-mention', 'Person 55'],
  ['person-79-mention', 'Person 79'],
];

/** The team code a mention shadows, so a repaired slot can be checked to hold neither. */
const teamCode = (code: string): string => code.replace(/-mention$/, '');

function reportById(id: string): ReportRow {
  const report = ENGINE_DATA.reports.find((row) => row.id === id);
  if (!report) throw new Error(`the fixture holds no report "${id}"`);
  return report;
}

describe('the 41h shared seam', () => {
  describe('the Settings team list', () => {
    it("carries the workbook's 14 team codes in settings order", () => {
      expect(ENGINE_DATA.settings?.teamCodes).toEqual(TEAM_CODES);
    });
  });

  describe('the Settings plant lists', () => {
    it("carries the plant's three lists in the workbook order, Robot included", () => {
      expect(ENGINE_DATA.settings?.categories).toEqual(SETTINGS_CATEGORIES);
      expect(ENGINE_DATA.settings?.cells).toEqual(SETTINGS_CELLS);
      expect(ENGINE_DATA.settings?.locations).toEqual(SETTINGS_LOCATIONS);
    });
  });

  describe('the platform problem groups', () => {
    it("holds the platform's 24 groups in order, each with its family", () => {
      expect(PROBLEM_GROUPS).toHaveLength(24);
      expect(PROBLEM_GROUPS.map((group) => [group.name, group.family])).toEqual(PLATFORM_GROUPS);
    });

    it("names exactly the plan's nine families, in encounter order", () => {
      const families = [...new Set(PROBLEM_GROUPS.map((group) => group.family))];
      expect(families).toEqual(NINE_FAMILIES);
    });
  });

  describe('the four answer keys', () => {
    it('loads A4 as one Manpower page with its five tables and one chart', () => {
      expect(A4.screen).toBe('a4-manpower');
      expect(A4.asOf).toBe('2026-11-11');
      expect(A4.pages).toHaveLength(1);
      const page = A4.pages[0]!;
      expect([page.page, page.title]).toEqual(['a4', 'Manpower Efficiency']);
      expect([page.kpis.length, page.tables.length, page.charts.length]).toEqual([3, 5, 1]);
    });

    it('loads A5 with its heat grids and the 20% efficiency factor', () => {
      expect(A5.screen).toBe('a5-energy');
      expect(A5.pages).toHaveLength(1);
      const page = A5.pages[0]!;
      expect([page.page, page.title]).toEqual(['a5', 'Energy Heatmap']);
      expect([page.kpis, page.tables, page.charts]).toEqual([[], [], []]);
      expect(A5.extra.byCell).toHaveLength(9);
      expect(A5.extra.byLocation).toHaveLength(7);
      expect(A5.extra.effFactorPct).toBe(20);
      expect(Object.keys(A5.extra.byCell[0]!).sort()).toEqual([
        'avgKva',
        'avgRunningKva',
        'key',
        'machineIds',
        'machines',
        'runningKva',
        'totalKva',
      ]);
    });

    it('loads A6 as one Why-Why page with its 24 candidates', () => {
      expect(A6.screen).toBe('a6-why-why');
      expect(A6.pages).toHaveLength(1);
      const page = A6.pages[0]!;
      expect([page.page, page.title]).toEqual(['a6', 'Why-Why Analysis']);
      expect(page.tables).toHaveLength(1);
      expect(page.tables[0]?.rowCount).toBe(24);
    });

    it('loads A10 as the whole Problem Analysis page', () => {
      expect(A10.screen).toBe('a10-problems');
      expect(A10.pages).toHaveLength(1);
      const page = A10.pages[0]!;
      expect([page.page, page.title]).toEqual(['a10', 'Problem Analysis']);
      expect([page.kpis.length, page.tables.length, page.charts.length]).toEqual([8, 6, 2]);
    });
  });

  describe('the R8 mention repair', () => {
    it('carries each of the nine mentions under its own code, keeping the others', () => {
      for (const mention of MENTIONS) {
        expect(reportById(mention.reportId)[mention.field]).toEqual(mention.codes);
      }
    });

    it('leaves no team code in a repaired slot', () => {
      for (const mention of MENTIONS) {
        expect(reportById(mention.reportId)[mention.field]).not.toContain(teamCode(mention.code));
      }
    });

    it('keeps the three mention people under their printed names', () => {
      const people = new Map(ENGINE_DATA.people.map((person) => [person.code, person]));
      for (const [code, displayName] of MENTION_NAMES) {
        expect(people.get(code)).toMatchObject({ displayName, team: 'maintenance', active: true });
      }
    });
  });

  describe('the closed name seam', () => {
    it('resolves every report name to a person row', () => {
      const codes = new Set(ENGINE_DATA.people.map((person) => person.code));
      const unresolved = ENGINE_DATA.reports.flatMap((report) =>
        [...report.doneBy, ...report.supportedBy].filter((code) => !codes.has(code)),
      );
      expect([...new Set(unresolved)]).toEqual([]);
    });

    it('starts the Why-Why seam empty', () => {
      const whyWhy: readonly WhyWhyRow[] = [];
      expect(ENGINE_DATA.whyWhy).toEqual(whyWhy);
    });
  });
});
