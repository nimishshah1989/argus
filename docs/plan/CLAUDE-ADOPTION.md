# Using the claude-for-manufacturing plugin in Argus

Status: proposed, 13 November 2026. Decision record: `docs/adr/0007-claude-for-ai-and-onboarding.md`.

## The principle

**Claude handles judgement over messy input. TypeScript does every number, every write and every validation.** The plugin is used in three ways:

- **Prompts:** its skill text becomes prompt files that we version.
- **Repo skills:** onboarding runs as a skill we own, in a Claude session.
- **Tests:** its correctness rules become Given/When/Then cases in our slice plans.

Nothing in the plugin runs unchanged in the product.

Plugin source: Anthropic `claude-for-manufacturing` 1.0.0, Apache-2.0. Paths below are relative to its root.

## Lane 1 — Onboarding and standardisation (first)

Every new plant sends its data in a different shape. Bhavin's fuller history needs the same treatment. This lane needs no AI inside the product.

| Part                     | What                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Where                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Import pack v1           | A versioned set of sheets: machines (segment, group, cell, model), people and roles, shifts and the day boundary, lists (wait reasons, work types, problems, codes), breakdown history rows, and optionally tickets. Each row carries the normalised and the verbatim ID, a `source_ref`, timestamps with their zone, and units.                                                                                                                                 | contract in `packages/shared`      |
| `imports.validatePack`   | A dry run. It returns a data-quality report: the coverage window per sheet first, then the eight mismatch classes, each computed in code with counts and example rows, plus integrity flags (a row that ends before it starts, a duration that disagrees with its own times, a timestamp in the future). It writes nothing.                                                                                                                                      | `modules/imports`                  |
| `imports.commitPack`     | Commits only rows whose fixes a person approved, through the existing batch and undo. A re-run gives the same result.                                                                                                                                                                                                                                                                                                                                            | `modules/imports`                  |
| Bhavin's export          | Becomes one adapter that produces the pack. Ticket 09 keeps its acceptance tests unchanged.                                                                                                                                                                                                                                                                                                                                                                      | `modules/imports/bhavin.ts`        |
| `plant-onboarding` skill | Adapted from the plugin's `skills/data-consolidate`, `skills/onboarding` and `onboarding/reference/time-config.md`. It reads whatever the plant sends (Excel, PDFs, photos of registers and nameplates), maps it onto the pack, runs `validatePack` through the CLI, proposes each fix with both spellings, takes a yes per fix class, and repeats until the report is clean. It runs the shift and day-boundary interview with a clock check against real data. | `.claude/skills/plant-onboarding/` |

Rules carried over from the plugin, each becoming a test:

1. **Normalisation ladder:** trim, then case, then punctuation, then a lost prefix only when exactly one machine matches, then leading zeros only when the padded partner exists, then revision suffix. Every rule that fires is logged.
2. **Date window first.** Sources that don't overlap are not joined. A partial overlap offers two choices: narrow to the overlap, or wait for more data.
3. **No automatic fix for orphans, duplicates or one-sided records.** A duplicate is counted at the sheet's grain and both rows are shown.
4. **A yes covers only the fix classes the person was shown.** The approver's name is the one they typed.
5. **Absent is not zero.** An empty field stays empty and is reported. It never becomes 0.

## Lane 2 — AI inside the product (after M1 cutover, alongside M2)

- **Provider:** the Messages API with tool use behind the existing `AiProvider`. Each call runs in a job with a 30-second timeout.
- **Tools:** the tools are module read interfaces that already exist or are planned: `tickets.search`, machine history, `documents.search`, `analytics.figuresByIds`. The model never sees SQL or other tenants.
- **Prompts:** `modules/ai/prompts/<feature>.md`, each with a version that `ai_suggestion` records.
- **Release path:** shadow first, then the evaluation harness, then live per tenant above its threshold, then confirm through the owning command (D16).

| Order | Feature                                                            | From the plugin                                                  | Grounding checked in code                                                                                                                                                                                                                                                           |
| ----- | ------------------------------------------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | **Diagnosis on the ticket** (new)                                  | `skills/breakdown-diagnosis` and `reference/evidence-sources.md` | The lockout line always comes first. `safety_flagged` is required and carries its reason. Each candidate cites ticket ids that `tickets.search` returned, or it is dropped. A candidate with no citation is labelled a guess. Each candidate has a first check and an expected fix. |
| 2     | Fix finder with evidence (57)                                      | evidence-sources, _Check for templates_                          | The template-note check runs in SQL: group close-out text across machines of different models, and never cite text that spans makes. Report what share of notes are usable.                                                                                                         |
| 3     | Code suggestion (58)                                               | downtime-record, _Reason codes are passed through_               | The code must be in the tenant's `failure_code` list, or it is dropped.                                                                                                                                                                                                             |
| 4     | Note themes in the bad-actor ranking (54)                          | `breakdown-diagnosis/reference/bad-actor-mode.md`                | Nightly job. Each theme names the ticket ids behind it.                                                                                                                                                                                                                             |
| 5     | Schedule (PM) draft from a confirmed diagnosis and the manual (60) | breakdown-diagnosis, step 8                                      | Cites manual pages. The draft goes to `pm.createDraftPlan`.                                                                                                                                                                                                                         |
| 6     | Daily briefing (59)                                                | `shared/scheduling.md` and morning-plant-pulse                   | Numbers come only from `kpi_snapshot` ids. Safety first, then data freshness.                                                                                                                                                                                                       |

## Rules that land without AI (engine and tickets tests)

- **Ticket 40 (MTTR and MTBF):** an ongoing outage has a null duration, never zero. A machine with no history is listed as "unreported", never as the best machine. Each machine's coverage window is stated.
- **Ticket 42 (repeat faults):** the outcome is one of four: first occurrence, repeat where the earlier fix held, repeat where it failed, or no searchable history. A null "fix held" is never counted as held.
- **Tickets 47 and 54 (coded closes and ranking):** rank by minutes _and_ by number of failures. The share coded "Other" or left blank is reported as its own finding and never ranked as a cause.
- **Ticket 48 (shift-calendar figures):** the cross-midnight rule is stated. Planned maintenance time is excluded from the denominator. Availability above 100% is reported, not capped.
- **Ticket 66 (lockout):** the plugin's safety triggers are candidate prompts: a seized part that rotates, a defeated guard or interlock, stored energy, line pressure, an electrical fault, and "restarted, not fixed" that is now repeating. This is a product decision for Nimish.

## Not adopted

- Quoting, RFQ, supplier sourcing and supplier escape.
- CAD variants and trade studies.
- Production OEE and the morning report: SPEC defers OEE.
- `pulse_compute.py`.
- The Fusion, NetSuite and M3 connectors.

## Ticket changes (to-tickets, after the architect step accepts ADR 0007)

| New | Ticket                                                                                     | Blocked by |
| --- | ------------------------------------------------------------------------------------------ | ---------- |
| 69  | Import pack v1: contract, `validatePack`, `commitPack`, with Bhavin's export as an adapter | 09         |
| 70  | `plant-onboarding` skill, run end to end on a second, pseudonymised plant's files          | 69         |
| 71  | Real Claude provider, redaction, consent, spend cap (replaces the gate in 55)              | 55         |
| 72  | Diagnosis on the ticket, shadow then live                                                  | 56, 69     |

Tickets 55 and 56 move to directly after 28 (cutover) and run alongside M2. Tickets 57 to 60 follow 72.

## Questions for Nimish (product only)

1. What is in Bhavin's "last 560": days, tickets or machines? It sets how much history the diagnosis and note mining start with.
2. Is onboarding done by us for each customer for now (this plan), or must a plant do it alone? Doing it alone means an in-app wizard later.
3. What consent wording goes to Cosmos for processing ticket text and photos outside India?
