import type { MachineRow } from './types.js';
import { normalizeLabel } from './format.js';

/**
 * The two splits the CNC register prints, ported from the platform's own controller and make cards: the controller
 * brand and its series read from the Controller field (spelling differences merged), and the make with its spelling
 * differences merged. A series or make the data does not record is named, never guessed.
 */
export interface ControllerInfo {
  brand: string;
  series: string;
}

export function controllerInfo(machine: MachineRow): ControllerInfo {
  const controller = (machine.controller ?? '').trim();
  const unit = (machine.controllerModel ?? '').trim();
  const all = `${controller} ${unit}`.toLowerCase();
  let brand = 'Not recorded';
  if (/fanuc/.test(all)) brand = 'Fanuc';
  else if (/mitsu|mitshu|\bm-?(70|80|700)\b|\be-?(70|80)\b|\b80vm|\bfca\s*-?\d/.test(all))
    brand = 'Mitsubishi';
  else if (/siemens|sinumerik|[28]40d/.test(all)) brand = 'Siemens';
  else if (/nc studio|lambda/.test(all)) brand = 'Other (PC based)';
  else if (controller && !/^(n\/a|na|nc|-)$/i.test(controller)) brand = 'Other';
  return { brand, series: seriesOf(brand, all) };
}

function seriesOf(brand: string, all: string): string {
  if (brand === 'Fanuc') return fanucSeries(all);
  if (brand === 'Mitsubishi') return mitsubishiSeries(all);
  if (brand === 'Siemens') {
    const found = /([28]40d)/.exec(all);
    return found ? `Sinumerik ${found[1]!.toUpperCase()}` : 'Siemens';
  }
  return brand;
}

function fanucSeries(all: string): string {
  const text = all.replace(/series/g, ' ').replace(/fanuc/g, ' ');
  const match = (pattern: RegExp) => pattern.exec(text);
  if (/robot|r-30i/.test(text)) return 'Robot controller (R-30iB)';
  const mate = match(/[0o]i\s*-?\s*mate\s*-?\s*([tm][a-f])/);
  if (mate) return `Oi Mate-${mate[1]!.toUpperCase()}`;
  const plus = match(/[0o]i\s*-?\s*([tm][a-f])\s*-?\s*(?:g\s*-?\s*)?plus/);
  if (plus) return `Oi-${plus[1]!.toUpperCase()} Plus`;
  const plain = match(/[0o]i\s*-?\s*([tm][a-f])\b/);
  if (plain) return `Oi-${plain[1]!.toUpperCase()}`;
  if (/[0o]i\s*-?\s*plus/.test(text)) return 'Oi Plus';
  const older = match(/(18i|21i)\s*-?\s*([tm]b)/);
  if (older) return `${older[1]}-${older[2]!.toUpperCase()}`;
  return 'Fanuc (series not recorded)';
}

function mitsubishiSeries(all: string): string {
  const match = (pattern: RegExp) => pattern.exec(all);
  const named = match(/\b([me])\s*-?\s*(70|80|700)\b/);
  if (named) return `${named[1]!.toUpperCase()}${named[2]}`;
  const vm = match(/(70|80)\s*vm/);
  if (vm) return `M${vm[1]}`;
  const unit = match(/fca\s*-?(\d{2})/);
  if (unit) return `M${unit[1]}`;
  return 'Mitsubishi (series not recorded)';
}

/** The platform's make normalisation, including the plant's pseudonym pattern, with every spelling merged. */
export function makeName(machine: MachineRow): string {
  const raw = normalizeLabel(machine.make ?? '');
  if (raw === '') return 'Not recorded';
  const folded = raw.toLowerCase();
  if (folded === 'cosmos') return 'Cosmos';
  if (folded === 'you ji') return 'You Ji';
  if (folded === 'you ji/cosmos') return 'You Ji / Cosmos';
  const person = /^person (\d+) ji(?:\s*\/\s*cosmos)?$/.exec(folded);
  if (person)
    return /cosmos/.test(folded) ? `Person ${person[1]} Ji / Cosmos` : `Person ${person[1]} Ji`;
  if (/^hi-?f?l?i?fe$|^hilife$|^hi-life$|^hiflife$/.test(folded)) return 'Hi-Life';
  return raw;
}
