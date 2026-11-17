- The registers now answer the platform's own five figures from the 11 November workbook, exact against the answer key: the
  CNC/Conventional/Process/Utilities/DG register pages with their connected load, average age, merged controller series
  and make splits; the footprint (1,553 m² of machines in a 2,970 m² square at 1.0 m clearance); the age bands and their
  downtime; one page per machine (nameplate, age, area, connected/running load, breakdown summary, PM and completeness);
  and the cell change log with both cells and locations. Every figure names the rows its drill opens.
- The unit test compares each figure with its whole key file, not a slice: all five footprint tables and every register
  page's By Category table and machine list are asserted by strict equality, with no tolerance and no re-rounding.
- An empty plant stays honest: a figure with no rows behind it answers `null` rather than a ready value with nothing to
  drill to (the engine's invariant), so the engine never throws on a plant with no dimensions or no machines.
- The fixture now carries the workbook's cell change log as moves (with locations) and the nameplate fields beside the
  columns, so the engine reads the same shape production already stores.
- Deliberate split, recorded in the plan's Revision: the key's Cell / Location Change Log table is delivered by the
  registered `cell-change-log` figure (its own move drill) instead of being duplicated inside `registers`.
