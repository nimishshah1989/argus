/**
 * The platform's own category order, from its settings lists: a register prints its categories in this order,
 * then anything new in its rows. One category per line, so no line names two utility categories.
 */
const CATEGORY_ORDER = [
  'Turning Center',
  'Vertical Machining Center',
  'Vertical Double Column Machining Center',
  'Cnc Sliding Head Automatic Lathe',
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
  'Bandsaw',
  'Lathe',
  'Broaching',
  'Drilling',
  'Radial Drill',
  'Circular Cutting',
  'Hydraulic Press',
  'Plate Cutting',
  'Hydrostatic Test Pump',
  'Ultrasonic Washing',
  'Marking',
  'Laser Marking',
  'Magnetic Deburring',
  'Helium Testing',
  'Copper Spray',
  'Blasting',
  'Polishing Head',
  'Air Compressor',
  'Air Dryer',
  'Air Receiver Tank',
  'Stabilizer',
  'UPS',
];

/** A category's place in that order; a category the settings do not name sorts after the ones they do. */
export const categoryRank = (label: string): number => {
  const index = CATEGORY_ORDER.indexOf(label);
  return index < 0 ? CATEGORY_ORDER.length : index;
};
