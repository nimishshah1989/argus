# ADR 0051: OEM comes into scope ("facts now, people pick cause"); nothing of v1 remains

Date: 26 Nov 2026 · Decided by: Nimish, in chat to the release session: "what about the ticket page? and get the OEM page as well now; nothing of old should remain." Two follow-up answers the same day are recorded below. Planned by the Opus planner, unattended: every rule Nimish did not state is marked **Assumed** and asked back on the tickets.

## 1. OEM analytics is in scope for v1

PROJECT.md §1 listed "OEM analytics" under Will NOT do (engine does not compute it; `m4a-triage.md` DEFERRED because the cause was a keyword guess and the claim figure waits for Bhavin, N12). Nimish moves it in, as "facts now, people pick cause":

- **Facts the engine computes** (the legacy platform's rules, `docs/discovery/real-2026-11-13/cosmos_platform-2026-11-11.html` `oemData`): young machines (under 300 days from the purchase date), their breakdowns and hours (PM excluded), per 100 machine-days against older peers of the same make and model (else the same category), first breakdown after purchase, inside warranty, by make and model, faults that repeat across machines of one model (the existing problem groups), and every breakdown on a young machine.
- **The cause is a person's choice.** Every breakdown's cause starts **Not decided**; a person picks one of: OEM / build defect, Installation / commissioning, Our side, Not decided. **No keyword guess, no learned suggestion, no "confirm all suggested".** So the engine's cause figures (OEM or commissioning hours, Our side hours, Main cause) deliberately differ from the frozen answer key, which carries the platform's keyword guesses; every other number must equal the key.
- **No money on the page until N12.** The claim amount is not shown until Bhavin gives the rule. **Assumed:** the "₹ of lost output" line is not shown either (it is the same rate times the same hours); the engine prints no rupees for this figure at all, so no role sees money here.

### Where the cause is stored (data model)

As one append-only `ticket_event` of type `oem_cause` on the breakdown's ticket, payload `{ cause, decidedBy, decidedDate }` (`packages/shared/src/oem-cause.ts`); the latest event wins and saving `undecided` resets it. This is exactly how the Why-Why record is stored (`why_why`, ticket 41). Chosen over a new table because `ticket_event` already has `tenant_id`, forced row-level security and no UPDATE/DELETE for the app role (0009), it records who and when, and appending an event moves `ticket.last_event_seq`, which is already in the served-figures stamp, so the figures re-run with no stamp change. **No migration, no table, no data altered, so no backup step.** The table budget (40, 37 used) is untouched.

### Assumed rules (questions for Nimish, each repeated on its ticket)

- A1 Warranty runs **1 year from the purchase date** (the platform's default; Uptimo has no warranty-years setting, and the asset register's warranty lines are not read).
- A2 Young means **under 300 days**, fixed. The platform's "machines younger than (days)" box is not built.
- A3 Who may pick a cause: **supervisor, maintenance head, plant head, admin** (the Why-Why roles, `canAnalytics`). Others see the cause, read-only.
- A4 The cause can be picked on any **closed breakdown** ticket of a young machine, history tickets included.
- A5 No rupees at all on the OEM page (see above), and no "Excel for the OEM" download (not one of Bhavin's exports, ADR 0041).
- A6 The "hours per machine stacked by cause" chart is not drawn (the approved S18 wireframe has no chart); the Machines table's Main cause column carries it.

### Screen

S18 is already approved. The breakdowns table's heading in the wireframe already reads "decide the cause"; the cause picker is the column the wireframe left undrawn only because nothing was stored. Adding it is this decision, not a redesign. OEM sits in the Machines group of the analytics menu.

## 2. Sign-in companions rebuilt without a wireframe

The old "Who is using this phone" (`/who`) and "Change password" (`/password`) pages are rebuilt in the v2 style, matching the live v2 Sign in page (S19), and go live **without a wireframe approval**, like Forecast Lab under ADR 0050. Each PR deletes its v1 page.

## 3. Nothing of v1 remains

Every v1 page, route, fallback and page body a user can still reach is removed, and the v1 code is deleted at the end. The inventory and the ticket covering each item are in `docs/plan/v1-removal.md` (new tickets #816 /who, #817 /password, #818 analytics fallback; #819 last). OEM is #812 engine, #813 save, #814 screen, #815 picker. v1-located `.ts` logic that v2 imports is not a page and stays. The last ticket deletes every remaining v1 file and adds a guard test so no route can render outside `screens/v2` again.

## Consequences

- PROJECT.md: OEM leaves Will NOT do; the S18 row becomes "to build"; stale screen states updated.
- `docs/plan/m4a-triage.md` keeps its DEFERRED row as history; this ADR supersedes it for OEM.
- N12 stays open for the claim figure; when Bhavin answers, money comes back through a `money` key, never in the shared figure.
