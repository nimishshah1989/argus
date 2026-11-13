# Using Claude and the claude-for-manufacturing plugin in Argus

Status: proposed, 13 November 2026, revised after the architecture review. Scope and order come from `docs/BRIEF.md`.
Decisions: `docs/adr/0007-claude-for-ai-and-onboarding.md`, `docs/decisions/D21-cleaned-history-file-and-loader.md`, `docs/decisions/D22-ai-call-shape-redaction-and-limits.md`, D16 (amended).

## The principle

**Claude handles judgement over messy input. TypeScript does every number, every write and every check.** The plugin is used in two ways:

- **Prompts:** its skill text becomes prompt files that we version.
- **Tests:** its correctness rules become Given/When/Then cases in our slice plans.

Nothing in the plugin runs in the product. Plugin source: Anthropic `claude-for-manufacturing` 1.0.0, Apache-2.0, recorded in `THIRD_PARTY.md`. Paths below are relative to its root. The plugin is not in this repo, so each path is checked against the plugin when its slice is planned.

## What Nimish decided (13 November)

1. AI may run outside India on Claude. Names and phone numbers are removed first. Each plant consents in writing first.
2. Onboarding is not brought forward. A Claude session only cleans Cosmos's fuller history from Bhavin.
3. The first part of M6 starts right after cutover, beside M2. The second part follows M4b.
4. Diagnosis on the ticket is the first AI feature.

**Removed from the earlier draft:** the general import pack, `imports.validatePack`, `imports.commitPack` for machines, people and lists, and the `plant-onboarding` skill (old ticket 70). All wait for M5. The review findings about them (5 and 7) fall away with them.

## Lane 1 — Cosmos's history, cleaned once (D21)

This lane needs no AI inside the product.

| Step | What                                                                                                                            | Where                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1    | Cosmos's written consent is filed                                                                                               | N14                      |
| 2    | `history:pseudonymise` swaps names and phones for codes on our machine. The code list stays there                               | `modules/analytics` CLI  |
| 3    | A Claude session maps the coded copies onto `cleaned-history.v1.json`. It sees nothing else and holds no production access      | outside the product      |
| 4    | `history:check` prints the data-quality report: twelve named mismatch classes, row ids and counts only                          | `analytics.checkHistory` |
| 5    | `history:load` on staging. Nimish looks at the history                                                                          | `analytics.loadHistory`  |
| 6    | Backup, then `history:load` on production under a 24-hour support-access grant, as the role that cannot bypass tenant isolation | same                     |
| 7    | `history:undo <batchId>` if needed                                                                                              | `imports.undoBatch`      |

- The contract is `packages/shared/src/history-file.ts`: the file, the code list and the report, each with `v: 1`.
- Rows become closed tickets through `tickets.importTickets` (D17). There is no `history_breakdown` table and no schema change.
- If the fuller history turns out to be more tickets in Bhavin's app format, ticket 09's importer takes it and this lane is not needed.
- Ticket 37's history goal uses this same loader.

Rules carried over from the plugin's `skills/data-consolidate`, each a test of `history:check`:

1. **Normalisation is visible.** A machine code that was changed keeps its original beside it and needs an explicit accept.
2. **Date window first.** A row outside the stated window is reported, not loaded silently.
3. **No automatic fix** for unknown machines, duplicates or possible matches. They block the load.
4. **An accept covers only the classes it names.**
5. **Absent is not zero.** An empty field stays empty and is reported.

**Risk to ticket 09.** The loader reuses the importer's batch ledger and undo. Ticket 09's undo and replay tests run unchanged and must pass. New tests prove that undoing one kind of batch leaves the other alone (D21).

## Lane 2 — AI inside the product (D22)

- **One request per suggestion** through the existing `AiProvider.complete`. No tools. Code fetches the evidence first.
- **Tenant** comes only from the job. Every cited ticket is re-checked against that tenant.
- **Redaction:** names, usernames and phones from `identity.redactionTerms` become placeholders. The map lives for one call.
- **Text only:** no photos or scanned pages.
- **Gate:** ADR 0007 accepted and its terms verified, the plant's consent recorded, the plant's monthly cap set.
- **Prompts:** `modules/ai/prompts/<feature>.md`, each with a version that `ai_suggestion` records.
- **Release path:** evaluation harness, then shadow, then live per plant above its threshold (D16).

First part, right after cutover:

| Order | Feature                           | From the plugin                                                      | Grounding checked in code                                                                                                                                                                                                 |
| ----- | --------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | **Diagnosis on the ticket** (new) | `skills/breakdown-diagnosis` and its `reference/evidence-sources.md` | The app's lockout line always comes first. `safetyFlagged` is required and carries its reason. Each cause cites ticket ids that code supplied, or code marks it a guess. Each cause has a first check and an expected fix |
| 2     | Fix finder with evidence (57)     | evidence-sources, _Check for templates_                              | Template notes are found in SQL: the same close-out text across machines of different models is never cited                                                                                                               |
| 3     | Duplicate detection (57)          | none                                                                 | Candidates come only from `tickets.search`                                                                                                                                                                                |

Second part, after M4b:

| Order | Feature                         | From the plugin                                                          | Grounding checked in code                                                       |
| ----- | ------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| 4     | Code suggestion (58)            | `shared/contracts/downtime-record.md`, _Reason codes are passed through_ | The code must be in the plant's failure-code list, or it is dropped             |
| 5     | Ask and brief (59)              | `shared/scheduling.md`                                                   | Numbers come only from `kpi_snapshot` ids. Safety first, then data freshness    |
| 6     | PM draft from the manual (60)   | breakdown-diagnosis, step 8                                              | Cites manual pages. Extracted text only. The draft goes to `pm.createDraftPlan` |
| 7     | Note themes in the ranking (54) | `skills/breakdown-diagnosis/reference/bad-actor-mode.md`                 | Nightly job. Each theme names the ticket ids behind it                          |

## Rules that land without AI (engine and tickets tests)

- **Ticket 40 (MTTR and MTBF):** an ongoing outage has a null duration, never zero. A machine with no history is "unreported", never the best machine.
- **Ticket 42 (repeat faults):** one of four outcomes: first occurrence, repeat where the fix held, repeat where it failed, no searchable history.
- **Tickets 47 and 54 (coded closes and ranking):** rank by minutes _and_ by number of failures. The share coded "Other" or blank is its own finding.
- **Ticket 48 (shift-calendar figures):** the cross-midnight rule is stated. Availability above 100% is reported, not capped.
- **Ticket 66 (lockout):** the plugin's safety triggers are candidate prompts. Which to use is Nimish's decision.

## Not adopted

Quoting, RFQ and supplier work. CAD variants and trade studies. Production OEE and the morning report. `pulse_compute.py`. The Fusion, NetSuite and M3 connectors. The onboarding skill and time-config interview (M5).

## Ticket changes (for to-tickets, once the reviews pass)

| Ticket                       | What                                                                                                                                                                                                                                                                 | Blocked by          | Needs from outside                            |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------- |
| 69 (new)                     | Cosmos history cleaned and loaded: the contract, the four `history:*` commands, the ledger functions in `imports`, staging then production                                                                                                                           | 09, 28              | Cosmos's consent (N14); Bhavin's files        |
| 70                           | Withdrawn. The onboarding skill waits for M5                                                                                                                                                                                                                         | —                   | —                                             |
| 71 (new)                     | Real Claude provider: redaction, consent, cap, failure table, logs, alarms                                                                                                                                                                                           | 55                  | Signed Anthropic terms; consent; a cap figure |
| 72 (new)                     | Diagnosis on the ticket, shadow then live                                                                                                                                                                                                                            | 56, 71              | Threshold for diagnosis                       |
| 55 (changed)                 | Now blocked by 28, not the M4b gate. Its migration holds `ai_suggestion` with the D22 columns, the search index and `pg_trgm`. `document` and `document_chunk` move to ticket 46. Its goal "an endpoint outside India is always refused" is replaced by the D16 gate | 28                  | —                                             |
| 56, 57 (moved)               | Follow 55 and run beside M2                                                                                                                                                                                                                                          | 55; 56              | —                                             |
| 58, 59, 60 (unchanged order) | Follow the M4b gate                                                                                                                                                                                                                                                  | 56 and the M4b gate | —                                             |

Ticket 72 works on the 275 imported tickets alone. It is better after 69, but does not wait for it.
`docs/plan/MILESTONES.md` still shows M6 as "India only" and after M4b. `to-tickets` updates it from this table.

## Questions for Nimish

They are in `docs/DATA-MAP.md`, "Questions for Nimish", numbers 15 to 24: approval of the data-map changes, the consent wording, who records consent, the monthly cap, who signs Anthropic's terms, what Bhavin's fuller history is, names in old history, who sees a diagnosis, photos, and what happens on withdrawal.
