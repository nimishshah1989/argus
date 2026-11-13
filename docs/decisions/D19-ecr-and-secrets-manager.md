# D19 — Images in ECR, secrets in Secrets Manager

Date: 13 November 2026 · Status: accepted (orchestrator, ticket 13)

## Decision

Staging images go to Amazon ECR (immutable tags, tag = commit SHA), not GHCR. Staging secrets live only in AWS Secrets Manager, not SSM Parameter Store. ARCHITECTURE §7 (Deploy workflow, Secrets and access) is amended to say so.

## Why

- One AWS credential path: the deploy role (GitHub OIDC) and the instance role already reach ECR and Secrets Manager, so no `packages: write` token and no registry password on the instance.
- Secrets Manager holds one JSON secret that the instance reads at deploy time; the instance role may read only that secret.

## Rejected

- GHCR: needs a second credential on the instance and a package token in the workflow.
- SSM Parameter Store for secrets: a second store for the same thing; the architecture already names Secrets Manager.
- Mutable tags: a tag could silently change what a rollback restores.

## Note

`AmazonSSMManagedInstanceCore` allows `ssm:GetParameter*` on `*`: never store a secret in Parameter Store.
