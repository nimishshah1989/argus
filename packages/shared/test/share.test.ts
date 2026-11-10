import { describe, expect, it } from 'vitest';
import { shareText, waMeUrl, type ShareConfig, type ShareTicket } from '../src/share.js';

const CONFIG: ShareConfig = {
  tenantName: 'Cosmos',
  timeZone: 'UTC',
  machines: [{ id: 'm1', code: 'VC-17', category: 'VMC', cell: 'Cell A' }],
};

const WORKING: ShareTicket = {
  ref: 'BD-0149',
  kind: 'stopped',
  status: 'working',
  machineId: 'm1',
  machineSnapshot: { code: 'VC-17', category: 'VMC', cell: 'Cell A' },
  problem: 'Spindle alarm on start-up.',
  reportedAt: '2026-11-10T09:35:00Z',
  startedAt: '2026-11-10T09:47:00Z',
  figures: {
    responseMin: 12,
    activeMin: 63,
    waitMin: 35,
    downAccMin: 240,
    downtimeMin: null,
    repairMin: 63,
  },
};

describe('shareText short', () => {
  it('shows the ref, status, machine and problem', () => {
    expect(shareText(WORKING, CONFIG, 'short')).toBe(
      'BD-0149 · IN PROGRESS: VC-17 (VMC, Cell A)\nSpindle alarm on start-up.',
    );
  });

  it('uses location and work type for a work request', () => {
    const ticket: ShareTicket = {
      ref: 'WR-0098',
      kind: 'general',
      status: 'open',
      problem: 'Clean the coolant tray.',
      location: 'Cell B',
      workType: 'Housekeeping',
    };
    expect(shareText(ticket, CONFIG, 'short')).toBe(
      'WR-0098 · WORK REQUEST: Cell B (Housekeeping)\nClean the coolant tray.',
    );
  });

  it('marks an urgent work request', () => {
    const ticket: ShareTicket = {
      ref: 'WR-0099',
      kind: 'general',
      status: 'open',
      problem: 'Move the press.',
      location: 'Cell C',
      workType: 'Shifting',
      urgent: true,
    };
    expect(shareText(ticket, CONFIG, 'short')).toContain(
      'WORK REQUEST (URGENT): Cell C (Shifting)',
    );
  });

  it('falls back to the config machine when the snapshot is missing', () => {
    const ticket: ShareTicket = {
      ...WORKING,
      machineSnapshot: null,
    };
    expect(shareText(ticket, CONFIG, 'short')).toContain('IN PROGRESS: VC-17 (VMC, Cell A)');
  });

  it('handles a missing machine and a missing problem', () => {
    const ticket: ShareTicket = {
      ref: 'BD-0155',
      kind: 'stopped',
      status: 'open',
      machineId: null,
      machineSnapshot: null,
      problem: '   ',
    };
    expect(shareText(ticket, CONFIG, 'short')).toBe('BD-0155 · MACHINE STOPPED\n(no problem text)');
  });

  it('labels handed-over, support, closed and cancelled tickets', () => {
    const base: ShareTicket = {
      ref: 'BD-0150',
      kind: 'stopped',
      status: 'open',
      machineId: 'm1',
      machineSnapshot: { code: 'VC-17', category: 'VMC', cell: 'Cell A' },
      problem: 'Hydraulic pressure drops.',
    };
    expect(shareText({ ...base, handedOver: true }, CONFIG, 'short')).toContain(
      'TRANSFERRED, WAITING TO BE PICKED UP',
    );
    expect(shareText({ ...base, kind: 'support' }, CONFIG, 'short')).toContain('NEEDS SUPPORT');
    expect(shareText({ ...base, status: 'closed' }, CONFIG, 'short')).toContain('CLOSED');
    expect(shareText({ ...base, status: 'cancelled' }, CONFIG, 'short')).toContain('CANCELLED');
  });
});

describe('shareText full', () => {
  it('adds reported/started times, figures and the tenant name', () => {
    expect(shareText(WORKING, CONFIG, 'full')).toBe(
      [
        'BD-0149 · IN PROGRESS: VC-17 (VMC, Cell A)',
        'Spindle alarm on start-up.',
        'Reported: 10 Nov, 09:35',
        'Started: 10 Nov, 09:47',
        'Response: 12 min',
        'Hands-on: 1 h 3 min',
        'Waiting: 35 min',
        'Downtime: 4 h 0 min',
        'Repair: 1 h 3 min',
        '— Cosmos',
      ].join('\n'),
    );
  });

  it('adds the close time for a closed ticket', () => {
    const ticket: ShareTicket = {
      ...WORKING,
      status: 'closed',
      closedAt: '2026-11-10T11:05:00Z',
    };
    const text = shareText(ticket, CONFIG, 'full');
    expect(text).toContain('Closed: 10 Nov, 11:05');
  });

  it('omits the tenant signature when the config has no tenant name', () => {
    const text = shareText(WORKING, { timeZone: 'UTC' }, 'full');
    expect(text).not.toContain('—');
    expect(text.endsWith('Repair: 1 h 3 min')).toBe(true);
  });

  it('has no downtime line for support and no figures lines when figures are absent', () => {
    const support: ShareTicket = {
      ...WORKING,
      kind: 'support',
      figures: { responseMin: null, activeMin: 0, waitMin: 0, downtimeMin: null, repairMin: 0 },
    };
    expect(shareText(support, CONFIG, 'full')).not.toContain('Downtime');
    expect(shareText(support, CONFIG, 'full')).not.toContain('Response');
    const bare: ShareTicket = {
      ref: 'BD-0160',
      kind: 'stopped',
      status: 'open',
      problem: 'No figures yet.',
    };
    expect(shareText(bare, CONFIG, 'full')).toBe(
      'BD-0160 · MACHINE STOPPED\nNo figures yet.\n— Cosmos',
    );
  });

  it('renders the tenant time zone in the timestamps', () => {
    const text = shareText(WORKING, { ...CONFIG, timeZone: 'Asia/Kolkata' }, 'full');
    expect(text).toContain('Reported: 10 Nov, 15:05');
  });
});

describe('waMeUrl', () => {
  it('encodes spaces, newlines and reserved characters', () => {
    expect(waMeUrl('a b\nc&d')).toBe('https://wa.me/?text=a%20b%0Ac%26d');
  });

  it('carries the whole share text encoded', () => {
    const text = shareText(WORKING, CONFIG, 'short');
    const url = waMeUrl(text);
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    expect(url).not.toContain('\n');
    expect(decodeURIComponent(url.slice('https://wa.me/?text='.length))).toBe(text);
  });
});
