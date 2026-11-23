# Argus — where it stands (23 Nov 2026)

**Bad news first:** Argus is not running in production. It runs only on staging, with 2026 data. Five years of history are
not loaded yet. The analytics figures take about 3 seconds to load where the target is a third of a second. More than
half the floor-phone words still have no Gujarati.

**The good news:** the hard parts are built and tested. Breakdown tickets work end to end: report, clocks, escalation,
close, PDF and handback. The 2026 figures equal Bhavin's to the last digit. 20 of the analytics screens are live in the
new (v2) design. On 23 Nov all 307 test files passed in CI.

Think of it as a house that is wired, plumbed and has its rooms painted, with no occupancy certificate and the furniture
still in the truck.

## What changed today

The repo now runs on the loop, like your other projects. The old agent setup (pstack, about 270 files) is gone. The
design skills you wanted (impeccable, Emil's) are kept. Argus keeps its own design system; it was not swapped for the
global kit. Two PRs:

1. Loop setup (#546). Merged.
2. The blueprint, glossary and screen snapshots (this PR).

## Top 5 risks

1. **No production and no recent restore test.** If staging's database were lost, the only proof the backup restores is
   one drill on 14 Nov. Cosmos cannot cut over until production exists (milestone M5).
2. **Money could show to the wrong people.** One v2 screen once showed rupee figures to every role. An audit caught it;
   no automatic test did. M1 adds a test per screen.
3. **Features quietly lost in the redesign.** Your rule says no screen may lose anything. Across the first six redesigned
   screens, 97 of 187 old features are still marked missing. Compare, Data Checklist and Team Focus wait on that.
4. **Operators may not be able to read the floor phone.** 1,209 of 1,848 Gujarati strings are blank, 191 of them on the
   floor and ticket screens.
5. **Slow figures once history is in.** Each figures page recomputes everything on every visit (2.8 s today on one
   year). With five years loaded it gets slower unless milestone M3 lands first.

## The next 3 milestones

- **M1 — Stabilise (small, first).** Fix the known bugs:
  - the Breakdown Log export's duplicate column, and database ids printed in two exports;
  - "Show the numbers" missing on four screens;
  - a test that fails at 6 pm UTC;
  - files that break on a Mac.
  - Also add the money-visibility test.
    You check: export the Breakdown Log and see one ticket-number column.
- **M2 — Finish the analytics redesign.** First Compare, Data Checklist and Team Focus go live with nothing lost. Then
  Money Matters, Monthly, Annual, Guide and Settings. You check: each screen next to its old version, nothing missing.
- **M3 — History in, figures fast.** Load 2022–2025 and reconcile every machine-month against the workbooks. Make every
  figures page open in under a third of a second. You check: the year-by-year reconciliation sheet.

After those: M4 redesigns the floor phone, desk and TV board and fills the Gujarati, with 5 operators testing. M5 is
production and cutover.

## What only you can do

1. **Read `PROJECT.md`** (about 20 minutes) and correct anything wrong. Its milestones are the plan from now on.
2. **Run `loop approve --all`** in `~/argus`. This approves the 19 screen snapshots in `design/wireframes/` as "what is
   built". You can open any of them in a browser first. After that, only new or redesigned screens need your approval.
3. **Run one command to turn on branch protection.** The session could not do this. It makes every change go through
   the checks; without it, a change can still skip them and reach `main` directly:
   `gh api -X PUT repos/nimishshah1989/argus/branches/main/protection --input -` with
   `{"required_status_checks":{"strict":true,"contexts":["loop-guard","loop-tests"]},"enforce_admins":true,"required_pull_request_reviews":null,"restrictions":null}`
4. **Let the old hooks be switched off.** The session was not allowed to edit `.claude/settings.json`. Four old hook
   lines and the old plugin are still switched on beside the loop. Ask the next session to remove them, and approve
   the edit when it asks.
5. **Decide:**
   - May the frozen answer key change by one last digit (52.70 to 52.69) so that ties across days always sort the
     same way? This blocks M3.
   - Compare: keep the old health score and its two tables? This blocks M2.
   - Order: finish the redesign (M2) before loading history (M3), or the other way round? Set to M2 first unless you
     say otherwise.
   - Should the TV board read in Gujarati?
