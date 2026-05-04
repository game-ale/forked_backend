# Fuel-Aware Backend

Backend repository for the Fuel-Aware Smart Inventory System.

This repo is set up for two development paths:

- Python for the FastAPI application and Python-based AI work
- Node.js for AI adapters, SDK experiments, and tooling when the JS ecosystem is faster

## Stack

- Python `3.11+`
- `uv` for Python package and virtual environment management
- FastAPI for the HTTP service
- `psycopg` and `psycopg-pool` for direct Supabase Postgres access
- Node.js `20`
- TypeScript for Node-based AI tooling

## Quick Start

1. Copy `.env.example` to `.env`
2. Fill in at least `SUPABASE_DB_URL`
3. Install Python dependencies:

```bash
uv sync --all-groups
```

4. Install Node dependencies:

```bash
npm install
```

5. Start the API:

```bash
make dev
```

6. Run quality checks:

```bash
make check
```

## Common Commands

```bash
make bootstrap     # install Python and Node dependencies
make dev           # run the FastAPI app with reload
make lint          # run ruff and TypeScript checks
make test          # run Python tests
make ai-node       # show the Node AI helper entrypoint usage
make ai-python     # print current AI runtime config from .env
```

## Repository Layout

```text
analytics/         FastAPI application code
docs/              development and architecture notes for this repo
tools/ai/          Node.js AI helper entrypoints
tests/             backend tests
```

## API Endpoints

- `GET /health`
- `GET /telemetry/sample?limit=10` when `APP_ENV=development`

`/telemetry/sample` runs a direct `SELECT` against `telemetry_normalized` and returns a small result set for connectivity verification. The route is only registered in development to avoid exposing raw telemetry data in non-development environments.

## AI Development

Both Python and Node use the same `.env` file.

- Use Python when AI logic needs direct access to backend code or data models.
- Use Node when you want to move quickly with JS-first AI SDKs or agent tooling.
- Keep provider secrets in `.env`, not in source files.

See [docs/DEVELOPMENT.md](/tmp/backend-migration-gkNAmg/docs/DEVELOPMENT.md) and [docs/AI_DEVELOPMENT.md](/tmp/backend-migration-gkNAmg/docs/AI_DEVELOPMENT.md).

## Contribution

Before contributing, read:

- [CONTRIBUTING.md](/tmp/backend-migration-gkNAmg/CONTRIBUTING.md)
- [docs/WORKFLOW.md](/tmp/backend-migration-gkNAmg/docs/WORKFLOW.md)

## Notes

- This backend uses `SUPABASE_DB_URL` rather than anonymous or service Supabase API keys because the task currently needs direct SQL access.
- The table name defaults to `telemetry_normalized` but can be overridden with `TELEMETRY_TABLE`.
- `AI_RUNTIME` is a team convention only; it helps document whether an AI feature is expected to run from Python or Node.
