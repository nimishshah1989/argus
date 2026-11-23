import { canonicalOrder } from '../analytics/canonical-order.js';
import { metadataNumber } from '../analytics/format.js';
import { machineAge } from '../analytics/machine-facts.js';
import type { MachineRow } from '../analytics/types.js';
import { analyticsSheets } from './analytics-sheets.js';
import { CNC_HEADER, DG_HEADER, LIST_HEADER } from './headers.js';
import { plantSheets } from './plant-sheets.js';
import type { ExportCell, ExportData, ExportRow, ExportSheet } from './types.js';

/**
 * The whole-data-set workbook (ticket 45, packet 45c-2): the platform's 17 sheets, in its order, from the plant
 * rows — the five registers here, the plant sheets and the four Analytics pages beside it. The frozen key pins each
 * sheet's name, header row and data-row count; no row is a pasted literal. `App Settings` is not written.
 */

function cell(value: unknown): ExportCell {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return value === null || value === undefined || value === '' ? '' : String(value);
}

function text(value: string | null | undefined): string {
  return value ?? '';
}

function metadataText(machine: MachineRow, key: string): string {
  const value = machine.metadata[key];
  return value === undefined || value === null ? '' : String(value);
}

/** One machine row in the register's own column set: the CNC list keeps the controller and asset columns. */
function machineRow(
  machine: MachineRow,
  index: number,
  asOf: string,
  kind: 'cnc' | 'list' | 'dg',
): ExportRow {
  const age = cell(machineAge(machine, asOf));
  const length = cell(metadataNumber(machine, 'length'));
  const width = cell(metadataNumber(machine, 'width'));
  if (kind === 'dg') {
    return [
      index + 1,
      machine.code,
      text(machine.make),
      text(machine.model),
      text(machine.serial),
      cell(machine.year),
      text(machine.purchasedOn),
      cell(machine.capacityKva),
      text(machine.location),
      text(machine.cell),
      length,
      width,
      age,
    ];
  }
  const base = [
    index + 1,
    machine.code,
    text(machine.category),
    text(machine.make),
    text(machine.model),
    text(machine.serial),
    cell(machine.year),
    text(machine.purchasedOn),
    cell(machine.powerKw),
    text(machine.location),
    text(machine.cell),
  ];
  if (kind === 'list') {
    return [...base, length, width, age, cell(metadataNumber(machine, 'efficiency'))];
  }
  return [
    index + 1,
    machine.code,
    text(machine.segment),
    ...base.slice(2),
    text(machine.controller),
    text(machine.controllerModel),
    text(machine.controllerSerial),
    text(machine.assetCode),
    length,
    width,
    metadataText(machine, 'conveyor'),
    age,
    cell(metadataNumber(machine, 'efficiency')),
  ];
}

interface RegisterSpec {
  name: string;
  title: string;
  header: readonly string[];
  list: readonly MachineRow[];
  kind: 'cnc' | 'list' | 'dg';
}

/** A register sheet: the tenant, the record title, the key's header row, then its machines in data order. */
function registerSheet(data: ExportData, spec: RegisterSpec): ExportSheet {
  return {
    name: spec.name,
    rows: [
      [data.tenant],
      [spec.title],
      spec.header,
      ...spec.list.map((machine, index) => machineRow(machine, index, data.asOf, spec.kind)),
    ],
  };
}

export function workbookSheets(loaded: ExportData): ExportSheet[] {
  const data = { ...loaded, data: canonicalOrder(loaded.data) };
  const machines = data.data.machines;
  return [
    registerSheet(data, {
      name: 'CNC Machine Master',
      title: 'LIST OF CNC MACHINES',
      header: CNC_HEADER,
      list: machines.filter((machine) => machine.segment === 'CNC'),
      kind: 'cnc',
    }),
    registerSheet(data, {
      name: 'Conventional Machines',
      title: 'LIST OF CONVENTIONAL MACHINES',
      header: LIST_HEADER,
      list: machines.filter((machine) => machine.segment === 'Conventional'),
      kind: 'list',
    }),
    registerSheet(data, {
      name: 'Process Machines',
      title: 'LIST OF PROCESSING MACHINES',
      header: LIST_HEADER,
      list: machines.filter((machine) => machine.segment === 'Process'),
      kind: 'list',
    }),
    registerSheet(data, {
      name: 'DG Sets',
      title: 'LIST OF DG SETS',
      header: DG_HEADER,
      list: machines.filter((machine) => machine.segment === 'DG'),
      kind: 'dg',
    }),
    registerSheet(data, {
      name: 'Utilities',
      title: 'LIST OF UTILITY EQUIPMENTS',
      header: LIST_HEADER,
      list: machines.filter((machine) => machine.segment === 'Utility'),
      kind: 'list',
    }),
    ...plantSheets(data),
    ...analyticsSheets(data),
  ];
}
