# Domain model & API

The tables Claude Code implements first. Field names here are the names in code.

## 1. Entities and fields

Every table has `id` (UUID v7), `tenant_id`, `created_at`, `updated_at`, and RLS. Field names are snake\_case in SQL and camelCase in TypeScript. Bhavin's field names are kept where they are clear so his export maps directly.

**Tenancy and people**

| Table | Fields | Notes |
| --- | --- | --- |
| `tenant` | `slug`, `name`, `logo_file_id`, `language` (gu, hi, en), `time_zone`, `plan`, `status` | One row per customer; `slug` replaces Bhavin's `X-Client` id |
| `plant` | `tenant_id`, `name`, `code`, `address` | Deferred to M5: one tenant is one plant until then, and plant\_id below reads as tenant\_id |
| `person` | `plant_id`, `name`, `short_name`, `phone` (E.164, unique per tenant, nullable), `team` (maintenance, production, vendor), `title` (Operator, Setter, Supervisor, Engineer), `default_shift`, `active` | The acting human; replaces free-text names. Also kind (staff, production, vendor), cell, and pending (true when created from a free-text floor name, for the admin to confirm or merge) |
| `login` | `person_id` (nullable for shared), `username` (unique per tenant), `password_hash` (Argon2id), `role` (operator, technician, supervisor, head, plant\_head, admin, board), `shared` (bool), `must_change_password`, `disabled_at` | A shared login has no person and may carry a cell (a shared cell phone), which decides which machines count as its own for handback; each action records `acting_person_id` |
| `session` | `login_id`, `token_hash`, `device_label`, `last_seen_at`, `expires_at`, `revoked_at` | 30-day sliding; list and revoke per device |
| `platform_access` | `tenant_id`, `platform_user`, `granted_by`, `expires_at`, `reason` | Our time-limited support access; logged |

**Machines and configuration**

| Table | Fields | Notes |
| --- | --- | --- |
| `segment` | `plant_id`, `code` (CNC, Conventional, Process, Utility, DG, Robot), `name`, `sort`, `show_on_board`, `group_by` (letters, category) | Bhavin's `seg`, `segShow`, `segGroup`, `segOrder` |
| `machine_group` | `segment_id`, `code` (prefix such as VC, or a category), `name`, `sort`, `hidden` | Bhavin's `groups`, `groupNames`, hidden utilities |
| `machine` | `plant_id`, `code` (VC-17), `segment_id`, `group_id`, `category`, `cell`, `area`, `location`, `criticality` (A, B, C; M2), `make`, `model`, `serial`, `controller`, `controller_model`, `controller_serial`, `year`, `purchased_on`, `power_kw`, `capacity_kva`, `asset_code`, `status` (active, idle, scrapped), `metadata` jsonb | The platform's full nameplate fields; `code` is unique per plant |
| `machine_move` | `machine_id`, `from_cell`, `to_cell`, `effective_from` | Effective-dated moves so history reports where the machine was |
| `list_item` | `plant_id`, `list` (wait\_reason, work\_type, quick\_problem, breakdown\_category, maint\_code, observed\_by, location, cell, task\_reason), `code`, `label`, `label_gu`, `label_hi`, `sort`, `active` | All of Bhavin's option lists in one table, with flags: is\_vendor and pauses\_sla on wait reasons, tag (the short board label such as AT VENDOR) |
| `shift` | `plant_id`, `code` (1, 2, 3), `name`, `starts_at`, `ends_at`, `crosses_midnight` | `shiftTimes`; used for day reports and (M4) KPIs |
| `setting` | `scope_type` (tenant, plant, segment, machine\_class, machine), `scope_id`, `key`, `value` jsonb | Cascade resolver returns the nearest scope; features, glossary, SLA defaults live here |
| `glossary_term` | `plant_id`, `source` (Gujarati or transliterated), `english`, `direction` | Bhavin's `glossary` |

**Tickets**

| Table | Fields | Notes |
| --- | --- | --- |
| `ticket` | `plant_id`, `ref` (BD-0149, WR-0098; sequence per prefix per tenant), `kind` (stopped, support, general), `status` (open, working, waiting, closed, cancelled), `machine_id` (null for general), `machine_snapshot` jsonb (code, category, cell at the time), `location`, `work_type`, `urgent`, `problem`, `problem_lang`, `reported_at` (`downAt`), `reported_by_person_id`, `reported_by_role` (Operator, Setter, Supervisor, Engineer, Maintenance), `raised_login_id`, `raised_channel` (floor, desk, whatsapp, qr, import), `self_started`, `started_at`, `lead_person_id` (`startedBy`), `segment_started_at` (`segStart`), `handed_over`, `handover_since`, `transfer_to_person_id`, `transfers`, `wait_reason`, `wait_since`, `paused_by_person_id`, `assigned_to_person_id`, `expected_back_at` (`eta`), `waiting_spare`, `machine_running_at` (`runningAt`), `machine_stopped_at` (`stopAt`), `closed_at`, `closed_by_person_id`, `close_kind` (report, no\_report, done), `close_note`, `parent_id`, `task_reason`, `task_expected_on`, `task_down_min`, `severity` (M2), `criticality_snapshot` (M2), `sla_policy_id` (M2), `handback_status` (M2), figures: `response_min`, `active_min`, `wait_min`, `vendor_min`, `handover_wait_min`, `down_acc_min`, `downtime_min`, `follow_min`, `repair_min`, `edited_at` | One row per ticket; cached figures recomputed from events, segments and overrides at every transition. Also: overrides jsonb (admin-set hands-on and waiting minutes), transfer\_to\_shift (a transfer to "next shift"), kind\_upgraded\_at (support upgraded to stopped), last\_event\_seq |
| `ticket_event` | `ticket_id`, `seq`, `type` (down, start, pickup, update, pause, resume, transfer, join, leave, lead, running, stopped, upgrade\_kind, close, report, past\_breakdown, cancel, restore, edit, task, acknowledge, escalate, handback\_confirm, handback\_dispute, whatsapp\_in, whatsapp\_out), idempotency\_key (unique per ticket), `at`, `login_id`, `acting_person_id`, `text`, `payload` jsonb (reason, spare, eta, to, role, minutes, changes old and new) | Append-only; Bhavin's `updates` and `/api/ticket.events` |
| `crew_member` | `ticket_id`, `person_id`, `role` (primary, support), `joined_at`, `left_at`, `left_reason` | `crew[]` |
| `work_segment` | `ticket_id`, `person_id`, `role` (lead, primary, support), `started_at`, `ended_at`, `end_reason` (pause, transfer, leave, close, cancel) | The only interval table. The union of a ticket's segments gives the job's hands-on time (overlapping people do not double it), each person's own segments give their minutes; stopped periods, pauses and handover waits are derived from event pairs. Union gives `active_min` and per-person minutes |
| `breakdown_report` | `ticket_id`, `machine_id`, `date`, `shift_code`, `problem`, `observed_by`, `corrective_action`, `done_by` (person ids), `supported_by` (person ids), `downtime_min`, `response_min`, `repair_min`, `breakdown_category` (E, M, E/M, PM), `maint_code`, `spare_used`, `root_cause`, `handover_name`, `signature_file_id`, `pdf_file_id`, `qr_payload` jsonb, `submitted_by_person_id`, `submitted_at`, `approved_at` (M4) | The old form; `root_cause` finally gets a field |
| `failure_coding` (M4) | `ticket_id`, `component_code`, `failure_mode_code`, `cause_code`, `action_code`, `suggested_by` (person, ai), `confidence`, `confirmed_by_person_id` | Our taxonomy; codes from `failure_code` |
| `file` | `plant_id`, `kind` (pdf, photo, voice, signature, import, logo), `s3_key`, `mime`, `bytes`, `sha256`, `ticket_id` nullable, `uploaded_by` |  |
| `push_subscription` | `login_id`, `acting_person_id`, `endpoint`, `keys` jsonb, `role`, `last_ok_at` |  |
| `audit_log` | `login_id`, `action`, `entity`, `entity_id`, `before` jsonb, `after` jsonb, `at`, `ip` | Settings and admin actions; tickets use `ticket_event` |
| ref\_counter | prefix (BD, WR), next\_value | Locked FOR UPDATE inside the raise transaction; set to the imported maximum plus one by import:bhavin; staging tenants start at 1 |

**Accountability (M2)**

| Table | Fields |
| --- | --- |
| `sla_policy` | `plant_id`, `severity`, `ack_minutes`, `restore_minutes`, `pause_max_minutes`, `handback_minutes`, `business_hours_only` |
| `escalation_rule` | `plant_id`, `trigger` (ack\_missed, restore\_missed, pause\_overrun, reopened\_twice, critical\_still\_down, handback\_unanswered), `severity_min`, `level` (L1 to L4, vendor), `notify_role`, `notify_person_id`, `channels`, `repeat_minutes` |
| `sla_timer` | `ticket_id`, `kind` (ack, restore, pause, handback), `due_at`, `paused_at`, `fired_at`, `state` |
| `escalation_event` | `ticket_id`, `rule_id`, `level`, `at`, `notified_person_ids`, `acknowledged_by_person_id`, `acknowledged_at` |
| `roster_entry` | `plant_id`, `person_id`, `date`, `shift_code`, `role_on_duty` (L1, L2, L3, L4) |
| `handback` | `ticket_id`, `requested_at`, `requested_from_person_id`, `responded_at`, `response` (confirmed, disputed, timed\_out), `dispute_reason`, `channel` |

**Messaging (M3), PM and engine (M4), imports (M5)** follow the same pattern: `wa_contact`, `wa_conversation`, `wa_message`, `notification`; `pm_plan`, `pm_task`, `pm_checklist`, `pm_execution`; `failure_code`, `failure_code_alias`; `engine_run`, `kpi_snapshot`, `forecast`, `forecast_outcome`, `scorecard`, `intervention`; `import_batch`, `import_row`. Their fields are written when their milestone starts.

## 2. Ticket state machine

Five stored states and three flags (`handed_over`, `machine_running_at`, `parent_id`) reproduce every situation Bhavin's app shows. Severity, SLA and handback (M2) add fields and events, not states.

*(Diagram in the shared doc: ticket state machine · 5 states, 10 transitions.)*

Every transition is a command handled by `transition(ticket, events, command, ctx)` in `packages/domain`; it validates, returns the new ticket, the events to append, the segment changes and the jobs to enqueue. The API loads the ticket `FOR UPDATE`, applies the command, and commits in one transaction; a concurrent command on the same ticket waits and is then re-validated (two people starting the same ticket: the second gets `conflict` with the current ticket). Every command carries an `Idempotency-Key`; a repeat returns the first result. **General rules:** a command's time may not precede the ticket's last event (back-dating stops at the latest event, so a close cannot be placed before a join or a running-again); times are server time in whole minutes; the 5-minute step is a client convenience, not a server rule.

| Command | From | To | Who may (server-checked) | Validation | Records |
| --- | --- | --- | --- | --- | --- |
| `raise` | — | open | operator, technician, supervisor, head, admin; a WhatsApp sender matched to a person; an unknown floor name creates a pending production person | problem required; machine required unless `kind=general` (then location and work type); duplicate: an open non-general ticket on the same machine returns the existing ticket (`conflict`) | event `down`; `self_started` if raised by maintenance with "starting now" (then also `start`) |
| `upgradeKind` | open, working, waiting (`kind=support`) | same status, `kind=stopped` | technician and above; offered when someone tries to raise a stopped ticket on a machine with an open support ticket |  | event `upgrade_kind`; downtime counts from this time |
| `start` / pick up | open | working | technician and above; on a shared phone the acting person is chosen | `at` between reported\_at (or handover\_since) and now, whatever was written in between; one lead only | event `start` or `pickup`; `work_segment` opened for the lead; `response_min` = first start minus reported (null while self-started tickets are not started by anyone else; a self-started ticket's response is null, as in v3) |
| `join` | working, waiting | same | technician and above, not already on the ticket and not the person running it (409); the lead may add anyone (shared login only until the contract carries who adds) | role primary or support | event `join`; `crew_member`; a `work_segment` opens only while the ticket is working |
| `leave` | working, waiting | same | the crew member, or the lead when a primary exists to take over (409 when none does) | reason required | event `leave` (and `lead` if the lead changed: the earliest-joined primary takes over, their own segment closes and a lead segment opens at the same minute); the person's segment closes; `crew_member.left_at` |
| `pause` | working | waiting | technician and above (feature flag `pause`) | reason from the list; optional note, expected back (stored 18:00 local on the chosen day, as today), assignee | event `pause`; every open segment closes; the pause is the interval from this event to `resume` |
| `resume` | waiting | working | technician and above; if `assigned_to` is someone else, the client asks for a second confirmation |  | event `resume` with minutes waited; the lead stays lead when the lead or someone on the crew resumes (anyone else who resumes becomes lead and gets a new segment); every crew member who has not left gets a new segment at the resume time, as in `worker.js` |
| `transfer` | working | open (`handed_over`) | technician and above (any, as in v3) | note required; optional target person or next shift | event `transfer`; segments close; the crew is stopped and marked left with the reason "job transferred"; handover wait runs from this event to `pickup`; `transfers` + 1 |
| `update` | open (handed over), working, waiting | same | technician and above | text required; optional spare, expected date | event `update` |
| `machineRunning` | working, waiting (`kind=stopped`), not already running | same | technician and above | time between the last event and now | event `running`; downtime stops |
| `machineStopped` | working, waiting (running set) | same | technician and above | optional `at`, not before the running time | event `stopped`; downtime resumes |
| `closeWithReport` | working | closed (`report`) | lead, a primary crew member, supervisor, head, admin; on a shared login anyone (as in v3) | finish time between the last event and now; report fields valid; optional task | event `close`; `breakdown_report`; segments close; figures finalised; child task created if given; PDF job; (M2) handback requested |
| `closeWithoutReport` | working | closed (`no_report`) | same | reason required | event `close`; listed under needs-report for 7 days |
| `markDone` | working (`kind=general`) | closed (`done`) | same | what was done required; for a task: optional machine-stopped minutes, optional next task | event `close`; `task_down_min` |
| `lateReport` | closed (`no_report`) | closed (`report`) | technician and above | report fields valid | event `report`; `breakdown_report` |
| `recordPastBreakdown` | — | closed (`report`) | technician and above | the old "report only": machine, date, shift, downtime and the form fields; no live timeline | a ticket with `raised_channel=backfill`, events `down` and `close` at the given times, figures taken from the form as overrides |
| `cancel` | open, working, waiting | cancelled | technician and above for any ticket; an operator only for their own ticket with `started_at` null | reason required | event `cancel` with the previous status; segments close; a `ticket.cancel` audit row; a ticket already closed or cancelled is 409 |
| `restore` | cancelled (within 7 days) | the previous status | admin | reason required | event `restore` and a `ticket.restore` audit row; a restored working ticket reopens a segment for the previous lead from the restore time; a restored waiting ticket is waiting again; the cancelled gap counts in no waiting, handover wait or downtime figure (§5, Nimish's ruling of 14 Nov) and in no hands-on segment |
| `correct` | any active, or closed within 7 days | same | admin | reason required; only changed fields; may change reported, started, closed times, lead, closed by, problem, machine, kind; may set hands-on and waiting minutes directly; the arithmetic check warns as today | event `edit` with old and new values (kept on the event and returned by the ticket detail) and a `ticket.correct` audit row with the reason; directly set minutes become overrides (`activeMin`, `waitMin` in the request); figures recomputed; a breakdown or support request cannot be left without a machine; the 7 days run from the time the close was recorded (the close event), so a correction cannot renew them, and a closing time cannot be moved later than that; corrected times must agree with the ticket's own events and work segments (422 with the reason): the start and the report not after the first work, the close not before the last work; a closing time and minutes set by hand only on a closed ticket, and `null` takes minutes set by hand off again; the start time moves only the displayed field (response and repair read the start event, which is history): to change them correct the report time or set minutes directly |
| `acknowledge` (M2) | open, working | same | assignee or any on-duty technician |  | event `acknowledge`; the ack timer stops (a `start` or `pickup` also stops it) |
| `escalate` (M2) | any active | same | the job runner, on a timer |  | event `escalate`; `escalation_event`; notices |
| `handbackConfirm` / `handbackDispute` (M2) | closed | closed / working (reopened) | the login that raised it, any login whose cell matches the machine's cell, supervisor and above | dispute reason required | event; on dispute the ticket returns to working with a new segment for the last lead; a handback left unanswered past the policy time is recorded `timed_out` and the ticket stays closed |

## 3. Permissions matrix

One role vocabulary everywhere (code, API, screens): `operator` (Bhavin's report), `technician` (maint), `supervisor`, `head` (maintenance head, new), `plant_head` (new), `admin`, `board`. Our own staff are not a tenant role: a `platform_access` grant gives a named platform user time-limited admin-equivalent access to one tenant, every action logged. Every cell below is a server-side check in `packages/domain` and a test case. "Own" means raised from this login, or on a shared login, raised from the same login.

| Action | operator | technician | supervisor | head | plant\_head | admin | board |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Raise machine ticket or work request | yes | yes | yes | yes | yes | yes | no |
| Cancel | own, not yet started | any active | any active | any active | no | any active | no |
| Start, update, pause, resume, transfer, join, leave, running, stopped, upgrade kind | no | yes | yes | yes | no | yes | no |
| Close with report, without report, mark done | no | lead or primary on the ticket; anyone on a shared login | any | any | no | any | no |
| Late report; record a past breakdown | no | yes | yes | yes | no | yes | no |
| Confirm or dispute handback (M2) | own, or any ticket on a machine in the login's cell | no | yes | yes | yes | yes | no |
| Acknowledge an escalation (M2) | no | L1 | L2 | L3 | L4 | yes | no |
| Restore cancelled (7 days) | no | no | no | no | no | yes | no |
| Correct a ticket (7 days) | no | no | no | no | no | yes | no |
| Day report | no | own only | any person | any person | team | any | no |
| Live board | if enabled for the plant | yes | yes | yes | yes | yes | yes |
| Money figures (cost, turnover) | no | no | no | yes | yes | yes | no |
| Analytics and scorecard | no | no | read | yes | yes | yes | no |
| Settings: lists, machines, shifts, translations | no | no | no | yes | no | yes | no |
| Settings: people and logins, roles | no | no | no | no | no | yes | no |
| Settings: SLA, escalation, WhatsApp, other caps | no | no | no | yes | no | yes | no |
| Settings: AI monthly cap and consent (D22) | no | no | no | no | no | yes | no |

**Shared logins** carry a role like any other login; every action also records the acting person chosen on the phone, and the person list offered is the plant's active people for that team. **WhatsApp senders** are matched to a person by phone number; an unknown number gets a polite refusal and the admin a notice. **Platform access** (our staff) is granted per tenant with an expiry and a reason, acts with admin permissions, and writes every action to the tenant's audit log; tenant creation and billing live in a separate platform surface outside any tenant.

## 4. API contract (v1)

Base `/api/v1`, JSON. **Tenant from the host name** (`cosmos.<domain>`), resolved before anything else, so `/brand` and `/auth/login` know the tenant without a parameter. **Auth:** one mechanism, a bearer session token in `Authorization` for every client (better-auth bearer plugin). **Commands** (every `POST` that changes a ticket) carry an `Idempotency-Key` header; a repeat returns the first response. **Lists** use cursor pagination: `?cursor=&limit=` (default 50, maximum 200) and return `{items, nextCursor}`. **Errors** are `{error:{code, message, field?}}` with codes `unauthenticated`, `forbidden`, `not_found`, `conflict`, `validation`, `rate_limited`, `internal`; a row in another tenant is `not_found`. `X-Request-Id` is echoed. Zod schemas in `packages/shared` are the single source; the OpenAPI document is generated only when an outside consumer appears. Bhavin's endpoint is shown so the import and the cutover can map one-to-one.

**Auth and account**

| Endpoint | Request | Response | Bhavin's |
| --- | --- | --- | --- |
| `POST /auth/login` | `{username, password, device}` | `{token, user:{id, username, name, role, shared, title}}` | `/api/login` |
| `GET /auth/me` |  | `{user}` | `/api/me` |
| `POST /auth/logout` |  |  | `/api/logout` |
| `POST /auth/password` | `{old, password}` |  | `/api/password` |
| `GET /auth/sessions` · `DELETE /auth/sessions/{id}` |  | device list; revoke | new |
| `GET /brand?tenant=slug` |  | `{company, logo}` by host (public, rate-limited); no tenant parameter | `/api/brand` |

**Configuration**

| Endpoint | Request | Response | Bhavin's |
| --- | --- | --- | --- |
| `GET /config` | `?fp=` | `{config, fp}` or `{same:true}`; config = lists, segments, groups, machines (id, code, category, cell, segment, criticality), people, shifts, features, glossary, language | `/api/config` |
| `GET /settings` · `PUT /settings/{scope}/{key}` |  | cascade read and write | new |
| `GET/POST/PATCH /machines`, `/people`, `/logins`, `/lists/{list}`, `/shifts`, `/segments`, `/groups` |  | master data CRUD, admin and head only | platform push |

**Tickets**

| Endpoint | Request | Response | Bhavin's |
| --- | --- | --- | --- |
| `GET /state` | `no parameters` | `{open[], closed24h[], cancelled24h[], needReport[], tasksOpen[], now, configFp}``; the full payload every time in M1 (a delta protocol only if a plant's size demands it)` | `/api/state` |
| `GET /tickets/{id}` |  | `{ticket, events[], people[], tasks[], intervals}` | `/api/ticket` |
| `GET /tickets` | filters: status, kind, machine, person, from, to, page | list for Mine, Team, closed 30 days | `/api/mywork` |
| `POST /tickets` | `{kind, machineId?, location?, workType?, urgent?, problem, problemLang?, reportedByPersonId?, reportedByRole?, startNow?, startByPersonId?}` | `{ticket}` or `409 {existing}` | `/api/down` |
| `POST /tickets/{id}/start` | `{personId, at}` | `{ticket}` | `/api/start` |
| `POST /tickets/{id}/join` · `/leave` | `{personId, role}` · `{personId, reason}` | `{ticket}` | `/api/join`, `/api/leave` |
| `POST /tickets/{id}/pause` · `/resume` | `{personId, reasonCode, note?, expectedBackOn?, assignToPersonId?}` · `{personId, note?}` | `{ticket}` | `/api/pause`, `/api/resume` |
| `POST /tickets/{id}/transfer` | `{personId, toPersonId?, note}` | `{ticket}` | `/api/transfer` |
| `POST /tickets/{id}/update` | `{personId, text, spare?, expectedOn?}` | `{ticket}` | `/api/update` |
| `POST /tickets/{id}/machine-running` · `/machine-stopped` | `{personId, at?, note?}` | `{ticket}` | `/api/running`, `/api/stopped` |
| `POST /tickets/{id}/close` | `{personId, kind:'report'\|'no_report'\|'done', at?, note?, report?, task?:{text, reasonCode, expectedOn?}, taskDownMin?}` | `{ticket:{figures}, task?:{id, ref}, pdfJobId?}` | `/api/close` |
| `POST /tickets/{id}/report` | `{personId, report}` | `{ticket}` | `/api/report` |
| `POST /tickets/{id}/cancel` · `/restore` | `{personId, reason}` | `{ticket}` | `/api/cancel`, `/api/restore` |
| `POST /tickets/{id}/correct` | `{reason, changes:{reportedAt?, startedAt?, closedAt?, activeMin?, waitMin?, problem?, leadPersonId?, closedByPersonId?}}` | `{ticket, changed[]}` | `/api/edit` |
| `POST /tickets/{id}/acknowledge` (M2) | `{personId}` |  | new |
| `POST /tickets/{id}/handback` (M2) | `{personId, response:'confirmed'\|'disputed', reason?}` | `{ticket}` | new |

**Reports and files**

| Endpoint | Request | Response | Bhavin's |
| --- | --- | --- | --- |
| `GET /reports/day` | `?from&to&team=1&personId=` | `{people:[{person, mins, closed, supportMins, primaryMins, jobs[]}]}` | `/api/dayreport` |
| `POST /reports/day/pdf` | same | `{fileId, url}` (rendered by the worker) | client-side jsPDF |
| `GET /tickets/{id}/pdf` |  | `{fileId, url}` breakdown report PDF | client-side jsPDF |
| `POST /files/presign` · `GET /files/{id}` | `{kind, mime, bytes, ticketId?}` | upload URL; download URL | new |

**Notifications and channels**

| Endpoint | Request | Response | Bhavin's |
| --- | --- | --- | --- |
| `GET /push/key` · `POST /push/subscribe` · `/unsubscribe` · `/test` | `{subscription, actingPersonId}` |  | `/api/pushkey`, `/api/subscribe`, `/api/unsubscribe`, `/api/pushtest` |
| `GET/POST /whatsapp/webhook` (M3) | Meta verification and inbound events, signature-checked | 200 | new |
| `GET /notifications` | my recent notices |  | new |

**Analytics, imports, admin** (M4, M5): `GET /analytics/kpis`, `/analytics/forecast`, `/analytics/scorecard`, `/analytics/machines/{id}`; `POST /imports`, `GET /imports/{id}`, `POST /imports/{id}/commit`, `/undo`; `GET /audit`. Defined when those milestones start, from the same schema conventions.

## 5. Derived figures: exact definitions

New tickets follow Bhavin's `worker.js` arithmetic (Nimish's ruling, 13 Nov 2026), so a ticket raised on Uptimo and one raised on his app show the same minutes. His stored numbers on imported tickets are kept as recorded and never recomputed (ticket 09); `figures.drift` skips them. The proof is `apps/server/test/figures-worker-parity.test.ts`: `figures()` is run on every ticket of the pseudonymised export and must equal the port of his arithmetic in `imports/real-oracle.ts`. Everything is computed by one pure function `figures(events, segments, overrides, now)` from the event log and the work segments, then cached on the ticket; overrides (set by an admin correction or by a past-breakdown record) are applied last.

**Rounding:** every elapsed time is rounded to the nearest whole minute, never below zero (his `mins()`, `Math.round`). No figure has a one-minute floor.

**Finished stretches only:** hands-on, waiting, handover wait and `down_acc` hold stretches that have ended. A stretch still open (working, paused, transferred, machine down) is shown live from its start time and is added to the figure when it ends or at the close, as `worker.js` does.

**Cancel and restore: cancelled time is not counted (Nimish, 14 Nov 2026; differs from Bhavin's `worker.js`).** The time between a `cancel` and its `restore` is not waiting, handover wait, downtime, repair or follow-up, so a ticket cancelled for a day does not keep counting (his app counts it: BD-0077 holds 366 minutes of downtime and of repair, ours 114). Hands-on is still the lead's finished segments, and a cancel ends the open one (DOMAIN §2). Repair is the wall clock from the first start to the close (or to the last `running`) less the cancelled time; follow-up likewise. The worker parity test lists BD-0077 as the explained difference.

| Figure | Definition | Bhavin's field |
| --- | --- | --- |
| Response | first `start` minus `reported_at`; null until started; null for a self-started ticket (as in v3); not changed by later transfers | `responseMin` |
| Hands-on (active) | the sum of the **lead's** finished work segments (a pickup makes the new person the lead); a joined primary's or supporter's minutes are their own (per-person below) and are not added | `activeMin` (+ `segStart`) |
| Repair | the wall clock from the first start to the close, or to the last `running` when the machine is running again at the close, less any cancelled time; pauses and waits are inside it; 0 until the ticket closes | `repairMin` |
| Waiting | sum of `pause` to `resume` (or to close or cancel) stretches; vendor waiting is the subset whose reason has `is_vendor` | `waitMin`, `vendorMin` |
| Handover wait | sum of `transfer` to `pickup` stretches | `handoverWaitMin` |
| Downtime so far (`down_acc`) | `kind=stopped` only: the finished stopped stretches, each from `reported_at` (or `kind_upgraded_at`, or the last `stopped`) to the next `running`; the open stretch is not in it | `downAcc` |
| Downtime at close | `stopped`: `down_acc` plus the open stretch to the close (nothing when the machine is running at the close); `support`: 0 (his rule of 6 Nov, to be confirmed by Bhavin); `general`: its hands-on minutes. No one-minute floor (two of his stopped tickets hold 0) | `downtimeMin` |
| Follow-up | from the last `running` event (not cancelled by a later `stopped`) to close | `followMin` |
| Per-person minutes | the sum of that person's own segments, each rounded, by role (lead or primary counted under Done by; support under Supported by) | `people[].mins`, `segments[]` |
| Task machine-stopped minutes | entered by the person who marks a task done, 0 to 1440; not added to the parent's downtime | `taskDownMin` |
| Day report work time | for each person, the part of each of their segments inside the report window; the window is the shift's start to its end (across midnight for shift 2), or the calendar day when no shift is chosen; the **production date** of a night-shift job is the date the shift started | `dayreport.people[].mins` |
| Overrides | an admin correction may set hands-on and waiting minutes directly; a past-breakdown record sets downtime, response and repair from the form; overrides replace the computed value, are shown with a marker, and are excluded from the drift check | `/api/edit` scalars |

**Time rules**

- No command's time may precede the ticket's latest event. Starts may be back-dated to the report time (or the transfer time for a picked-up ticket); closes to the latest event (segment start, join, running-again, whichever is last). A time in the future is clamped to now. The 5-minute step is a client convenience.
- Expected-back dates are stored as 18:00 local on the chosen day, as today, until the UI offers a time.
- Admin corrections may move reported, started and closed times, change lead, closed-by, problem, machine and kind, and set hands-on and waiting minutes directly; the arithmetic check warns when hands-on exceeds closed minus started minus waiting minus handover wait, or when the close precedes the start plus waiting. Old and new values live in the `edit` event.
- Restore reopens no past stretches: a restored working ticket starts a new segment for the previous lead at the restore time; a restored waiting ticket is waiting again; the cancelled gap counts in no waiting, handover wait, downtime, repair or follow-up figure (§5, Nimish's ruling) and in no hands-on segment.
- Time zone is the tenant's (Asia/Kolkata for Cosmos); shift 2 (18:29 to 05:00) crosses midnight and its production date is the start date; the one-minute overlap between shift 1's end (18:30) and shift 2's start (18:29) resolves to the later shift.
- Durations display as `n min`, `h h mm min`, `d d h h`, exactly as today.

**Severity (M2)** = lookup in the plant's matrix of criticality (A, B, C) by state (stopped, support): default A-stopped S1, B-stopped S2, A-support S2, C-stopped S3, B-support S3, C-support S4; work requests S4 unless urgent (S3). **SLA clocks (M2):** the acknowledge clock runs from `reported_at` until `acknowledge`, `start` or `pickup`; the restore clock runs from `reported_at` until close, or until `running` for a stopped ticket (the machine is back even if the ticket stays open), and pauses only during pauses whose reason has `pauses_sla` (vendor and spares by default; "machine not released by production" does not pause it, because that is production's clock, which the handback report shows). Handover waits never pause it: a transferred ticket nobody picks up is exactly what escalation is for. Business hours are off by default and configurable per plant. Timers are re-armed from the recomputed figures after `correct` and `restore`. A handback left unanswered past the policy time is `timed_out`; the ticket stays closed and the escalation rule `handback_unanswered` decides who hears about it. The downtime clock never pauses.
