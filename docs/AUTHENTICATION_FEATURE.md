# Authentication Feature

## Purpose

This document defines how authentication and authorization should work for the Fuel-Aware backend as the project grows beyond the current public prototype.

It is designed to support:

- Supabase as the identity provider and shared database
- Node.js as the main backend runtime
- Python as the AI runtime without duplicating auth rules
- Docker and Render deployment
- easy-to-apply middleware or wrapper patterns for new endpoints

This document aligns with the broader project direction in `fuel-Aware-smart-inventory-system`, where:

- `Admin`, `Driver`, and `Viewer` are the planned user roles
- admin-only access is acceptable for MVP
- telemetry ingestion, alerts, history, and dashboards are the main protected feature areas

## Auth Model Summary

Use three separate trust paths:

1. Human users
   Authenticate with Supabase Auth and send a Bearer JWT.
2. Devices
   Authenticate with a device-specific token for telemetry ingestion.
3. Internal services
   Use server-side credentials only for trusted backend jobs, never from browsers or mobile clients.

Do not use one token type for all three. Human sessions, device writes, and backend service access have different failure modes and should stay separate.

## Core Principles

- Default new business endpoints to authenticated.
- Keep `/health` public.
- Keep authentication and role checks in reusable wrappers, not inline in handlers.
- Verify Supabase JWTs on the server for every protected request.
- Keep Supabase service-role credentials server-side only.
- Use application roles for authorization decisions, not only the raw Supabase user id.
- Treat device ingestion as machine auth, not user auth.
- Keep Node and Python auth behavior aligned through the same claims and role names.

## Roles

### Application Roles

These are the roles the product documentation already points to:

- `admin`
  Full access to vehicles, devices, alerts, history, dashboard data, configuration, and user-role management.
- `driver`
  Access to their assigned vehicle, recent history, active alerts relevant to that vehicle, and trip summaries.
- `viewer`
  Read-only access to dashboard, alerts, and history for allowed vehicles.

### Non-User Access Types

- `device`
  A hardware or simulator identity allowed to post telemetry only.
- `service`
  Internal backend or analytics process with elevated server-side privileges. This is not a human-facing role.

### MVP Recommendation

For MVP, keep it simple:

- enable `admin` first
- optionally add `viewer` for demo read-only access
- postpone fine-grained `driver` scoping until vehicle assignment is stable

This matches the upstream project note that admin-only mode is acceptable early.

## Recommended Identity Data Model

Use Supabase Auth for authentication and store application role data in your own tables.

### Required Tables

- `user_profiles`
  - `id` UUID primary key, same as `auth.users.id`
  - `email`
  - `full_name`
  - `role` enum or constrained text: `admin`, `driver`, `viewer`
  - `status` such as `active`, `disabled`
  - `created_at`
- `user_vehicle_access`
  - `user_id`
  - `vehicle_id`
  - `access_level` such as `owner`, `assigned_driver`, `viewer`
- `device_credentials`
  - `device_id`
  - `token_hash`
  - `status`
  - `last_rotated_at`

### Why Not Store Everything Only in JWT Claims

JWT claims are useful for fast checks, but database-backed authorization is still needed for:

- disabling a user immediately
- assigning a driver to one vehicle only
- granting a viewer access to a subset of vehicles
- rotating device credentials safely

## What Should Be Protected

### Public Endpoints

- `GET /health`

Reason:

- Render health checks need a simple unauthenticated endpoint.

### Protected with Device Authentication

- `POST /api/telemetry`

Reason:

- hardware and simulator clients must be able to write telemetry
- this should not require a human login
- this endpoint should accept only a valid device token

### Protected with User Authentication

These routes should require a valid Supabase user JWT:

- `GET /api/vehicles`
- `POST /api/vehicles`
- `GET /api/vehicles/:vehicleId/latest`
- `GET /api/vehicles/:vehicleId/history`
- `GET /api/vehicles/:vehicleId/alerts`
- `GET /api/vehicles/:vehicleId/trips`
- any future dashboard aggregation endpoints
- any future alert acknowledgement endpoints
- any future device registration endpoints
- any future user/role management endpoints

### Development-Only Endpoints

The current backend has:

- `GET /telemetry/sample`

This route should remain one of these:

- development-only and not mounted in production
- or `admin`-only if it must exist outside development

Do not leave direct sample query routes public in production.

## Authorization Matrix

| Endpoint Area | Public | Device | Viewer | Driver | Admin |
|---|---|---|---|---|---|
| Health check | yes | no | no | no | no |
| Telemetry ingestion | no | yes | no | no | no |
| Dashboard summary | no | no | read | read scoped | read/write |
| Vehicle latest state | no | no | read scoped | read scoped | read/write |
| Vehicle history | no | no | read scoped | read scoped | read/write |
| Alerts list | no | no | read scoped | read scoped | read/write |
| Alert acknowledge/resolve | no | no | no | limited if needed | yes |
| Trip history | no | no | read scoped | read scoped | read/write |
| Vehicles create/update | no | no | no | no | yes |
| Devices create/rotate/revoke | no | no | no | no | yes |
| User role management | no | no | no | no | yes |

`scoped` means access is limited by `user_vehicle_access` or equivalent ownership rules.

## Supabase Authentication Flow

### Human User Flow

1. Frontend or mobile app signs in with Supabase Auth.
2. Supabase returns an access token JWT.
3. Client sends `Authorization: Bearer <token>` to the backend.
4. Backend verifies the JWT.
5. Backend loads the application role and any vehicle scoping.
6. Handler executes only if both authentication and authorization pass.

### Device Flow

1. Device or simulator sends `Authorization: Bearer <device-token>`.
2. Backend hashes the presented token and looks it up in `device_credentials`.
3. Backend verifies the device is active and mapped to the claimed `deviceId`.
4. Only telemetry ingestion logic is allowed.

### Internal Service Flow

Examples:

- analytics batch jobs
- alert backfill jobs
- migrations or admin scripts

Use one of these:

- direct database access through server-side secrets
- a dedicated internal token checked by the backend

Do not use the Supabase service-role key in client code, mobile apps, or browser JavaScript.

## Supabase Verification Strategy

### Node Backend

Recommended pattern:

- read the bearer token from the request
- verify the JWT against Supabase
- build a request auth context
- enforce roles through middleware

Suggested modules:

- `src/auth/verify-user-token.ts`
- `src/auth/context.ts`
- `src/auth/middleware.ts`
- `src/auth/device.ts`

Suggested request context shape:

```ts
type AuthContext = {
  subject: string;
  role: string;
  email: string | null;
  vehicleIds: string[];
  tokenType: "user" | "device" | "service";
};
```

### Python AI Runtime

Python should follow the same auth model when AI-facing endpoints or internal AI jobs need protected access.

Use the same:

- bearer header format
- role names
- device token scheme
- app-level authorization rules

Suggested modules:

- `analytics/auth/jwt.py`
- `analytics/auth/context.py`
- `analytics/auth/dependencies.py`
- `analytics/auth/device.py`

Python services should either:

- verify Supabase JWTs directly if the Python process exposes protected endpoints for AI features
- or receive requests only from the main Node backend using server-side credentials

## Easy Wrapper Pattern

New features should be protected by wrappers instead of repeating auth logic.

### Node Pattern

Use higher-order middleware.

```ts
type AppRole = "admin" | "driver" | "viewer";

export function requireRole(...allowed: AppRole[]) {
  return async function (req, res, next) {
    const ctx = await requireUser(req);
    if (!allowed.includes(ctx.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    req.auth = ctx;
    next();
  };
}
```

For vehicle-scoped routes:

```ts
export function requireVehicleAccess(paramName: string) {
  return async function (req, res, next) {
    const ctx = await requireUser(req);
    const vehicleId = req.params[paramName];
    if (ctx.role !== "admin" && !ctx.vehicleIds.includes(vehicleId)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    req.auth = ctx;
    next();
  };
}
```

## Middleware Layers To Implement

- `requireUser`
- `requireRole`
- `requireVehicleAccess`
- `requireDevice`
- `optionalUser` for mixed public/personalized endpoints if ever needed

### Python

- `require_user`
- `require_role`
- `require_vehicle_access`
- `require_device`
- `optional_user`

These names should stay parallel across runtimes.

## Recommended Enforcement Order

For a user route:

1. parse bearer token
2. verify token signature and expiry
3. load profile and role
4. reject disabled users
5. apply role guard
6. apply vehicle-scoping guard if needed
7. execute handler

For a device route:

1. parse bearer token
2. resolve device credential
3. confirm active device
4. confirm device is allowed for the submitted `deviceId`
5. execute telemetry handler

## Row-Level Security Guidance

Use Supabase RLS if clients ever read directly from Supabase.

Recommended position:

- If the frontend reads only through the backend API, backend auth is the primary control.
- If the frontend reads any tables directly from Supabase, RLS becomes mandatory.

Suggested RLS posture:

- `user_profiles`
  users can read their own record, admins can read all
- `vehicles`
  viewers and drivers can read only assigned vehicles, admins can read all
- `vehicle_latest_state`
  same scoping as `vehicles`
- `alerts`
  same scoping as `vehicles`
- `trips`
  same scoping as `vehicles`
- `telemetry_raw`
  admin only
- `telemetry_normalized`
  admin or scoped read only if there is a direct product need
- `device_credentials`
  admin only

Do not expose raw telemetry or device credential tables directly to normal clients.

## API Error Contract

Use consistent auth error responses:

- `401 Unauthorized`
  missing token, invalid token, expired token
- `403 Forbidden`
  valid identity but insufficient role or vehicle scope

Suggested response:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have access to this resource."
  }
}
```

Do not leak internal verification details in error messages.

## Environment Variables

### Required for Render and Docker

- `SUPABASE_DB_URL`

### Required When Protected User Auth Is Implemented

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

### Server-Side Only

- `SUPABASE_SERVICE_ROLE_KEY`

### Optional

- `AUTH_DEVICE_TOKEN_PEPPER`
  Extra server-side secret used when hashing device tokens.
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `AI_RUNTIME`

### Required For Current User JWT Verification

- `SUPABASE_JWT_SECRET`
  Current backend implementation verifies Supabase user JWTs locally with HS256, so this secret is required until JWKS-based verification is implemented.

### Environment Rules

- Never bake secrets into the Docker image.
- Pass all secrets at runtime through Render environment variables.
- Keep `.env` for local development only.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to browser or mobile builds.

## Docker and Render Considerations

- Keep `/health` public so Render health checks succeed.
- Avoid protecting health checks with Supabase middleware.
- Startup should not depend on user authentication services being available.
- If database connectivity is required during startup, Render must have a valid `SUPABASE_DB_URL`.
- Auth libraries must read configuration from environment variables, not static files embedded in the image.

If the backend later depends on Supabase JWKS retrieval at runtime, verify Render outbound network access and timeout behavior. Token verification failures should fail closed for protected routes, but they should not break the public health endpoint.

## Recommended Implementation Order

1. add `user_profiles`, `user_vehicle_access`, and `device_credentials`
2. implement Node auth context and middleware
3. protect `POST /api/telemetry` with `require_device`
4. add user-protected API routes under `/api/*`
5. add `admin` role enforcement for management routes
6. add `viewer` read access
7. add `driver` vehicle scoping
8. add equivalent Python helpers for AI services that need protected access
9. add tests for `401`, `403`, and allowed cases

## Testing Checklist

- request without token returns `401`
- expired token returns `401`
- disabled user returns `403`
- viewer cannot create vehicles
- viewer cannot read unassigned vehicle data
- driver can read assigned vehicle data
- admin can read and write all managed resources
- device token can post telemetry
- device token cannot access user endpoints
- user token cannot access device-only ingestion route
- `/health` stays public in Docker and Render deployments

## Suggested GitHub Issue Scope

Title:

`Design and implement Supabase-based authentication and authorization`

Suggested acceptance criteria:

- add reusable auth middleware for Node.js
- define `admin`, `driver`, and `viewer` roles
- add device-token auth for telemetry ingestion
- document Render environment variables for auth
- keep `/health` public
- add tests for `401`, `403`, and successful access cases
- document how Python AI services use the same auth model

## Decisions To Keep Explicit

- whether MVP ships as `admin` only or `admin + viewer`
- whether frontend reads directly from Supabase or only through backend APIs
- whether JWT verification uses Supabase JWKS or local secret verification
- whether drivers are scoped by one vehicle or a fleet subset
- whether alert acknowledgement is admin-only or allowed for drivers

Until those decisions are made, implement the wrappers first. They are the stable foundation and keep new features easy to secure.
