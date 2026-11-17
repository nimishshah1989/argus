- The 2026 breakdown log can now be loaded as closed tickets through the past-breakdown path: each row keeps its
  source reference, a re-run adds nothing, the desk shows the history, and a leaver's name is erased from it like any
  other ticket.
- The five legacy maintenance codes the history uses resolve through the alias column; the real map is Bhavin's N12
  decision, so this ships the mechanism with the synthetic map named as such.
- The load is proven end to end on the generator's own output: 1,283 closed backfill tickets with one report each,
  the 60 live rows absent, a re-import skipped in full with unchanged counts, and the desk's from/to list returning a
  history day (the `/state` desk still lists only open and recent no-report tickets).
- The codes are proven on the reports: NI/FS/PP/UTI land as MIS, a blank stays null, and an unseeded, un-aliased code
  is an import issue a person sees rather than a silent drop.
- The 07 erasure path reaches imported history: erasing a person named in a history ticket clears the ticket and
  report free text and the `import_row` payload, and the detail and list replies no longer show the name.
- Red evidence (verification packet): with `import_row.source_ref` wired to the ticket ref instead of the legacy id,
  the load test fails on the source-reference set; restored after the run. Wiring it to null makes the batch fail
  fatally on the completion fingerprint (dangling provenance). Neither change is in the final diff.
