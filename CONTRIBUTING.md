# Contributing Guide

## Purpose

This repository is optimized for fast backend delivery with low integration risk.

## Core Expectations

- build in small slices
- keep each PR scoped to one concern
- update docs when an API, environment variable, or workflow changes
- prefer shipping working increments over holding large branches
- keep Python and Node tooling aligned when a feature touches both runtimes

## Branch Naming

Use:

```text
feat/<area>-<short-name>
fix/<area>-<short-name>
docs/<topic>
chore/<topic>
test/<topic>
```

Examples:

- `feat/api-telemetry-summary`
- `fix/db-pool-shutdown`
- `docs/ai-runtime-guide`

## Commit Format

Use conventional commits:

```text
feat: add telemetry summary endpoint
fix: stop leaking database errors to clients
docs: document backend workflow
test: add health endpoint coverage
chore: add backend ci workflow
```

## Pull Request Rules

- one logical change per PR
- keep PRs small enough to review quickly
- include test steps
- include example payloads if API behavior changes
- call out follow-up work explicitly

## Required Checks Before Merge

- CI passes
- docs are updated when needed
- at least one approval
- no unresolved critical review comments

## Definition of Done

A change is done when:

- it works locally
- relevant checks pass
- affected docs are updated
- the PR description explains how to validate it
