# 0004 — Commercial layer deferred

Date: 10 November 2026
Decision by: Nimish (product)

## Context

The product is a multi-tenant maintenance system sold per plant. Cosmos is tenant zero. The first release does not need self-serve signup, subscriptions, invoices or plan enforcement; those are a separate business surface and would slow the product.

## Decision

Build the product first. Billing, self-serve signup, plan enforcement, GST invoices and the platform super-admin surface are deferred until after M6 (the AI layer). Tenant creation and setup are manual on our side until then. The `tenant.plan` and `tenant.status` columns stay as placeholders, not as enforced rules.

## What is deferred

- Payment gateway and subscription lifecycle
- Self-serve signup and trial
- Plan limits and enforcement
- Invoices, GST, dunning
- Platform super-admin UI (tenant create/suspend/export)
- Public pricing page and checkout

## What is not deferred

- Tenant isolation, audit, data export and deletion (needed from M0)
- The ability to create a second tenant by configuration (M5)
- A DPA/privacy policy before a second external customer (legal, not code)

## Revisit

Before the first paying tenant beyond Cosmos, or at the M6 gate, whichever comes first. At that point write the commercial-layer spec and add it as M7.

## Rejected

- **Billing from day one:** no customer needs it yet; it would add payment, tax and support surface before the product is proven.
- **A separate billing service now:** same reason; it is a later, isolated module.
