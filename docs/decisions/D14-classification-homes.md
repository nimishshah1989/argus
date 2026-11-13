# D14 — One home per classification

Date: 13 November 2026 · Status: accepted (architect); detail in `docs/ARCHITECTURE.md`

## Decision

Work type lives on `ticket`. Breakdown category and maintenance code live on `breakdown_report` (Bhavin's form, needed for parity). From M4b failure codes live in `failure_coding`, with legacy codes mapped by `failure_code_alias`. `ticket_tag` may not carry any of these: it is either constrained in the database to a dedicated `tag` list or removed, by Nimish's answer to DATA-MAP question 12. Proposed default: remove before cutover.

## Why

Today a tag can be picked from the same three lists, so one classification can be stored in up to three places and disagree.

## Rejected

- Tags as the single classification mechanism: breaks the parity form and its figures.
