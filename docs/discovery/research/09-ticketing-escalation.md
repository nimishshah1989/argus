# Research: ticketing core and escalation matrix (28 Oct 2026)

## Atlas today (paths under api/src/main/java/com/grash/)
- Workflow engine is event-driven only: model/Workflow.java = one main trigger + ANDed conditions + one action + enabled flag.
- Triggers (WFMainCondition): WORK_ORDER_CREATED/CLOSED/ARCHIVED, REQUEST_CREATED/APPROVED/REJECTED, PURCHASE_ORDER_CREATED/UPDATED, TASK_UPDATED, PART_UPDATED. No status-changed trigger, no time-based trigger.
- WorkOrder actions: assign priority/asset/location/user/team/category. SEND_REMINDER_EMAIL and ADD_CHECKLIST are TODO stubs. TITLE_CONTAINS condition has no handler.
- Possible bug: disabled workflows may still run (repository query and runWorkOrder don't check `enabled`) — test before relying on it.
- No SLA/escalation. Priority NONE/LOW/MEDIUM/HIGH; Status OPEN/IN_PROGRESS/ON_HOLD/COMPLETE. WorkOrder.firstTimeToReact stamped on first status change/labour/part (feeds mean-time-to-acknowledge analytics). WORK_ORDER_OVERDUE webhook event is TODO. No asset criticality field.
- Quartz JDBC job store on Postgres (not clustered). Jobs: WorkOrderCreationJob, PreventiveMaintenanceNotificationJob, SubscriptionEndJob, LdapSyncJob, DeleteDemoCompaniesJob.
- Channels: in-app (DB + STOMP websocket), Expo push, email (SMTP/SendGrid, Thymeleaf), webhooks (HMAC, no retry). No SMS/WhatsApp.

## Helpdesks considered (all rejected as dependencies)
Zammad AGPL-3.0 (good SLA timers, no asset model); Frappe Helpdesk AGPL-3.0; osTicket GPL-2.0 (single grace period); GLPI GPL-3.0 (best escalation levels — copy the design); Request Tracker GPL-2.0; Znuny GPL-3.0 / OTOBO (licence file unverified); FreeScout AGPL-3.0 (no SLA in core); UVdesk OSL-3.0 (no SLA found). Running any beside Atlas = two systems of record.

## Engines considered (rejected)
Temporal (MIT, overkill), Camunda 7 CE EOL Oct 2025, Camunda 8 (Camunda License 1.0: non-production without paid licence), Flowable (Apache-2.0, BPMN overhead), n8n (Sustainable Use License: internal use only), Windmill (mixed), Node-RED (not durable/multi-tenant).

## Decision: build SLA + escalation inside the Atlas fork
- Columns: asset.criticality (A/B/C); work order: severity, machine_state (STOPPED / RUNNING_DEGRADED), fault_type, acknowledged_at/by, restored_at, handback_status/at, escalation_level, paused_since, paused_seconds, reopen_count, stage (TRIAGE, ACKED, WAITING_SPARES, WAITING_VENDOR, PENDING_HANDBACK, REOPENED) — keep Atlas Status enum unchanged for client compatibility.
- Tables: sla_policy, escalation_rule, sla_timer, escalation_event (append-only, idempotent), shift_calendar, on_call_roster.
- Sweeper: Quartz job every 30-60 s, `SELECT ... FROM sla_timer WHERE due_at<=now() AND state='PENDING' FOR UPDATE SKIP LOCKED`; recompute on status/severity/pause change; enable Quartz clustering before multi-node.
- Add WORK_ORDER_STATUS_CHANGED trigger; channel interface over in-app, push, email + new WhatsApp and SMS adapters; webhook retry.

## Default matrix (proposed, tenant-configurable; not from a standard)
Severity = criticality x machine state: A stopped S1, A running S2, B stopped S2, B running S3, C stopped S3, C running S4. Safety/environment = S1; quality escape >= S2.
| Sev | Ack | Restore | Calendar |
|---|---|---|---|
| S1 | 5 min | 2 h | 24x7 |
| S2 | 15 min | 4 h | 24x7 |
| S3 | 60 min | 1 shift | shift |
| S4 | 4 h | 3 days -> planned | shift |
Warning at 75% of restore. L1 technician at creation (push, WhatsApp); L2 supervisor on ack breach / 50% restore for S1-S2 / "beyond skill"; L3 maintenance head (S1 +30 min, S2 restore breach, long pause, 2nd reopen); L4 plant head (S1 restore breach, S2 at 2x). Vendor/OEM tier with own clock; internal clock pauses WAITING_VENDOR. Targets = roles on duty from roster; re-notify at shift change. Pauses need reason + L2 approval + max length; downtime clock never pauses. Closure: job card -> PENDING_HANDBACK -> production confirms (auto after one shift) -> dispute within 24 h reopens same WO; 2nd reopen -> L3 + repeat-failure flag.

Sources: https://admin-docs.zammad.org/en/latest/manage/slas.html · https://help.glpi-project.org/tutorials/helpdesk/service_levels · https://docs.znuny.org/manual/generalinformation/ticketescalation/index.html · https://bportaluri.com/2019/08/maximo-escalations-demystified-1.html · https://www.lean.org/lexicon-terms/andon/ · https://forum.camunda.io/t/camunda-7-community-end-of-life-eol-clarification/60208 · https://help.limblecmms.com/en/articles/3408089-custom-email-notifications-for-tasks · https://help.getmaintainx.com/faq-automations
