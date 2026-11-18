# 47 — coded closes

**What changed for a user:** the floor's "Maintenance Code" box at close is now backed by one `failure_code` list the plant owns — created from the plant's own maintenance codes (Cosmos's 19, with ELE/HYD/ROT folded onto E/HY/RT as aliases; the fallback 19 are the plant module's own seed data, used only by a plant that has no maintenance codes at all, per SPEC rule 4) when the head opens the new Settings → Lists screen or the first coded close lands, never by a write on the config read — and the maintenance head edits it there, switching a code off rather than deleting it so a code that was switched off still shows on the old reports that used it; every close that records a breakdown report now carries that code, with the server refusing a missing one (422 naming `failureComponent`) and refusing a `kind:'report'` close with no report body at all, while `no_report`/`done` closes record no breakdown and are exempt (Q32 in `docs/spec/QUESTIONS.md`, beside Q33 on one required code versus SPEC's four); on the way in and in every figure an old code resolves through its alias (`ELE`/`ele` from a queued phone) to its one entry, unknown codes such as `MEC` and blanks are left exactly as recorded, so a legacy `ELE` row and a new `E` close count as one code in the annual "By cause" table and the breakdown log, and the old report still shows the code it recorded. The plan is `docs/slices/47-coded-closes.md`: packet 47a is the list, its plant-derived seed and the alias contract, 47b is the coded close/read (the four columns are in place from 46; only the component is required, the rest wait for M6's suggestion), and 47c is the screen, the floor's picker and the browser journey; no migration, no new table, no dependency.

## 47a — the list, its plant-derived seed and the alias contract

- A plant's close codes now live in the generated settings list `failure_code`, with no migration: its first read
  copies the plant's own `maint_code` rows (code, label, sort and on/off as the plant has them), takes the fallback
  description where the plant's label is only the bare code ("E — Electronics/Electrical"), and folds ELE/HYD/ROT onto
  E/HY/RT as aliases instead of rival rows; an alternate whose live code is absent stays a row of its own. The
  plant module's own 19-code fallback is used only for a plant with no maintenance codes at all (SPEC rule 4), and
  the config read still writes nothing.
- The seed checks for an existing list before taking any advisory lock and re-checks after it, so an ordinary close
  never serialises; two first reads at once still write one list and one `failure_code.seed` audit line.
- Every list's create, edit and reply now carry `aliases` (a comma-separated text, an array, or nothing, normalised to
  a trimmed lower-case array); the 0014 trigger still owns uniqueness inside one list, so a code or alias another row
  claims in any case is refused 409. List labels may now hold a full description (the fallback's "NO DT" is 121
  characters), which the reply contract and a settings edit both accept.
- `LIST_NAMES` gains `failure_code` after `maint_code`, so the generated GET/POST/PUT routes and their reply schemas
  appear with no route code: the reply-contract route table moves 137 → 140. The resolver (`failureCodeIndex` /
  `resolveFailureCode`, case-insensitive over codes and aliases, null when unknown) is in `packages/shared` as pure
  functions with no plant data, ready for 47b's coded close and one-code read.
- Tests: a tenant with its own code (GRS) gets only that code; a tenant holding ELE but no E keeps ELE; the empty-list
  fallback seeds once from two concurrent reads and never writes on `GET /config`; alias normalisation, switch-off,
  the 409 refusals and two-plant isolation; and the list's three generated routes reply to the shared schema.
