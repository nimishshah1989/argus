# D13 — `sla_policy_id` and `handback_status` leave the ticket

Date: 13 November 2026 · Status: accepted (architect); detail in `docs/ARCHITECTURE.md`

## Decision

`severity` and `criticality_snapshot` are ticket facts written by `tickets`. `ticket.sla_policy_id` stops being read or written: the policy is found by severity, since `sla_policy` is unique per tenant and severity and is edited in place, and the armed due time is already on `sla_timer`. `ticket.handback_status` stops being used: the `handback` row is the one truth. Both columns are dropped in a later contract migration with a backup step.

## Why

One source of truth, and no column on `ticket` that `accountability` would have to write.

## Rejected

- Keeping `sla_policy_id` as a pin: it pins nothing while policies are edited in place.
- Moving the columns' ownership to `accountability`: two modules writing one table.
