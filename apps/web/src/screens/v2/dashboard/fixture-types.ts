/** Invented machine types for the gallery: a code's letters say its type, and the type its fixed colour (1 to 5). */
export const TYPES = {
  TC: { label: 'Turning centre', cat: 1 },
  VC: { label: 'Vertical machining centre', cat: 2 },
  VTL: { label: 'Vertical turret lathe', cat: 3 },
  GRD: { label: 'Grinder', cat: 4 },
} as const;
