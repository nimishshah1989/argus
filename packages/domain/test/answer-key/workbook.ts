/**
 * The 11 November workbook's shape, as `fixtures/answer-key/input.json` keeps it (ticket 38). The fixture maps it
 * into `EngineData`; these are the source types only, so the mapping module stays within its line budget.
 */

export interface WorkbookMachine {
  id: string;
  category?: string;
  make?: string;
  model?: string;
  serial?: string | number;
  controller?: string;
  ctrlModel?: string | number;
  ctrlSerial?: string | number;
  year?: number | string | null;
  datePurchase?: string;
  power?: number | string | null;
  capacityKva?: number;
  location?: string;
  cell?: string;
  assetCode?: string;
  length?: number | string;
  width?: number | string;
  conveyor?: string;
  efficiency?: number | string;
}

/** One row of the workbook's cell change log: the date it took effect and both cells and locations. */
export interface WorkbookMove {
  id: string;
  machineId: string;
  date: string;
  fromCell?: string;
  toCell?: string;
  fromLocation?: string;
  toLocation?: string;
}

export interface WorkbookBreakdown {
  id: string;
  machineId: string;
  /** The workbook writes plant dates as `DD-MM-YYYY`. */
  date: string;
  shift: string;
  problem: string;
  downMin?: number;
  downHrs?: number;
  respMin?: number;
  activeMin?: number;
  maintCode?: string;
  electMech?: string;
  spare1?: string;
  spare2?: string;
  spare3?: string;
  correctiveAction?: string;
  doneBy?: string;
  supportedBy?: string;
  observedBy?: string;
  ticketId?: string;
  ticketRef?: string;
  /** The plant's stable log number; the exported workbook numbers every row, gaps included. */
  srNo?: number;
  /** The three spare costs the Action Center's spares rule adds up (ticket 44). */
  cost1?: number | string;
  cost2?: number | string;
  cost3?: number | string;
}

/** One saved Action Center acknowledgement as the workbook's settings carry it (ticket 44's input data). */
export interface WorkbookAck {
  status: 'ack' | 'snooze' | 'done';
  owner: string;
  due: string;
  note: string;
  at: string;
  until?: string;
}

/** One AMC or extended-warranty line in the workbook's settings. */
export interface WorkbookAmc {
  id?: string;
  machineId: string;
  type?: string;
  start?: string;
  months?: number | string;
  vendor?: string;
  noRenew?: boolean;
}

/** One legal test or calibration line in the workbook's settings. */
export interface WorkbookLegal {
  id?: string;
  machineId: string;
  tid?: string;
  name?: string;
  form?: string;
  last?: string;
  months?: number | string;
  cert?: string;
}

export interface Workbook {
  machines: WorkbookMachine[];
  convMachines: WorkbookMachine[];
  procMachines: WorkbookMachine[];
  utilMachines: WorkbookMachine[];
  dgMachines: WorkbookMachine[];
  breakdowns: WorkbookBreakdown[];
  otherBD: WorkbookBreakdown[];
  /** The cell/location moves the platform logged, with the location columns 0014 carries. */
  cellChangeLog?: WorkbookMove[];
  settings: {
    codes: Array<{ code: string; description: string }>;
    team: Array<{ name: string; type: string }>;
    /** The plant's Settings lists, in their own order: categories (Robot included), cells and locations. */
    categories: string[];
    cells: string[];
    locations: string[];
    /** Machines left out of production data (the Robot is the platform's own default). */
    excludedMachines?: string[];
    /** The plant's shifts, with the wall-clock start the log date belongs to. */
    shiftTimes: Array<{ name: string; start: string; end: string }>;
    /** Manual problem-group fixes from the App Settings, by breakdown id. */
    problemFix?: Record<string, string>;
    /** The Action Center's six saved acknowledgements, by the platform's nudge key (ticket 44). */
    acAcks?: Record<string, WorkbookAck>;
    /** The AMC and legal lines the Action Center's reminder rules read. */
    machAmc?: WorkbookAmc[];
    machLegal?: WorkbookLegal[];
    amcRemindDays?: number;
    legalRemindDays?: number;
  };
}
