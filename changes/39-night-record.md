- Ticket 39's figures and screens are merged and exact against the 11 November platform key: the registers with their
  own splits, the footprint with all five of its tables, the age bands, one page per machine, and the cell change log
  with its controlled-document CSV export.
- The night's two review findings that mattered are fixed in the same code: an empty plant no longer throws the engine
  (a figure with no rows answers `null`), and the "Most frequent problem" card reads the engine's record instead of a
  string, so a machine with breakdowns no longer says "Not available".
- The machines catalogue was split under the 250-line file guard (`analytics-machines.en/gu`) with no key renamed.
- Open against this ticket: 39c/39d, the audited correction of a cell move's date (`docs/slices/39-move-audit.md`).
