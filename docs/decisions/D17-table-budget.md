# D17 — Table budget: 40 tables for the whole product, no duplicates

Date: 13 November 2026. Supersedes the planned-table list in `docs/DATA-MAP.md` §2 where they differ.

**Decision.** Uptimo has **28 tables today** (29 built, `ticket_tag` removed before cutover) and adds **at most 12** for everything in the BRIEF (M1, M2, M4a, M4b, M6, M3): **40 in total**. A new table is allowed only if the `schema-reviewer` confirms, in writing, that the data cannot live in an existing table (a row kind, a status column, a `list_item` list, a `setting` key, a `ticket_event` type or the `file` table). The table count is checked in CI against this budget.

**Why.** The product owner requires an efficient codebase with no duplicate or speculative tables. The reviewed design had 35 planned tables (63 in total); 23 of them re-stored something an existing table already holds, and 12 remain.

## The 12 new tables

| Milestone | Table             | Why it cannot live elsewhere                                                                                                |
| --------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| M2        | `roster_entry`    | Who is on duty per date, shift and level; a dated grid, not a setting                                                       |
| M2        | `escalation_rule` | Per-trigger ladder steps with people and repeat limits                                                                      |
| M2        | `notification`    | One row per message sent (dedupe key, status `queued/sent/failed/dead`, attempts); the dead letter is a status, not a table |
| M4a       | `kpi_snapshot`    | Engine results by run, period and subject (run id and as-of on the row; the monthly scorecard is a frozen period here)      |
| M4b       | `forecast`        | Frozen monthly forecast per machine; the outcome is filled into the same row later                                          |
| M4b       | `intervention`    | PM changes compared against similar machines                                                                                |
| M4b       | `pm_plan`         | Plan per machine or category: interval, meter, tolerance, checklist items as a list on the row                              |
| M4b       | `asset_register`  | AMC, warranty and legal tests/calibrations: one table, `kind` column, due dates                                             |
| M6        | `ai_suggestion`   | Suggestion, its evidence ids, and the person's accept/reject on the same row                                                |
| M6        | `document`        | An uploaded manual (the file itself is in `file`)                                                                           |
| M6        | `document_chunk`  | Searchable passages of a manual                                                                                             |
| M3        | `wa_message`      | Inbound and outbound WhatsApp messages; voice note media is a `file`, its transcript and confirmation are columns here      |
| M1        | —                 | none: screen wording overrides are a `setting`; list labels already have `label_gu`                                         |

## Planned tables removed (and where the data lives instead)

| Removed                                      | Lives in                                                                                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui_translation`                             | Product Gujarati catalogue in code; plant overrides as a `setting`; list labels on `list_item.label_gu`                                         |
| `failure_code`, `failure_code_alias`         | `list_item` list `failure_code`, aliases as a column on the row                                                                                 |
| `failure_coding`                             | Columns on `breakdown_report` (component, mode, cause, action codes)                                                                            |
| `escalation_event`                           | `ticket_event` type `escalate` (already in the domain's event list)                                                                             |
| `handback`                                   | `ticket_event` types `handback_confirm` / `handback_dispute`; the timeout is an `sla_timer` kind                                                |
| `notification_dead_letter`                   | `notification.status = 'dead'`                                                                                                                  |
| `history_breakdown`                          | Closed `ticket` rows imported through the existing past-breakdown path, with their source reference — one place for history, no double counting |
| `engine_run`, `scorecard`                    | Columns and a frozen period on `kpi_snapshot`                                                                                                   |
| `forecast_outcome`                           | Columns on `forecast`                                                                                                                           |
| `pm_checklist`, `pm_checklist_item`          | Checklist items as a list on `pm_plan`                                                                                                          |
| `pm_task`                                    | A `ticket` with raised channel `pm`                                                                                                             |
| `pm_execution`                               | That ticket's report (ticked points as report data)                                                                                             |
| `service_contract`, `compliance_item`        | One `asset_register` with a `kind` column                                                                                                       |
| `ai_feedback`                                | Columns on `ai_suggestion`                                                                                                                      |
| `ai_eval_set`, `ai_eval_case`, `ai_eval_run` | Test files in the repo, run as tests; results in CI output                                                                                      |
| `wa_contact`                                 | `person.phone` (one home for the number)                                                                                                        |
| `wa_conversation`                            | Derived from messages by phone and the 24-hour window                                                                                           |
| `voice_note`                                 | `file` plus columns on `wa_message`                                                                                                             |

**Rejected:** keeping one table per concept for "clarity" — it doubled the schema and created the double-counting and duplicate-truth problems the schema reviews kept finding.
