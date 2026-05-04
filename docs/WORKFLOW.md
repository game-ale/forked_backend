# Backend Workflow

## Purpose

This document defines how the backend repository should be operated day to day.

## Working Model

Keep changes small, reviewable, and testable.

Good examples:

- one PR for a new endpoint
- one PR for a schema or environment change
- one PR for AI helper tooling

Bad examples:

- one PR mixing API changes, docs rewrites, and unrelated tooling cleanup

## Branching

Use short-lived branches:

```text
feat/<topic>
fix/<topic>
docs/<topic>
chore/<topic>
test/<topic>
```

## Review Rule

Every PR should state:

- what changed
- why it changed
- how it was tested
- what remains as follow-up

## CI Strategy

This repo now has a minimal CI workflow.

Current CI runs:

- Python lint with Ruff
- Python tests with Pytest
- TypeScript check for Node AI tooling

Keep CI fast. Add heavier integration checks only when they catch real failures.

## CD Status

Continuous deployment is not set up yet.

When deployment starts, prefer:

- CI on every pull request
- deployment only from `main`
- staging before production
- environment secrets managed in GitHub or the deployment platform, not in the repo
