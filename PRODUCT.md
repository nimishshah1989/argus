<!-- impeccable:product-schema 1 -->

# Uptimo

Platform: web

## Users

- Operators, including setters, report stopped machines, support needs and other work from personal or shared phones, then follow their own reports.
- Technicians start, pause, resume, transfer, join and close work while preserving an accurate account of people and time.
- Supervisors unblock queues, assign ownership and keep follow-up work and reports moving.
- Maintenance heads and plant heads review outcomes, trends, evidence, risk and permitted cost information.
- Admins maintain people, access, configuration, imports and audit history while sharing the management view.
- Board users and shared wall displays need read-only live condition and work visibility.

## Product Purpose

Uptimo is a maintenance operating system for Indian factories. It connects a floor report to named ownership, two independent clocks, a close report and production handback, then turns that record into reliable analytics. The product source of truth is [docs/spec/SPEC.md](docs/spec/SPEC.md); this document does not duplicate its behavior or visual contracts.

## Positioning

The product begins with parity with Bhavin's live ticket app and analytics platform, then improves the loop without losing the evidence behind a number. It is a role-first alternative to dense, general-purpose maintenance screens: the floor prioritizes reporting, the desk prioritizes the next action, and management prioritizes outcomes with drill-down. It is not a general helpdesk, an ERP, a sensor platform or an AI prediction claim.

## Operating Context

- The first tenant is Cosmos Engitech; plant-specific machines, people, shifts, lists and targets remain configuration.
- Low-end Android phones, iPhones, shared cell phones, intermittent connectivity and one-handed use are normal operating conditions.
- English and Gujarati are required from M1; Hindi follows when a plant needs it. Real Gujarati copy is an external input, not something an agent invents.
- Desk and management use phones, tablets and desktops as appropriate; the board also runs as a kiosk.
- There is no staging or production deployment yet. Local and CI evidence must not be described as plant approval.

## Capabilities and Constraints

- Current scaffolding includes sign-in, floor reporting, desk lists and ticket detail, lifecycle actions, a live board, report capture and PDFs, sharing, cached reads and the four implemented offline close/report writes.
- Offline close with report, close without report, mark done and late report replay with idempotency and visible conflict drafts. Offline new stopped/support reports are an approved M1 design todo, not implemented; general/other-work reports still require a connection.
- My complaints already filters by the acting person. Shared-phone presentation without device-wide history and without a Desk link for report-only users remains prototype-only and pending evidence.
- Ticket events and work segments are the accountability record. Condition and work state must remain independent; running a machine does not close its ticket.
- Analytics parity, the importer, real Gujarati translations, the offline new-raise queue and production visual migration remain incomplete.
- Discovery files are read-only references. No discovery implementation is copied into the product.

## Brand Commitments

- Make the next correct action obvious without hiding the record underneath.
- Preserve clarity, deference and depth: legible tasks, restrained presentation and accessible layers of evidence.
- Be honest about pending, stale, offline, unresolved and failed work; never silently drop a report.
- Use consistent language, iconography and semantic state rather than color alone.
- Let every management outcome lead to its trend, underlying tickets and Guide definition.

## Evidence on Hand

- [Current-truth audit](docs/design/CURRENT-TRUTH.md) maps the legacy and all four analytics inventories to implementation evidence and gaps.
- [Role journeys](docs/design/ROLE-JOURNEYS.md), [prototype decisions](docs/design/PROTOTYPE-DECISIONS.md) and the [planned usability script](docs/design/USABILITY.md) define later review work; they are not session results.
- [D0.1 baseline evidence](docs/design/evidence/d01/baseline-manifest.json) uses fake Playwright fixtures only. Its images are current-truth records, not pixel goldens or visual approval.
- [Parity ledger](docs/spec/parity.yaml) records done, partial, todo, external and waived behavior without converting a design decision into an implementation claim.

## Product Principles

1. Ship the accountability loop before analytics, and analytics parity before improved numbers.
2. Design one primary job per role and one primary action per screen, with five first-screen facts/actions and progressive detail.
3. Preserve people, timestamps, figures, corrections, reports and history beneath simplified presentation.
4. Treat offline and failure as visible states, retry writes idempotently and keep duplicate-open resolution attached to the existing ticket.
5. Keep money and administrative capabilities within their server-enforced role boundaries.
6. Do not call a screen done from a screenshot; require behavior tests, accessibility evidence and role-based use on a phone.

## Accessibility & Inclusion

- Floor and Desk targets are at least 52 px, with visible keyboard focus, WCAG AA contrast and accessible names for icon-only controls.
- Status always combines an icon and text; color is never the only carrier of meaning.
- Empty, loading, error, offline and success states are designed for every role journey.
- Long translations, transliterated Gujarati input, reduced motion, screen readers and desktop keyboard paths are explicit test concerns.
- Test with operators and technicians on real phones where possible. A desktop substitute or synthetic session is labelled as such and never presented as real-device or user evidence.
